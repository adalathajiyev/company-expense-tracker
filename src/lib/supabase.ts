import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) throw new Error('Supabase environment variables are not configured.')
if (key.startsWith('sb_secret_')) throw new Error('A Supabase secret key must never be used in the frontend.')

export const supabase = createClient(url, key)
