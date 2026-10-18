import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Falls back to a syntactically valid placeholder so createClient doesn't
// throw at import time when .env hasn't been set up yet — callers should
// check isSupabaseConfigured before relying on real data.
//
// Typed with the generated schema (src/types/database.ts), so TypeScript
// callers get checked table names, columns and RPC arguments.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
