import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0'

const url = Deno.env.get('SUPABASE_URL')!
const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const origins = (Deno.env.get('APP_ORIGINS') ?? 'http://localhost:5173').split(',').map(item => item.trim())
const admin = createClient(url, adminKey, { auth: { persistSession: false } })
const usernamePattern = /^[a-z0-9_]{3,24}$/

function response(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  } })
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') ?? ''
  if (!origins.includes(origin)) return new Response('Forbidden', { status: 403 })
  if (request.method === 'OPTIONS') return response({}, 200, origin)
  if (request.method !== 'POST') return response({ error: 'Método inválido.' }, 405, origin)
  try {
    const raw = await request.text()
    if (raw.length > 1000) return response({ error: 'Dados inválidos.' }, 400, origin)
    const input = JSON.parse(raw)
    const action = input.action
    const username = String(input.username ?? '').toLowerCase()
    const password = String(input.password ?? '')
    if (!usernamePattern.test(username) || password.length < 1 || password.length > 128)
      return response({ error: 'Nome de usuário ou senha inválidos.' }, 400, origin)
    // The username bucket is independent of any client-controlled IP header.
    const bucket = `${action}:${await sha256(username)}`
    const { data: allowed, error: rateError } = await admin.rpc('check_account_rate', { p_bucket: bucket, p_limit: action === 'login' ? 8 : 4, p_seconds: 900 })
    if (rateError || !allowed) return response({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429, origin)

    if (action === 'login') {
      const { data: profile } = await admin.from('profiles').select('id').eq('username', username).eq('active', true).maybeSingle()
      if (!profile) return response({ error: 'Nome de usuário ou senha inválidos.' }, 401, origin)
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(profile.id)
      if (accountError || !account.user?.email) return response({ error: 'Nome de usuário ou senha inválidos.' }, 401, origin)
      const publicClient = createClient(url, anonKey, { auth: { persistSession: false } })
      const { data, error } = await publicClient.auth.signInWithPassword({ email: account.user.email, password })
      if (error || !data.session) return response({ error: 'Nome de usuário ou senha inválidos.' }, 401, origin)
      return response({ session: data.session }, 200, origin)
    }
    if (action === 'register') {
      const token = String(input.token ?? '')
      if (!/^[a-f0-9]{64}$/.test(token) || password.length < 12)
        return response({ error: 'Convite ou senha inválidos. Use uma senha de 12 a 128 caracteres.' }, 400, origin)
      const hash = await sha256(token)
      const { data: invite } = await admin.from('invites').select('id').eq('token_hash', hash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (!invite) return response({ error: 'Convite inválido, expirado ou já utilizado.' }, 403, origin)
      const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
      if (existing) return response({ error: 'Este nome de usuário já está em uso.' }, 409, origin)
      const technicalId = crypto.randomUUID()
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: `${technicalId}@users.conex.invalid`, password, email_confirm: true, user_metadata: { username },
      })
      if (createError || !created.user) return response({ error: 'Não foi possível criar a conta.' }, 500, origin)
      const id = created.user.id
      try {
        const { error: profileError } = await admin.from('profiles').insert({ id, username })
        if (profileError) throw new Error(profileError.code === '23505' ? 'Este nome de usuário já está em uso.' : 'Não foi possível criar o perfil.')
        const { data: claimed, error: claimError } = await admin.from('invites').update({ used_at: new Date().toISOString(), used_by: id })
          .eq('id', invite.id).is('used_at', null).gt('expires_at', new Date().toISOString()).select('id').maybeSingle()
        if (claimError || !claimed) throw new Error('Convite inválido, expirado ou já utilizado.')
        return response({ ok: true }, 201, origin)
      } catch (cause) {
        await admin.auth.admin.deleteUser(id)
        return response({ error: cause instanceof Error ? cause.message : 'Não foi possível criar a conta.' }, 409, origin)
      }
    }
    return response({ error: 'Ação inválida.' }, 400, origin)
  } catch {
    return response({ error: 'Dados inválidos ou falha temporária.' }, 400, origin)
  }
})
