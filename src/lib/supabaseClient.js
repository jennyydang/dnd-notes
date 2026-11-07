import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Falls back to a syntactically valid placeholder so createClient doesn't
// throw at import time when .env hasn't been set up yet — callers should
// check isSupabaseConfigured before relying on real data.
//
// The admin pages (/admin…) keep their own login, so being the admin in
// one tab doesn't sign a player out in another.
const adminPages =
  typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/'))

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { storageKey: adminPages ? 'dnd-notes-auth-admin' : 'dnd-notes-auth' } },
)
