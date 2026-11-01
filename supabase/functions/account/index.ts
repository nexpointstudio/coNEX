

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0'

const url = Deno.env.get('SUPABASE_URL')!
const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

const origins = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

const usernamePattern = /^[a-z0-9_]{3,24}$/

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

    const input = JSON.parse(raw)

    if (!input || typeof input !== 'object') {
      return response(
        { error: 'Dados inválidos.' },
        400,
        origin,
      )
    }

    const action = input.action

    if (action !== 'login' && action !== 'register') {
      return response(
        { error: 'Ação inválida.' },
        400,
        origin,
      )
    }

    const username =
      typeof input.username === 'string'
        ? input.username.trim().toLowerCase()
        : ''

    const password =
      typeof input.password === 'string'
        ? input.password
        : ''

    if (
      !usernamePattern.test(username) ||
      password.length < 1 ||
      password.length > 128
    ) {
      return response(
        { error: 'Nome de usuário ou senha inválidos.' },
        400,
        origin,
      )
    }

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

    const signupEnabled =
      Deno.env.get('ALLOW_PUBLIC_SIGNUP') === 'true'

    if (!signupEnabled) {
      return response(
        { error: 'Novos cadastros estão temporariamente fechados.' },
        403,
        origin,
      )
    }

    if (password.length < 12) {
      return response(
        { error: 'A senha deve ter pelo menos 12 caracteres.' },
        400,
        origin,
      )
    }

    const domain = (
      Deno.env.get('ACCOUNT_EMAIL_DOMAIN') ?? ''
    ).trim().toLowerCase()

    if (
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) ||
      /(?:\.invalid|\.test|\.localhost|\.local)$/.test(domain) ||
      domain === 'example.com'
    ) {
      return response(
        { error: 'Domínio interno de contas não configurado.' },
        503,
        origin,
      )
    }

    // Limites iniciais para testes privados:
    // 6 solicitações de cadastro por hora globalmente.
    // 4 tentativas por nome em 15 minutos.
    if (!(await checkRate('register:global', 6, 3600))) {
      return response(
        { error: 'Limite temporário de cadastros atingido.' },
        429,
        origin,
      )
    }

    const bucket = `register:${await sha256(username)}`

    if (!(await checkRate(bucket, 4, 900))) {
      return response(
        { error: 'Muitas tentativas. Tente novamente mais tarde.' },
        429,
        origin,
      )
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

    const technicalEmail =
      `${crypto.randomUUID()}@${domain}`

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: technicalEmail,
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

      if (cleanupError) {
        console.error(
          'Falha na limpeza de conta incompleta:',
          userId,
        )
      }

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
  } catch {
    return response(
      { error: 'Dados inválidos ou falha temporária.' },
      400,
      origin,
    )
  }
})
