import { createClient } from "@supabase/supabase-js"
import fs from "fs/promises"
import path from "path"

// Initialize Supabase client for backend operations (e.g., admin actions)
// Use a service role key for backend operations to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY // This should be a secret env var!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase URL or Service Role Key environment variables.")
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false, // No session persistence for service role
  },
})

interface PromiseData {
  id: string
  address: string
  message: string
  deadline: number
  status: "active" | "completed" | "failed"
  proof?: string
  createdAt: number
  category: string
  difficulty: "easy" | "medium" | "hard"
  admin_adjusted_progress?: number
}

interface UserData {
  address: string
  reputation: number
  completed_promises: number
  failed_promises: number
  total_promises: number
  streak: number
  level: number
  joined_at: string
  last_active: string
}

interface SessionData {
  session_id: string
  ip: string
  last_active: string
  first_visit: string
}

interface DeleteRequest {
  id: string
  promiseId: string
  requesterAddress: string
  status: "pending" | "approved" | "rejected"
  requestedAt: number
  processedBy?: string
  processedAt?: number
}

class UserStorageService {
  private dataDir: string
  private deleteRequestsFile: string

  constructor() {
    this.dataDir = path.join(process.cwd(), "scripts", "backend", "data")
    this.deleteRequestsFile = path.join(this.dataDir, "delete-requests.json")

    this.initializeStorage()
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      await this.initializeFile(this.deleteRequestsFile, [])
      console.log("✅ User storage system initialized (local delete requests only)")
    } catch (error) {
      console.error("❌ Failed to initialize storage:", error)
    }
  }

  private async initializeFile(filePath: string, defaultData: any[]) {
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2))
    }
  }

  // Session/IP Tracking (now directly in Supabase)
  async recordSession(sessionId: string, ipAddress = "simulated_ip"): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from("sessions")
        .upsert(
          { session_id: sessionId, ip: ipAddress, last_active: new Date().toISOString() },
          { onConflict: "session_id" },
        )
        .select()

      if (error) throw new Error(error.message)
      console.log(`🌐 Session recorded in Supabase: ${sessionId} from IP: ${ipAddress}`)
    } catch (error) {
      console.error("❌ Failed to record session in Supabase:", error)
      throw error
    }
  }

  async getSessions(): Promise<Record<string, SessionData>> {
    try {
      const { data, error } = await supabaseAdmin.from("sessions").select("*")
      if (error) throw new Error(error.message)
      return data.reduce((acc: Record<string, SessionData>, session: any) => {
        acc[session.session_id] = {
          session_id: session.session_id,
          ip: session.ip,
          last_active: session.last_active,
          first_visit: session.first_visit,
        }
        return acc
      }, {})
    } catch (error) {
      console.error("❌ Failed to read sessions from Supabase:", error)
      return {}
    }
  }

  // User Management (now directly in Supabase)
  async createUser(address: string, userData: Partial<UserData> = {}): Promise<UserData> {
    try {
      const { data, error } = await supabaseAdmin
        .from("users")
        .insert({
          address: address.toLowerCase(),
          reputation: 0,
          completed_promises: 0,
          failed_promises: 0,
          total_promises: 0,
          streak: 0,
          level: 1,
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          ...userData,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      console.log(`👤 Created user in Supabase: ${address}`)
      return data as UserData
    } catch (error) {
      console.error("❌ Failed to create user in Supabase:", error)
      throw error
    }
  }

  async getUser(address: string): Promise<UserData | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("address", address.toLowerCase())
        .single()

      if (error && error.code !== "PGRST116") throw new Error(error.message) // PGRST116 means no rows found
      return data as UserData | null
    } catch (error) {
      console.error("❌ Failed to get user from Supabase:", error)
      return null
    }
  }

  async updateUser(address: string, updates: Partial<UserData>): Promise<UserData> {
    try {
      const { data, error } = await supabaseAdmin
        .from("users")
        .update({ ...updates, last_active: new Date().toISOString() })
        .eq("address", address.toLowerCase())
        .select()
        .single()

      if (error) throw new Error(error.message)
      console.log(`📝 Updated user in Supabase: ${address}`)
      return data as UserData
    } catch (error) {
      console.error("❌ Failed to update user in Supabase:", error)
      throw error
    }
  }

  async getUsers(): Promise<Record<string, UserData>> {
    try {
      const { data, error } = await supabaseAdmin.from("users").select("*")
      if (error) throw new Error(error.message)
      return data.reduce((acc: Record<string, UserData>, user: any) => {
        acc[user.address] = {
          address: user.address,
          reputation: user.reputation,
          completed_promises: user.completed_promises,
          failed_promises: user.failed_promises,
          total_promises: user.total_promises,
          streak: user.streak,
          level: user.level,
          joined_at: user.joined_at,
          last_active: user.last_active,
        }
        return acc
      }, {})
    } catch (error) {
      console.error("❌ Failed to read users from Supabase:", error)
      return {}
    }
  }

  // Promise Management (now directly in Supabase)
  async createPromise(promiseData: Omit<PromiseData, "id" | "createdAt" | "updated_at">): Promise<PromiseData> {
    try {
      let user = await this.getUser(promiseData.address)
      if (!user) {
        user = await this.createUser(promiseData.address)
      }

      const newPromise: PromiseData = {
        id: `promise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Math.floor(Date.now() / 1000), // Unix timestamp
        ...promiseData,
      }

      const { data, error } = await supabaseAdmin.from("promises").insert(newPromise).select().single()

      if (error) throw new Error(error.message)

      await this.updateUser(promiseData.address, {
        total_promises: (user?.total_promises || 0) + 1,
      })

      console.log(`🎯 Created promise in Supabase: ${newPromise.id}`)
      return data as PromiseData
    } catch (error) {
      console.error("❌ Failed to create promise in Supabase:", error)
      throw error
    }
  }

  async updatePromise(promiseId: string, updates: Partial<PromiseData>): Promise<PromiseData> {
    try {
      const { data: oldPromise, error: fetchError } = await supabaseAdmin
        .from("promises")
        .select("*")
        .eq("id", promiseId)
        .single()

      if (fetchError) throw new Error(fetchError.message)

      const { data, error } = await supabaseAdmin
        .from("promises")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", promiseId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Reputation update logic is now handled in realtime-service.ts for client-side updates
      // This backend update is primarily for admin-adjusted progress.

      console.log(`📝 Updated promise in Supabase: ${promiseId}`)
      return data as PromiseData
    } catch (error) {
      console.error("❌ Failed to update promise in Supabase:", error)
      throw error
    }
  }

  async deletePromise(promiseId: string): Promise<{ success: boolean }> {
    try {
      const { data: promiseToDelete, error: fetchError } = await supabaseAdmin
        .from("promises")
        .select("address") // Only need address to update user stats
        .eq("id", promiseId)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") throw new Error(fetchError.message) // Handle no rows found gracefully
      if (!promiseToDelete) {
        console.warn(`Promise ${promiseId} not found for deletion. It might have been deleted already.`)
        return { success: false } // Indicate that no promise was deleted
      }

      const { error: deleteError } = await supabaseAdmin.from("promises").delete().eq("id", promiseId) // Removed .select().single()

      if (deleteError) throw new Error(deleteError.message)

      const user = await this.getUser(promiseToDelete.address)
      if (user) {
        await this.updateUser(promiseToDelete.address, {
          total_promises: Math.max(0, user.total_promises - 1),
        })
      }

      console.log(`🗑️ Deleted promise from Supabase: ${promiseId}`)
      return { success: true }
    } catch (error) {
      console.error("❌ Failed to delete promise from Supabase:", error)
      throw error
    }
  }

  async getPromises(filter: { address?: string; status?: string; category?: string } = {}): Promise<PromiseData[]> {
    try {
      let query = supabaseAdmin.from("promises").select("*")

      if (filter.address) {
        query = query.eq("address", filter.address.toLowerCase())
      }
      if (filter.status) {
        query = query.eq("status", filter.status)
      }
      if (filter.category) {
        query = query.eq("category", filter.category)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data as PromiseData[]
    } catch (error) {
      console.error("❌ Failed to read promises from Supabase:", error)
      return []
    }
  }

  // Delete Request Management (still uses local file for pending requests, but promise deletion is in Supabase)
  async addDeleteRequest(promiseId: string, requesterAddress: string): Promise<DeleteRequest> {
    try {
      const requests = await this.getDeleteRequests(true) // Get from local file
      const existingRequest = requests.find((req) => req.promiseId === promiseId && req.status === "pending")

      if (existingRequest) {
        console.log(`⚠️ Delete request for promise ${promiseId} already pending. (local file)`)
        return existingRequest
      }

      const newRequest: DeleteRequest = {
        id: `delreq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        promiseId,
        requesterAddress,
        status: "pending",
        requestedAt: Date.now(),
      }
      requests.push(newRequest)
      await this.saveDeleteRequests(requests) // Save to local file
      console.log(`🗑️ Added delete request for promise ${promiseId} by ${requesterAddress} (local file)`)
      return newRequest
    } catch (error) {
      console.error("❌ Failed to add delete request (local file):", error)
      throw error
    }
  }

  async getDeleteRequests(includeAll = false): Promise<DeleteRequest[]> {
    try {
      const data = await fs.readFile(this.deleteRequestsFile, "utf8")
      const requests: DeleteRequest[] = JSON.parse(data)
      return includeAll ? requests : requests.filter((req) => req.status === "pending")
    } catch (error) {
      console.error("❌ Failed to read delete requests (local file):", error)
      return []
    }
  }

  async updateDeleteRequestStatus(
    requestId: string,
    status: "approved" | "rejected",
    adminAddress: string,
  ): Promise<DeleteRequest> {
    try {
      const requests = await this.getDeleteRequests(true) // Get from local file
      const requestIndex = requests.findIndex((req) => req.id === requestId)

      if (requestIndex === -1) {
        throw new Error(`Delete request ${requestId} not found. (local file)`)
      }

      requests[requestIndex].status = status
      requests[requestIndex].processedBy = adminAddress
      requests[requestIndex].processedAt = Date.now()

      await this.saveDeleteRequests(requests) // Save to local file
      console.log(`📝 Updated delete request ${requestId} to ${status} by ${adminAddress} (local file)`)

      if (status === "approved") {
        await this.deletePromise(requests[requestIndex].promiseId) // Delete from Supabase
      }
      return requests[requestIndex]
    } catch (error) {
      console.error("❌ Failed to update delete request status (local file):", error)
      throw error
    }
  }

  private async saveDeleteRequests(requests: DeleteRequest[]): Promise<void> {
    try {
      await fs.writeFile(this.deleteRequestsFile, JSON.stringify(requests, null, 2))
    } catch (error) {
      console.error("❌ Failed to save delete requests (local file):", error)
      throw error
    }
  }
}

export default UserStorageService
