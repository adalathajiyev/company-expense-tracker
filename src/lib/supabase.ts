import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function isLegacyServiceRoleKey(value: string) {
  const payload = value.split('.')[1]
  if (!payload) return false
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(normalized)) as { role?: string }
    return decoded.role === 'service_role'
  } catch {
    return false
  }
}

if (!url || !key) throw new Error('Supabase environment variables are not configured.')
if (key.startsWith('sb_secret_') || isLegacyServiceRoleKey(key)) throw new Error('A Supabase secret or service-role key must never be used in the frontend.')

export const supabase = createClient(url, key)
