
import type { Session } from '@supabase/supabase-js'
import {
  installSession,
  clearRemember,
  setRemember,
  supabase,
} from '../../lib/supabase/client'
import { validateUsername } from './validation'
import { validateNewPassword } from './password'

// Comunicação com a Edge Function do Supabase
async function invokeAuth(
  action: 'login' | 'register',
  body: Record<string, string>,
) {
  if (!supabase) {
    throw new Error('Supabase não configurado.')
  }

  const { data, error } = await supabase.functions.invoke(
    'account',
    {
      body: {
        action,
        ...body,
      },
    },
  )

  if (error) {
    const details = await error.context
      ?.json?.()
      .catch(() => null)

    throw new Error(
      details?.error ??
      'Não foi possível conectar ao serviço de contas.',
    )
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data as {
    session?: Session
    ok?: boolean
  }
}

// Cadastro com nome de usuário e senha
export async function register(
  username: string,
  password: string,
  challenge: string,
) {
  const normalized = validateUsername(username)

  validateNewPassword(password)
  if (!challenge) throw new Error('Conclua a verificação de segurança.')

  await invokeAuth('register', {
    username: normalized,
    password,
    challenge,
  })
}

// Login
export async function login(
  username: string,
  password: string,
  remember: boolean,
) {
  const normalized = validateUsername(username)

  const response = await invokeAuth('login', {
    username: normalized,
    password,
  })

  if (!response.session) {
    throw new Error('Resposta de login inválida.')
  }

  setRemember(remember)

  await installSession(response.session)
}

// Encerrar sessão
export async function logout() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error('Não foi possível sair. Tente novamente.')
  clearRemember()
}
