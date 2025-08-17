import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load env variables from .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env.local')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixAllReputations() {
  console.log('🔍 Fetching all users...')

  // Fetch all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id')

  if (usersError) {
    console.error('Error fetching users:', usersError)
    return
  }

  console.log(`Found ${users.length} users. Processing...`)

  for (const user of users) {
    const userId = user.id
    console.log(`\n📌 Checking user: ${userId}`)

    // Fetch promises for the user
    const { data: promises, error: promisesError } = await supabase
      .from('promises')
      .select('*')
      .eq('creator_id', userId)

    if (promisesError) {
      console.error(`Error fetching promises for ${userId}:`, promisesError)
      continue
    }

    if (!promises || promises.length === 0) {
      console.log(`⚠ No promises found for ${userId}, skipping.`)
      continue
    }

    // Example logic: set reputation = number of promises × 10
    const newReputation = promises.length * 10

    const { error: updateError } = await supabase
      .from('users')
      .update({ reputation: newReputation })
      .eq('id', userId)

    if (updateError) {
      console.error(`❌ Error updating reputation for ${userId}:`, updateError)
    } else {
      console.log(`✅ Updated ${userId} reputation to ${newReputation}`)
    }
  }

  console.log('\n🎯 All users processed successfully.')
}

fixAllReputations()
