import type { Session } from '@supabase/supabase-js'
import { installSession, setRemember, supabase } from '../../lib/supabase/client'
import { validateUsername } from './validation'

async function invokeAuth(action: 'login' | 'register', body: Record<string, string>) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.functions.invoke('account', { body: { action, ...body } })
  if (error) {
    const details = await error.context?.json?.().catch(() => null)
    throw new Error(details?.error ?? 'Não foi possível conectar ao serviço de contas.')
  }
  if (data?.error) throw new Error(data.error)
  return data as { session?: Session }
}

export async function login(username: string, password: string, remember: boolean) {
  const normalized = validateUsername(username)
  const response = await invokeAuth('login', { username: normalized, password })
  if (!response.session) throw new Error('Resposta de login inválida.')
  setRemember(remember)
  await installSession(response.session)
}

export async function register(username: string, password: string, token: string) {
  const normalized = validateUsername(username)
  if (password.length < 12 || password.length > 128) throw new Error('A senha deve ter de 12 a 128 caracteres.')
  if (!token) throw new Error('Abra o link de convite para criar sua conta.')
  await invokeAuth('register', { username: normalized, password, token })
}

export async function logout() {
  await supabase?.auth.signOut()
  localStorage.removeItem('conex.remember')
}
