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

export async function GET(req: NextRequest) {
  const adminAddress = authenticateAdmin(req)
  if (!adminAddress) {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 })
  }

  try {
    const users = await storage.getUsers()
    // Convert the object of users to an array for easier consumption on the frontend
    return NextResponse.json(Object.values(users), { status: 200 })
  } catch (error: any) {
    console.error("API Error /api/admin/users:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
