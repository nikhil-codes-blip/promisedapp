import { type NextRequest, NextResponse } from "next/server"
import UserStorageService from "@/scripts/backend/user-storage"

const storage = new UserStorageService()

export async function POST(req: NextRequest) {
  try {
    const { promiseId, requesterAddress } = await req.json()

    if (!promiseId || !requesterAddress) {
      return NextResponse.json({ error: "Missing promiseId or requesterAddress" }, { status: 400 })
    }

    const newRequest = await storage.addDeleteRequest(promiseId, requesterAddress)
    return NextResponse.json(newRequest, { status: 200 })
  } catch (error: any) {
    console.error("API Error /api/admin/delete-request:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
