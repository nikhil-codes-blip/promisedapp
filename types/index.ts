export interface PromiseData {
  id: string
  creatorName?: string // Optional field for creator's name
  creator_display_name?: string;
  address: string
  message: string
  deadline: number
  status: "active" | "completed" | "failed"
  proof?: string
  createdAt: number // Mapped from created_at in DB
  category: string
  difficulty: "easy" | "medium" | "hard"
  adminAdjustedProgress?: number // Mapped from admin_adjusted_progress in DB
  updated_at?: string
  created_by?: string
}

export interface UserData {
  address: string
  reputation: number
  completed_promises: number // Matches Supabase column name
  failed_promises: number // Matches Supabase column name
  total_promises: number // Matches Supabase column name
  streak: number
  level: number
  joined_at: string // Matches Supabase column name
  last_active: string // Matches Supabase column name
}

export interface SessionData {
  session_id: string
  ip: string
  last_active: string
  first_visit: string
}

export interface DeleteRequest {
  id: string
  promiseId: string
  requesterAddress: string
  status: "pending" | "approved" | "rejected"
  requestedAt: number
  processedBy?: string
  processedAt?: number
}

export interface UserStats {
  id: string;
  address: string
  name: string | null
  reputation: number
  completedPromises: number
  failedPromises: number
  totalPromises: number
  streak: number
  level: number
}

export interface GlobalStats {
  totalUsers: number
  totalPromises: number
  completionRate: number
  averageReputation: number
  topPerformer: string | null
  completedPromises: number
  failedPromises: number
  activePromises: number
  highestStreak: number
  myStreak: number // ✅ NEW
}

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: PromiseData;
  old?: { id: string };
}
