import { createClient, type Session } from '@supabase/supabase-js'
import { createSessionStorage } from './sessionStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && anonKey)
const authKey = 'conex.auth'
const storage = createSessionStorage(localStorage, sessionStorage)

export function setRemember(value: boolean) {
  storage.setRemember(value)
}
export function clearRemember() { storage.clearRemember() }

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        storageKey: authKey,
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null

export async function installSession(session: Session) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw error
}
