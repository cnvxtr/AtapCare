import { createClient } from '@supabase/supabase-js'

// variabel dari file .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ekspor client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)