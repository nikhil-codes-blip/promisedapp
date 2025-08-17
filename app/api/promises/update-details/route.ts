import { type NextRequest, NextResponse } from "next/server"
import UserStorageService from "@/scripts/backend/user-storage"

const storage = new UserStorageService()

export async function POST(req: NextRequest) {
  try {
    const { promiseId, updates, updaterAddress } = await req.json()

    if (!promiseId || !updates || !updaterAddress) {
      return NextResponse.json({ error: "Missing promiseId, updates, or updaterAddress" }, { status: 400 })
    }

    // Fetch the promise to verify ownership before updating
    const existingPromise = await storage.getPromises({ id: promiseId })
    if (
      !existingPromise ||
      existingPromise.length === 0 ||
      existingPromise[0].address.toLowerCase() !== updaterAddress.toLowerCase()
    ) {
      return NextResponse.json({ error: "Unauthorized: You can only edit your own promises." }, { status: 403 })
    }

    const updatedPromise = await storage.updatePromise(promiseId, updates)
    return NextResponse.json(updatedPromise, { status: 200 })
  } catch (error: any) {
    console.error("API Error /api/promises/update-details:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
