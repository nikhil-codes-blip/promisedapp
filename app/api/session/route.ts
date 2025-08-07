import { type NextRequest, NextResponse } from "next/server"
import UserStorageService from "@/scripts/backend/user-storage"

const storage = new UserStorageService()

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    const ipAddress = req.headers.get("x-forwarded-for") || "simulated_ip" // Use req.ip if available, otherwise simulated

    await storage.recordSession(sessionId, ipAddress)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("API Error /api/session:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
