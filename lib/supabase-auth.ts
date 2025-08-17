import { supabase } from "./supabase-client"

export class SupabaseAuth {
  async signInAnonymously(walletAddress: string) {
    try {
      // Create a deterministic email from wallet address for anonymous auth
      const email = `${walletAddress.toLowerCase()}@wallet.local`
      const password = `wallet_${walletAddress.toLowerCase()}_auth`

      console.log("🔐 Attempting Supabase auth for wallet:", walletAddress)

      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError && signInError.message.includes("Invalid login credentials")) {
        // User doesn't exist, create account
        console.log("👤 Creating new Supabase user for wallet:", walletAddress)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              wallet_address: walletAddress.toLowerCase(),
            },
          },
        })

        if (signUpError) {
          throw new Error(`Failed to create user: ${signUpError.message}`)
        }

        console.log("✅ Supabase auth successful, UID:", signUpData.user?.id)
        return signUpData.user
      } else if (signInError) {
        throw new Error(`Failed to sign in: ${signInError.message}`)
      }

      console.log("✅ Supabase auth successful, UID:", signInData.user?.id)
      return signInData.user
    } catch (error) {
      console.error("❌ Supabase auth failed:", error)
      throw error
    }
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("❌ Sign out failed:", error)
      throw error
    }
    console.log("👋 Signed out from Supabase")
  }

  async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error) {
      console.error("❌ Failed to get current user:", error)
      return null
    }
    return user
  }
}

export const supabaseAuth = new SupabaseAuth()
