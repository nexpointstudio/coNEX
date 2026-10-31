export const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/

export function validateUsername(value: string) {
  if (!usernamePattern.test(value)) throw new Error('Use 3 a 24 letras, números ou _ no nome de usuário.')
  return value.toLowerCase()
}
