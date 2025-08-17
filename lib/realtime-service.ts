"use client"

import { supabase } from "./supabase-client"
import type { PromiseData, UserStats, GlobalStats, DeleteRequest, RealtimePayload } from "@/types"

// Update API URL to point to Next.js API routes
const ADMIN_API_BASE_URL = "/api/admin" // Base URL for admin API routes

export class RealtimeService {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private sessionId: string | null = null

  private statsUpdateCallbacks: ((stats: GlobalStats) => void)[] = []
  private userUpdateCallbacks: ((user: UserStats) => void)[] = [] 

  private deleteRequestCallbacks: ((request: DeleteRequest) => void)[] = []
  
  // ... inside the RealtimeService class, at the end
  onUserUpdate(callback: (user: UserStats) => void): () => void {
    this.userUpdateCallbacks.push(callback);
    return () => {
      this.userUpdateCallbacks = this.userUpdateCallbacks.filter((cb) => cb !== callback);
    };
    }

  constructor() {
    // Listen for real-time changes from Supabase
    supabase
      .channel("public:promises")
      .on("postgres_changes", { event: "*", schema: "public", table: "promises" }, (payload) => {
        // Correctly map the database record (snake_case) to our app's data type (camelCase)
        const mapPromise = (p: any): PromiseData => ({
          id: p.id,
          creatorName: p.creator_name,
          address: p.address,
          message: p.message,
          deadline: p.deadline,
          status: p.status,
          proof: p.proof,
          createdAt: new Date(p.created_at).getTime(),
          category: p.category,
          difficulty: p.difficulty,
          adminAdjustedProgress: p.admin_adjusted_progress,
          created_by: p.created_by,
        });

        if (payload.eventType === "INSERT") {
        } else if (payload.eventType === "UPDATE") {
        } else if (payload.eventType === "DELETE") {
        }
        // Always update global stats on any promise change
        this.updateGlobalStatsFromSupabase();
      })
      .subscribe();

    supabase
      .channel("public:users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (payload) => {
        console.log("Real-time user update received:", payload.new);
        // Add "(payload.new as any)" to reassure TypeScript that the properties exist
        const updatedUser = {
          id: (payload.new as any).id,
          name: (payload.new as any).name,
          address: (payload.new as any).address,
          reputation: (payload.new as any).reputation,
          completedPromises: (payload.new as any).completed_promises,
          failedPromises: (payload.new as any).failed_promises,
          totalPromises: (payload.new as any).total_promises,
          streak: (payload.new as any).streak,
          level: (payload.new as any).level,
        } as UserStats;
        
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          this.userUpdateCallbacks.forEach((callback) => callback(updatedUser));
        }
        // Also update the global stats
        this.updateGlobalStatsFromSupabase();
      })
      .subscribe();
  }
  
    async updateUserName(userId: string, name: string) {
    const { error } = await supabase
      .from("users")
      .update({ name: name })
      .eq("id", userId);
    if (error) {
      throw new Error(`Failed to update user name: ${error.message}`);
    }
    console.log(`✅ User name updated for UID: ${userId}`);
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
    const { data, error } = await supabase
      .from("promises_with_creator") // Querying the view with creator names
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Map the data from the database to your app's data structure
    return data.map((p: any) => ({
      id: p.id,
      address: p.address,
      message: p.message,
      deadline: new Date(p.deadline).getTime(),
      status: p.status,
      proof: p.proof,
      createdAt: new Date(p.created_at).getTime(),
      category: p.category,
      difficulty: p.difficulty,
      adminAdjustedProgress: p.admin_adjusted_progress,
      creatorName: p.creator_display_name, // Correctly map the display name from the view
      created_by: p.created_by,
    })) as PromiseData[];

  } catch (error) {
    console.error("Error fetching initial promises from Supabase:", error);
    return [];
  }
}

  async getUserStats(address: string, creatorName?: string): Promise<UserStats> {
    try {
      // Get current authenticated user's UID
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      console.log("getUserStats called for address:", address, "creatorName:", creatorName, "Current auth UID:", authUser?.id)

      let existingUser = null;
      let fetchError = null;

      // First try to find user by name if provided
      if (creatorName) {
        const { data: userByName, error: nameError } = await supabase
          .from("users")
          .select("*")
          .eq("name", creatorName)
          .single()
        
        if (!nameError && userByName) {
          existingUser = userByName;
        }
      }

      // If not found by name, try by address as fallback
      if (!existingUser) {
        const { data: userByAddress, error: addressError } = await supabase
          .from("users")
          .select("*")
          .eq("address", address.toLowerCase())
          .single()
        
        if (!addressError && userByAddress) {
          existingUser = userByAddress;
        }
        fetchError = addressError;
      }

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 means no rows found
        throw new Error(fetchError.message)
      }

      if (existingUser) {
        // User found - update auth ID if needed
        if (authUser && existingUser.id !== authUser.id) {
          console.log("Updating existing user's auth ID:", existingUser.id, "->", authUser.id)
          const { error: updateIdError } = await supabase
            .from("users")
            .update({ 
              id: authUser.id,
              address: address.toLowerCase(),
              last_active: new Date().toISOString()
            })
            .eq("id", existingUser.id)
          if (updateIdError) {
            console.error("Error updating user's auth ID:", updateIdError)
          }
        }

        // Update last_active
        await supabase
          .from("users")
          .update({ last_active: new Date().toISOString() })
          .eq("id", existingUser.id)

        return {
          id: existingUser.id,
          name: existingUser.name,
          address: existingUser.address,
          reputation: existingUser.reputation || 0,
          completedPromises: existingUser.completed_promises || 0,
          failedPromises: existingUser.failed_promises || 0,
          totalPromises: existingUser.total_promises || 0,
          streak: existingUser.streak || 0,
          level: existingUser.level || 1,
        }
      } else {
        // User not found - create new
        console.log("Creating new user profile for:", creatorName || address, "with auth UID:", authUser?.id)

        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({
            id: authUser?.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: creatorName || null,
            address: address.toLowerCase(),
            reputation: 0,
            completed_promises: 0,
            failed_promises: 0,
            total_promises: 0,
            streak: 0,
            level: 1,
            last_active: new Date().toISOString(),
            joined_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          console.error("Error creating new user in Supabase:", createError)
          throw new Error(createError.message)
        }
        console.log("Successfully created new user:", newUser)
        return {
          id: newUser.id,
          name: newUser.name,
          address: newUser.address,
          reputation: newUser.reputation || 0,
          completedPromises: newUser.completed_promises || 0,
          failedPromises: newUser.failed_promises || 0,
          totalPromises: newUser.total_promises || 0,
          streak: newUser.streak || 0,
          level: newUser.level || 1,
        }
      }
    } catch (error) {
      console.error("Error fetching/creating user stats in Supabase:", error)
      return { id: "", name: creatorName || null, address, reputation: 0, completedPromises: 0, failedPromises: 0, totalPromises: 0, streak: 0, level: 1 }
    }
  }

