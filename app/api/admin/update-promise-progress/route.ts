import { type NextRequest, NextResponse } from "next/server"
import UserStorageService from "@/scripts/backend/user-storage"

const storage = new UserStorageService()

const ADMIN_WALLET_ADDRESS =
  process.env.ADMIN_WALLET_ADDRESS?.toLowerCase() || "0xFb918BAC7ba0C324F573b2763CD4EC08cdEc5647".toLowerCase()

function authenticateAdmin(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization")
  const adminAddress = authHeader ? authHeader.split(" ")[1] : null

  if (!adminAddress || adminAddress.toLowerCase() !== ADMIN_WALLET_ADDRESS) {
    return null
  }
  return adminAddress.toLowerCase()
}

export async function POST(req: NextRequest) {
  const adminAddress = authenticateAdmin(req)
  if (!adminAddress) {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 })
  }

  try {
    const { promiseId, progress } = await req.json()
    const updatedPromise = await storage.updatePromise(promiseId, { admin_adjusted_progress: progress })
    return NextResponse.json(updatedPromise, { status: 200 })
  } catch (error: any) {
    console.error("API Error /api/admin/update-promise-progress:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
