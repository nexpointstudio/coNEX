export function validateNewPassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new Error('A senha deve ter de 8 a 128 caracteres.')
  }
  return password
}