private async updateGlobalStatsFromSupabase(userAddress?: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("get_global_stats", {
      p_address: userAddress?.toLowerCase() || null
    });

    if (error) throw error;

    if (data) {
      this.statsUpdateCallbacks.forEach((cb) => cb(data as GlobalStats));
    }
  } catch (err) {
    console.error("Error fetching global stats:", err);
  }
}


  async getGlobalStats(): Promise<GlobalStats> {
    // This will be called once on initial load, then real-time updates will push
    // the latest stats via the `statsUpdateCallbacks`.
    // For now, we'll just return a default and let the real-time listener update it.
    return { totalUsers: 0, totalPromises: 0, completionRate: 0, averageReputation: 0, topPerformer: null, completedPromises: 0, failedPromises: 0, activePromises: 0, highestStreak: 0, myStreak: 0 }
  }

  async createPromise(promise: PromiseData): Promise<PromiseData> {
  console.log("🚀 Creating promise in Supabase:", promise.message);
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser(); // ✅ Get current auth user

    const newPromiseId = `promise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { data, error } = await supabase
      .from("promises")
      .insert({
        id: newPromiseId,
        address: promise.address.toLowerCase(),
        creator_id: authUser?.id || null, // ✅ Save creator_id
        creator_name: promise.creatorName,
        message: promise.message,
        deadline: promise.deadline,
        status: promise.status,
        proof: promise.proof,
        category: promise.category,
        difficulty: promise.difficulty,
        admin_adjusted_progress: promise.adminAdjustedProgress,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

      // Update user's total promises by address (since address is unique)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("total_promises")
        .eq("address", promise.address.toLowerCase())
        .single()

      if (userError && userError.code !== "PGRST116") {
        // If user doesn't exist, create them
        if (userError.code === "PGRST116") {
          const { error: createUserError } = await supabase
            .from("users")
            .insert({
              id: authUser?.id,
              address: promise.address.toLowerCase(),
              name: promise.creatorName,
              total_promises: 1,
              last_active: new Date().toISOString(),
              joined_at: new Date().toISOString()
            })
          if (createUserError) {
            console.error("Error creating user during promise creation:", createUserError)
          }
        }
      } else {
        // Update existing user
        await supabase
          .from("users")
          .update({ total_promises: (userData?.total_promises || 0) + 1, last_active: new Date().toISOString() })
          .eq("address", promise.address.toLowerCase())
      }

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
  status: string,
  proof: string,
  updaterAddress: string
) {
  // 1️⃣ Build update data
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (proof) {
    updateData.proof = proof;
  }

  // 2️⃣ Update promise row in Supabase
  const { data: updatedRow, error: updateError } = await supabase
    .from("promises")
    .update(updateData)
    .eq("id", promiseId)
    .select()
    .single();

  if (updateError) throw new Error(`Update failed: ${updateError.message}`);
  console.log("✅ Promise updated in DB:", updatedRow);

  // 3️⃣ Update user stats (don’t overwrite promise row)
  const { error: statsError } = await supabase.rpc("update_user_stats", {
    p_promise_id: promiseId,
    p_status: status,
    p_address: updaterAddress.toLowerCase(),
  });

  if (statsError) {
    console.error("⚠️ Error updating user stats (but promise is updated):", statsError);
  }
}

  private async updateUserReputationAfterPromiseUpdate(promise: any, newStatus: string, originalStatus?: string) {
    try {
      console.log(`🎯 Updating user reputation for promise status change to: ${newStatus}`);
      console.log(`Previous promise status was: ${promise.status}`);
      console.log(`Promise data:`, promise);
      
      // Use originalStatus if provided, otherwise fall back to promise.status
      const actualOriginalStatus = originalStatus || promise.status;
      console.log(`Actual original status: ${actualOriginalStatus}, New status: ${newStatus}`);
      
      // Skip reputation update if status didn't actually change
      if (actualOriginalStatus === newStatus) {
        console.log("Status didn't change, skipping reputation update");
        return;
      }
      
      // Get current authenticated user to ensure we're updating the right user
      const { data: authData } = await supabase.auth.getUser();
      const currentAuthUid = authData?.user?.id;
      
      // Find user by multiple methods for better reliability
      let user = null;
      let userError = null;
      
      // Method 1: Try by current auth UID first (most reliable)
      if (currentAuthUid) {
        const { data: userByAuth, error: authError } = await supabase
          .from("users")
          .select("*")
          .eq("id", currentAuthUid)
          .single();
        if (!authError && userByAuth) {
          user = userByAuth;
          console.log("✅ Found user by auth UID:", user.id, user.name);
        }
      }
      
      // Method 2: Try by creator_name if provided and not found yet
      if (!user && promise.creator_name) {
        const { data: userByName, error: nameError } = await supabase
          .from("users")
          .select("*")
          .eq("name", promise.creator_name)
          .single();
        if (!nameError && userByName) {
          user = userByName;
          console.log("✅ Found user by creator name:", user.id, user.name);
        } else {
          userError = nameError;
        }
      }
      
      // Method 3: Try by address as fallback
      if (!user && promise.address) {
        const { data: userByAddress, error: addressError } = await supabase
          .from("users")
          .select("*")
          .eq("address", promise.address.toLowerCase())
          .single();
        if (!addressError && userByAddress) {
          user = userByAddress;
          console.log("✅ Found user by address:", user.id, user.name);
        } else {
          userError = addressError;
        }
      }
      
      if (!user) {
        console.error("❌ User not found for reputation update:", {
          promise_creator_name: promise.creator_name,
          promise_address: promise.address,
          currentAuthUid,
          lastError: userError
        });
        return;
      }

      console.log(`📊 Current user stats before update:`, {
        reputation: user.reputation || 0,
        completed: user.completed_promises || 0,
        failed: user.failed_promises || 0,
        streak: user.streak || 0
      });

      // Calculate reputation changes based on status transition
      let reputationChange = 0;
      let completedChange = 0;
      let failedChange = 0;
      let streakChange = 0;
      
      // Handle previous status reversal first (if changing from completed/failed)
      // Use actualOriginalStatus which is more reliable
      if (actualOriginalStatus === "completed") {
        reputationChange -= 10; // Reverse previous +10
        completedChange -= 1;
        console.log("⏪ Reversing previous completion (+10 reputation, +1 completed)");
      } else if (actualOriginalStatus === "failed") {
        reputationChange += 5; // Reverse previous -5
        failedChange -= 1;
        console.log("⏪ Reversing previous failure (-5 reputation, +1 failed)");
      }
      
      // Apply new status changes
      if (newStatus === "completed") {
        reputationChange += 10; // +10 for completion
        completedChange += 1;
        streakChange = 1; // Increment streak
        console.log("✅ Applying completion (+10 reputation, +1 completed, +1 streak)");
      } else if (newStatus === "failed") {
        reputationChange -= 5; // -5 for failure
        failedChange += 1;
        streakChange = -(user.streak || 0); // Reset streak to 0
        console.log("❌ Applying failure (-5 reputation, +1 failed, reset streak)");
      }

      console.log(`📈 Calculated changes:`, {
        reputation: reputationChange,
        completed: completedChange,
        failed: failedChange,
        streak: streakChange
      });

      // Update user stats (with safety checks)
      const updatedReputation = Math.max(0, (user.reputation || 0) + reputationChange);
      const updatedCompleted = Math.max(0, (user.completed_promises || 0) + completedChange);
      const updatedFailed = Math.max(0, (user.failed_promises || 0) + failedChange);
      const updatedStreak = Math.max(0, (user.streak || 0) + streakChange);
      const updatedLevel = Math.floor(updatedReputation / 100) + 1; // Level up every 100 reputation

      console.log(`📊 Final values to update:`, {
        reputation: updatedReputation,
        completed: updatedCompleted,
        failed: updatedFailed,
        streak: updatedStreak,
        level: updatedLevel
      });

      const { error: updateError } = await supabase
        .from("users")
        .update({
          reputation: updatedReputation,
          completed_promises: updatedCompleted,
          failed_promises: updatedFailed,
          streak: updatedStreak,
          level: updatedLevel,
          last_active: new Date().toISOString()
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("❌ Error updating user reputation in database:", updateError);
        throw updateError;
      }

      console.log(`✅ User reputation successfully updated in database:`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Reputation: ${user.reputation || 0} -> ${updatedReputation} (${reputationChange >= 0 ? '+' : ''}${reputationChange})`);
      console.log(`   Completed: ${user.completed_promises || 0} -> ${updatedCompleted} (${completedChange >= 0 ? '+' : ''}${completedChange})`);
      console.log(`   Failed: ${user.failed_promises || 0} -> ${updatedFailed} (${failedChange >= 0 ? '+' : ''}${failedChange})`);
      console.log(`   Streak: ${user.streak || 0} -> ${updatedStreak} (${streakChange >= 0 ? '+' : ''}${streakChange})`);
      console.log(`   Level: ${updatedLevel}`);
      
      // Force refresh of global stats after user update
      console.log(`🔄 Triggering global stats update after reputation change...`);
      await this.updateGlobalStatsFromSupabase();
      
    } catch (error) {
      console.error("❌ Error in updateUserReputationAfterPromiseUpdate:", error);
      // Don't throw here to avoid breaking the promise update flow
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
        creatorName: p.creator_name, // Map creator_name to creatorName
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

  async updatePromiseDetails(
    promiseId: string,
    updates: Partial<PromiseData>,
    updaterAddress: string,
  ): Promise<PromiseData> {
    console.log(`📝 Updating promise ${promiseId} details in Supabase via API route`)
    try {
      const response = await fetch(`/api/promises/update-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promiseId, updates, updaterAddress }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Failed to update promise details: ${errorData.error}`)
      }
      const updatedPromise = await response.json()
      console.log(`✅ Promise details updated successfully (via API route)`)
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
      console.error("Error updating promise details via API route:", error)
      throw error
    }
  }

  subscribeToChanges(callback: (payload: RealtimePayload) => void) {
    supabase
      .channel("public:promises")
      .on("postgres_changes", { event: "*", schema: "public", table: "promises" }, (payload) => {
        const mapPromise = (p: any): PromiseData => ({
          id: p.id,
          creatorName: p.creator_name,
          address: p.address,
          message: p.message,
          deadline: p.deadline,
          status: p.status,
          proof: p.proof,
          createdAt: new Date(p.created_at).getTime(),
          category: p.category,
          difficulty: p.difficulty,
          adminAdjustedProgress: p.admin_adjusted_progress,
          created_by: p.created_by,
        });

        const realtimePayload: RealtimePayload = {
          eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          new: payload.new ? mapPromise(payload.new) : undefined,
          old: payload.old ? { id: (payload.old as any).id } : undefined,
        };
        callback(realtimePayload);
      })
      .subscribe();
  }

  onStatsUpdate(callback: (stats: GlobalStats) => void) {
    this.statsUpdateCallbacks.push(callback)
  }

  onDeleteRequest(callback: (request: DeleteRequest) => void) {
    this.deleteRequestCallbacks.push(callback)
  }
}
