export function defaultKey(value: string | undefined, prefix: string) {
  if (!value) throw new Error('Chaves do Supabase não configuradas.')

  let keys: unknown
  try {
    keys = JSON.parse(value)
  } catch {
    throw new Error('Formato das chaves do Supabase inválido.')
  }

  const key = keys && typeof keys === 'object' && !Array.isArray(keys)
    ? (keys as Record<string, unknown>).default
    : undefined

  if (typeof key !== 'string' || !key.startsWith(prefix) || key.length <= prefix.length) {
    throw new Error('Chave padrão do Supabase inválida.')
  }

  return key
}
