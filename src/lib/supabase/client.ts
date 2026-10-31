import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && anonKey)
const rememberKey = 'conex.remember'
const authKey = 'conex.auth'

export function setRemember(value: boolean) {
  localStorage.setItem(rememberKey, value ? '1' : '0')
  if (value) {
    const existing = sessionStorage.getItem(authKey)
    if (existing) localStorage.setItem(authKey, existing)
    sessionStorage.removeItem(authKey)
  } else {
    const existing = localStorage.getItem(authKey)
    if (existing) sessionStorage.setItem(authKey, existing)
    localStorage.removeItem(authKey)
  }
}

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        storageKey: authKey,
        storage: {
          getItem: (key) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
          setItem: (key, value) => {
            if (localStorage.getItem(rememberKey) === '1') localStorage.setItem(key, value)
            else sessionStorage.setItem(key, value)
          },
          removeItem: (key) => {
            localStorage.removeItem(key)
            sessionStorage.removeItem(key)
          },
        },
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
