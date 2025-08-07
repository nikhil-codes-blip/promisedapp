"use client"

import { supabase } from "./supabase-client"
import type { PromiseData, UserStats, GlobalStats, DeleteRequest } from "@/types"

// Update API URL to point to Next.js API routes
const ADMIN_API_BASE_URL = "/api/admin" // Base URL for admin API routes

export class RealtimeService {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private sessionId: string | null = null

  private promiseUpdateCallbacks: ((promise: PromiseData) => void)[] = []
  private newPromiseCallbacks: ((promise: PromiseData) => void)[] = []
  private promiseDeleteCallbacks: ((promiseId: string) => void)[] = []
  private statsUpdateCallbacks: ((stats: GlobalStats) => void)[] = []
  private deleteRequestCallbacks: ((request: DeleteRequest) => void)[] = []

  constructor() {
    // Listen for real-time changes from Supabase
    supabase
      .channel("public:promises")
      .on("postgres_changes", { event: "*", schema: "public", table: "promises" }, (payload) => {
        const newPromise = payload.new as PromiseData
        const oldPromise = payload.old as PromiseData

        if (payload.eventType === "INSERT") {
          this.newPromiseCallbacks.forEach((callback) => callback(newPromise))
          this.updateGlobalStatsFromSupabase() // Trigger stats update
        } else if (payload.eventType === "UPDATE") {
          this.promiseUpdateCallbacks.forEach((callback) => callback(newPromise))
          this.updateGlobalStatsFromSupabase() // Trigger stats update
        } else if (payload.eventType === "DELETE") {
          this.promiseDeleteCallbacks.forEach((callback) => callback(oldPromise.id))
          this.updateGlobalStatsFromSupabase() // Trigger stats update
        }
      })
      .subscribe()

    supabase
      .channel("public:users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        this.updateGlobalStatsFromSupabase() // User changes affect global stats
      })
      .subscribe()

