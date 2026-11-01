

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0'
import { signupEnabled, technicalEmail, validateInput } from './policy.ts'
import { defaultKey } from './keys.ts'

const url = Deno.env.get('SUPABASE_URL')!
const adminKey = defaultKey(Deno.env.get('SUPABASE_SECRET_KEYS'), 'sb_secret_')
const anonKey = defaultKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), 'sb_publishable_')

const origins = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

const admin = createClient(url, adminKey, {
  auth: { persistSession: false },
})

function response(
  body: Record<string, unknown>,
  status: number,
  origin: string,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    },
  })
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(bytes), byte =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function checkRate(
  bucket: string,
  limit: number,
  seconds: number,
) {
  const { data, error } = await admin.rpc(
    'check_account_rate',
    {
      p_bucket: bucket,
      p_limit: limit,
      p_seconds: seconds,
    },
  )

  return !error && data === true
}

async function verifyChallenge(token: string, origin: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret || !token || token.length > 2048) return false
  const body = new URLSearchParams({ secret, response: token })
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(8000),
  })
  if (!result.ok) return false
  const data = await result.json()
  return data.success === true && data.hostname === new URL(origin).hostname
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') ?? ''

  if (!origins.includes(origin)) {
    return new Response('Forbidden', { status: 403 })
  }

  if (request.method === 'OPTIONS') {
    return response({}, 200, origin)
  }

  if (request.method !== 'POST') {
    return response(
      { error: 'Método não permitido.' },
      405,
      origin,
    )
  }

  try {
    const raw = await request.text()

    if (raw.length > 1000) {
      return response(
        { error: 'Dados inválidos.' },
        400,
        origin,
      )
    }

    const { action, username, password, challenge } = validateInput(JSON.parse(raw))

    if (action === 'login') {
      const bucket = `login:${await sha256(username)}`

      if (!(await checkRate(bucket, 8, 900))) {
        return response(
          { error: 'Muitas tentativas. Tente novamente mais tarde.' },
          429,
          origin,
        )
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .eq('active', true)
        .maybeSingle()

      if (!profile) {
        return response(
          { error: 'Nome de usuário ou senha inválidos.' },
          401,
          origin,
        )
      }

      const { data: account, error: accountError } =
        await admin.auth.admin.getUserById(profile.id)

      if (accountError || !account.user?.email) {
        return response(
          { error: 'Nome de usuário ou senha inválidos.' },
          401,
          origin,
        )
      }

      const publicClient = createClient(url, anonKey, {
        auth: { persistSession: false },
      })

      const { data, error } =
        await publicClient.auth.signInWithPassword({
          email: account.user.email,
          password,
        })

      if (error || !data.session) {
        return response(
          { error: 'Nome de usuário ou senha inválidos.' },
          401,
          origin,
        )
      }

      return response(
        { session: data.session },
        200,
        origin,
      )
    }

    // CADASTRO SEM CONVITE

    if (!signupEnabled(Deno.env.get('ALLOW_PUBLIC_SIGNUP'))) {
      return response(
        { error: 'Novos cadastros estão temporariamente fechados.' },
        403,
        origin,
      )
    }

    const emailBase = Deno.env.get('ACCOUNT_EMAIL_BASE') ?? ''
    let email: string
    try {
      email = technicalEmail(emailBase, Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join(''))
    } catch {
      return response({ error: 'Cadastro indisponível no momento.' }, 503, origin)
    }
    let verified = false
    try {
      verified = await verifyChallenge(challenge, origin)
    } catch {
      return response({ error: 'Verificação temporariamente indisponível.' }, 503, origin)
    }
    if (!verified) {
      return response({ error: 'Verificação de segurança inválida ou expirada.' }, 403, origin)
    }

    const bucket = `register:${await sha256(username)}`
    if (!(await checkRate(bucket, 4, 900))) {
      return response({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429, origin)
    }

    const { data: existing, error: lookupError } =
      await admin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

    if (lookupError) {
      return response(
        { error: 'Não foi possível verificar o cadastro.' },
        503,
        origin,
      )
    }

    if (existing) {
      return response(
        { error: 'Este nome de usuário já está em uso.' },
        409,
        origin,
      )
    }

    // O limite global não é consumido por tokens inválidos ou nomes já existentes.
    if (!(await checkRate('register:global', 6, 3600))) {
      return response({ error: 'Limite temporário de cadastros atingido.' }, 429, origin)
    }


    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      })

    if (createError || !created.user) {
      console.error(
        'Falha ao criar usuário no Supabase Auth:',
        createError?.code ?? 'unknown',
      )

      return response(
        { error: 'Não foi possível criar a conta.' },
        500,
        origin,
      )
    }

    const userId = created.user.id

    const { error: profileError } = await admin
      .from('profiles')
      .insert({
        id: userId,
        username,
      })

    if (profileError) {
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(userId)

      if (cleanupError) console.error('Falha na limpeza de conta incompleta:', cleanupError.code ?? 'unknown')

      return response(
        {
          error:
            profileError.code === '23505'
              ? 'Este nome de usuário já está em uso.'
              : 'Não foi possível concluir o cadastro.',
        },
        profileError.code === '23505' ? 409 : 500,
        origin,
      )
    }

    return response(
      { ok: true },
      201,
      origin,
    )
  } catch (cause) {
    return response(
      { error: cause instanceof Error && ['Dados inválidos.', 'Ação inválida.', 'Nome de usuário ou senha inválidos.', 'A senha deve ter de 8 a 128 caracteres.'].includes(cause.message) ? cause.message : 'Dados inválidos ou falha temporária.' },
      400,
      origin,
    )
  }
})
