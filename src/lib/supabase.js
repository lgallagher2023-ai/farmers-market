import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Copy .env.example to .env.local and fill in your values.'
  )
}

// Strip any accidental path suffix (e.g. /rest/v1/) — only the origin is needed.
// The client library appends /auth/v1, /rest/v1, etc. itself.
const supabaseUrl = (() => {
  try {
    const { origin } = new URL(rawUrl.trim())
    return origin
  } catch {
    return rawUrl.trim()
  }
})()

export const supabase = createClient(supabaseUrl, supabaseAnonKey.trim(), {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