    supabase
      .channel("public:sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        this.updateGlobalStatsFromSupabase() // Session changes affect total users
      })
      .subscribe()
  }

  async connect(sessionId: string) {
    this.sessionId = sessionId
    try {
      console.log("🔗 Attempting to record session via API route...")
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Session record failed: ${errorData.error}`)
      }

      console.log("✅ Session recorded via API route")
      await this.updateGlobalStatsFromSupabase() // Fetch and broadcast initial stats
    } catch (error) {
      console.error("❌ Failed to connect to real-time service or record session:", error)
      this.handleReconnect()
    }
  }

  disconnect() {
    // Supabase client handles its own connection lifecycle
    console.log("🔌 Disconnected from real-time service (Supabase)")
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

      setTimeout(() => {
        if (this.sessionId) {
          this.connect(this.sessionId)
        }
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  async getInitialPromises(): Promise<PromiseData[]> {
    try {
      const { data, error } = await supabase.from("promises").select("*").order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      // Map snake_case to camelCase for PromiseData
      return data.map((p: any) => ({
        id: p.id,
        address: p.address,
        message: p.message,
        deadline: p.deadline,
        status: p.status,
        proof: p.proof,
        createdAt: new Date(p.created_at).getTime(), // Convert timestamp to number
        category: p.category,
        difficulty: p.difficulty,
        adminAdjustedProgress: p.admin_adjusted_progress,
      })) as PromiseData[]
    } catch (error) {
      console.error("Error fetching initial promises from Supabase:", error)
      return []
    }
  }

  async getUserStats(address: string): Promise<UserStats> {
    try {
      const { data, error } = await supabase.from("users").select("*").eq("address", address.toLowerCase()).single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 means no rows found
        throw new Error(error.message)
      }

      if (data) {
        return {
          address: data.address,
          reputation: data.reputation,
          completedPromises: data.completed_promises,
          failedPromises: data.failed_promises,
          totalPromises: data.total_promises,
          streak: data.streak,
          level: data.level,
        }
      } else {
        // Create user if not found
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({ address: address.toLowerCase() })
          .select()
          .single()

        if (createError) throw new Error(createError.message)
        return {
          address: newUser.address,
          reputation: newUser.reputation,
          completedPromises: newUser.completed_promises,
          failedPromises: newUser.failed_promises,
          totalPromises: newUser.total_promises,
          streak: newUser.streak,
          level: newUser.level,
        }
      }
    } catch (error) {
      console.error("Error fetching/creating user stats in Supabase:", error)
      return {
        address,
        reputation: 0,
        completedPromises: 0,
        failedPromises: 0,
        totalPromises: 0,
        streak: 0,
        level: 1,
      }
    }
  }

  private async updateGlobalStatsFromSupabase(): Promise<void> {
    try {
      const { data: totalUsersData, error: usersError } = await supabase
        .from("sessions")
        .select("session_id", { count: "exact" })
      if (usersError) throw new Error(usersError.message)
      const totalUsers = totalUsersData?.length || 0

      const { data: promisesData, error: promisesError } = await supabase.from("promises").select("id, status")
      if (promisesError) throw new Error(promisesError.message)
      const totalPromises = promisesData?.length || 0
      const completedPromises = promisesData?.filter((p) => p.status === "completed").length || 0
      const completionRate = totalPromises > 0 ? (completedPromises / totalPromises) * 100 : 0

      const { data: allUsersData, error: allUsersError } = await supabase.from("users").select("reputation")
      if (allUsersError) throw new Error(allUsersError.message)
      const totalReputation = allUsersData?.reduce((sum, user) => sum + user.reputation, 0) || 0
      const averageReputation = totalUsers > 0 ? totalReputation / totalUsers : 0

      const { data: topPerformerData, error: topPerformerError } = await supabase
        .from("users")
        .select("address, reputation")
        .order("reputation", { ascending: false })
        .limit(1)
        .single()
      if (topPerformerError && topPerformerError.code !== "PGRST116") throw new Error(topPerformerError.message)
      const topPerformer = topPerformerData?.address || null

      const stats: GlobalStats = {
        totalUsers,
        totalPromises,
        completionRate: Number.parseFloat(completionRate.toFixed(2)),
        averageReputation: Number.parseFloat(averageReputation.toFixed(2)),
        topPerformer,
      }
      this.statsUpdateCallbacks.forEach((callback) => callback(stats))
    } catch (error) {
      console.error("Error updating global stats from Supabase:", error)
    }
  }

  async getGlobalStats(): Promise<GlobalStats> {
    // This will be called once on initial load, then real-time updates will push
    // the latest stats via the `statsUpdateCallbacks`.
    // For now, we'll just return a default and let the real-time listener update it.
    return { totalUsers: 0, totalPromises: 0, completionRate: 0, averageReputation: 0, topPerformer: null }
  }

  async createPromise(promise: PromiseData): Promise<PromiseData> {
    console.log("🚀 Creating promise in Supabase:", promise.message)
    try {
      const newPromiseId = `promise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const { data, error } = await supabase
        .from("promises")
        .insert({
          id: newPromiseId,
          address: promise.address.toLowerCase(),
          message: promise.message,
          deadline: promise.deadline,
          status: promise.status,
          proof: promise.proof,
          category: promise.category,
          difficulty: promise.difficulty,
          admin_adjusted_progress: promise.adminAdjustedProgress,
        })
        .select()
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) throw new Error("Promise creation failed. The record was not returned after insert.")

      // Update user's total promises
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("total_promises")
        .eq("address", promise.address.toLowerCase())
        .maybeSingle()

      if (userError) throw new Error(userError.message)

      await supabase
        .from("users")
        .update({ total_promises: (user?.total_promises || 0) + 1, last_active: new Date().toISOString() })
        .eq("address", promise.address.toLowerCase())

      console.log("✅ Promise created successfully in Supabase")
      // Ensure created_at is mapped to createdAt for the returned PromiseData
      return {
        id: data.id,
        address: data.address,
        message: data.message,
        deadline: data.deadline,
        status: data.status,
        proof: data.proof,
        createdAt: new Date(data.created_at).getTime(),
        category: data.category,
        difficulty: data.difficulty,
        adminAdjustedProgress: data.admin_adjusted_progress,
      } as PromiseData
    } catch (error) {
      console.error("Error creating promise in Supabase:", error)
      throw error
    }
  }

  async updatePromiseStatus(
    promiseId: string,
    status: "completed" | "failed",
    proof?: string,
    updaterAddress?: string,
  ): Promise<PromiseData> {
    console.log(`📝 Updating promise ${promiseId} status in Supabase to ${status}`)
    try {
      const { data: existingPromise, error: fetchError } = await supabase
        .from("promises")
        .select("address, status")
        .eq("id", promiseId)
        .maybeSingle()

      if (fetchError) throw new Error(fetchError.message)
      if (!existingPromise) throw new Error(`Promise with ID ${promiseId} not found.`)
      if (existingPromise.status !== "active") throw new Error("Promise is not active and cannot be updated.")
      if (existingPromise.address.toLowerCase() !== updaterAddress?.toLowerCase()) {
        throw new Error("Only the promise owner can update its status.")
      }

      const { data, error } = await supabase
        .from("promises")
        .update({ status, proof, updated_at: new Date().toISOString() })
        .eq("id", promiseId)
        .select()
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) throw new Error("Promise update failed. The promise may not exist or no changes were applied.")

      // Update user's reputation and stats
      let user;
      const { data: userData, error: userFetchError } = await supabase
        .from("users")
        .select("*")
        .eq("address", updaterAddress!.toLowerCase())
        .maybeSingle() // Changed to maybeSingle()
      user = userData;

      if (userFetchError) throw new Error(userFetchError.message)

      // If user does not exist, create them
      if (!user) {
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({ address: updaterAddress!.toLowerCase() })
          .select()
          .maybeSingle()
        if (createError) throw new Error(createError.message)
        if (!newUser) throw new Error("Failed to create user.")
        user = newUser // Assign the newly created user
      }

      let reputationChange = 0
      let completedPromises = user.completed_promises
      let failedPromises = user.failed_promises
      let streak = user.streak

      if (status === "completed") {
        reputationChange = 10
        completedPromises += 1
        streak += 1
      } else if (status === "failed") {
        reputationChange = -5
        failedPromises += 1
        streak = 0
      }

      const newReputation = Math.max(0, user.reputation + reputationChange)
      const newLevel = Math.floor(newReputation / 50) + 1

      await supabase
        .from("users")
        .update({
          reputation: newReputation,
          completed_promises: completedPromises,
          failed_promises: failedPromises,
          streak: streak,
          level: newLevel,
          last_active: new Date().toISOString(),
        })
        .eq("address", updaterAddress!.toLowerCase())

      console.log("✅ Promise status updated successfully in Supabase")
      // Ensure created_at is mapped to createdAt for the returned PromiseData
      return {
        id: data.id,
        address: data.address,
        message: data.message,
        deadline: data.deadline,
        status: data.status,
        proof: data.proof,
        createdAt: new Date(data.created_at).getTime(),
        category: data.category,
        difficulty: data.difficulty,
        adminAdjustedProgress: data.admin_adjusted_progress,
      } as PromiseData
    } catch (error) {
      console.error("Error updating promise status in Supabase:", error)
      throw error
    }
  }

  async requestDeletePromise(promiseId: string, requesterAddress: string): Promise<void> {
    console.log(`🗑️ Requesting deletion for promise ${promiseId} by ${requesterAddress} via API route`)
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/delete-request`, {
        // New API route for user-initiated delete requests
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promiseId, requesterAddress }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Failed to send delete request: ${errorData.error}`)
      }
      console.log("✅ Delete request sent successfully to API route")
    } catch (error) {
      console.error("Error sending delete request to API route:", error)
      throw error
    }
  }

  // Admin API calls (now go through Next.js API routes)
  async getAdminDeleteRequests(adminAddress: string): Promise<DeleteRequest[]> {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/delete-requests`, {
        headers: { Authorization: `Bearer ${adminAddress}` },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch admin delete requests")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching admin delete requests:", error)
      throw error
    }
  }

  async approveDeleteRequest(requestId: string, adminAddress: string): Promise<string> {
    console.log(`✅ Admin ${adminAddress} approving delete request ${requestId} via API route`)
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/approve-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAddress}` },
        body: JSON.stringify({ requestId }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to approve delete request")
      }
      const result = await response.json()
      const deletedPromiseId = result.promiseId // Assuming the API returns the deleted promise ID
      this.promiseDeleteCallbacks.forEach((callback) => callback(deletedPromiseId))
      await this.updateGlobalStatsFromSupabase() // Trigger stats update
      console.log(`✅ Promise deleted by admin (via API route)`)
      return deletedPromiseId
    } catch (error) {
      console.error("Error approving request:", error)
      throw error
    }
  }

  async rejectDeleteRequest(requestId: string, adminAddress: string): Promise<void> {
    console.log(`❌ Admin ${adminAddress} rejecting delete request ${requestId} via API route`)
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/reject-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAddress}` },
        body: JSON.stringify({ requestId }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to reject delete request")
      }
      console.log(`❌ Delete request rejected by admin (via API route)`)
    } catch (error) {
      console.error("Error rejecting request:", error)
      throw error
    }
  }

  async getAllUsers(adminAddress: string): Promise<any[]> {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${adminAddress}` },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch all users")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching all users:", error)
      throw error
    }
  }

  async getAllSessions(adminAddress: string): Promise<any[]> {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/sessions`, {
        headers: { Authorization: `Bearer ${adminAddress}` },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch all sessions")
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching all sessions:", error)
      throw error
    }
  }

  async getAllPromises(adminAddress: string): Promise<PromiseData[]> {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/promises`, {
        headers: { Authorization: `Bearer ${adminAddress}` },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch all promises for admin")
      }
      // Map snake_case to camelCase for PromiseData
      const data = await response.json()
      return data.map((p: any) => ({
        id: p.id,
        address: p.address,
        message: p.message,
        deadline: p.deadline,
        status: p.status,
        proof: p.proof,
        createdAt: new Date(p.created_at).getTime(), // Convert timestamp to number
        category: p.category,
        difficulty: p.difficulty,
        adminAdjustedProgress: p.admin_adjusted_progress,
      })) as PromiseData[]
    } catch (error) {
      console.error("Error fetching all promises for admin:", error)
      throw error
    }
  }

  async updateAdminPromiseProgress(promiseId: string, progress: number, adminAddress: string): Promise<PromiseData> {
    console.log(`📈 Admin ${adminAddress} updating progress for promise ${promiseId} to ${progress}% via API route`)
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/update-promise-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAddress}` },
        body: JSON.stringify({ promiseId, progress }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update promise progress")
      }
      const updatedPromise = await response.json()
      this.promiseUpdateCallbacks.forEach((callback) => callback(updatedPromise)) // Notify listeners
      console.log(`✅ Promise progress updated by admin (via API route)`)
      // Ensure created_at is mapped to createdAt for the returned PromiseData
      return {
        id: updatedPromise.id,
        address: updatedPromise.address,
        message: updatedPromise.message,
        deadline: updatedPromise.deadline,
        status: updatedPromise.status,
        proof: updatedPromise.proof,
        createdAt: new Date(updatedPromise.created_at).getTime(),
        category: updatedPromise.category,
        difficulty: updatedPromise.difficulty,
        adminAdjustedProgress: updatedPromise.admin_adjusted_progress,
      } as PromiseData
    } catch (error) {
      console.error("Error updating promise progress:", error)
      throw error
    }
  }

  onPromiseUpdate(callback: (promise: PromiseData) => void): () => void {
    this.promiseUpdateCallbacks.push(callback)
    return () => {
      this.promiseUpdateCallbacks = this.promiseUpdateCallbacks.filter((cb) => cb !== callback)
    }
  }

  onNewPromise(callback: (promise: PromiseData) => void): () => void {
    this.newPromiseCallbacks.push(callback)
    return () => {
      this.newPromiseCallbacks = this.newPromiseCallbacks.filter((cb) => cb !== callback)
    }
  }

  onPromiseDelete(callback: (promiseId: string) => void): () => void {
    this.promiseDeleteCallbacks.push(callback)
    return () => {
      this.promiseDeleteCallbacks = this.promiseDeleteCallbacks.filter((cb) => cb !== callback)
    }
  }

  onStatsUpdate(callback: (stats: GlobalStats) => void): () => void {
    this.statsUpdateCallbacks.push(callback)
    return () => {
      this.statsUpdateCallbacks = this.statsUpdateCallbacks.filter((cb) => cb !== callback)
    }
  }

  onDeleteRequest(callback: (request: DeleteRequest) => void): () => void {
    this.deleteRequestCallbacks.push(callback)
    return () => {
      this.deleteRequestCallbacks = this.deleteRequestCallbacks.filter((cb) => cb !== callback)
    }
  }
}
