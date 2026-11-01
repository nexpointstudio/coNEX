export const usernamePattern = /^[a-z0-9_]{3,24}$/
export const gmailBasePattern = /^[a-z0-9]+(?:\.[a-z0-9]+)*@gmail\.com$/

export function signupEnabled(value: string | undefined) {
  return value === 'true'
}

export function technicalEmail(base: string, id: string) {
  const normalized = base.trim().toLowerCase()
  if (!gmailBasePattern.test(normalized)) throw new Error('ACCOUNT_EMAIL_BASE inválido.')
  if (!/^[0-9a-f]{24}$/.test(id)) throw new Error('Identificador inválido.')
  const mailboxLength = normalized.split('@')[0].length
  if (mailboxLength < 6 || mailboxLength > 30) throw new Error('ACCOUNT_EMAIL_BASE excede o tamanho permitido.')
  return normalized.replace('@gmail.com', `+conex-${id}@gmail.com`)
}

export function validateInput(input: unknown): { action: 'login' | 'register'; username: string; password: string; challenge: string } {
  if (!input || typeof input !== 'object') throw new Error('Dados inválidos.')
  const fields = input as Record<string, unknown>
  if (fields.action !== 'login' && fields.action !== 'register') throw new Error('Ação inválida.')
  const username = typeof fields.username === 'string' ? fields.username.toLowerCase() : ''
  const password = typeof fields.password === 'string' ? fields.password : ''
  if (!usernamePattern.test(username) || !password || password.length > 128)
    throw new Error('Nome de usuário ou senha inválidos.')
  if (fields.action === 'register' && password.length < 8)
    throw new Error('A senha deve ter de 8 a 128 caracteres.')
  return { action: fields.action, username, password, challenge: typeof fields.challenge === 'string' ? fields.challenge : '' }
}
