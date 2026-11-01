const rememberKey = 'conex.remember'
const authKey = 'conex.auth'

export function createSessionStorage(local: Storage, session: Storage) {
  return {
    setRemember(value: boolean) {
      local.setItem(rememberKey, value ? '1' : '0')
      if (value) {
        const existing = session.getItem(authKey)
        if (existing) local.setItem(authKey, existing)
        session.removeItem(authKey)
      } else {
        const existing = local.getItem(authKey)
        if (existing) session.setItem(authKey, existing)
        local.removeItem(authKey)
      }
    },
    getItem(key: string) { return session.getItem(key) ?? local.getItem(key) },
    setItem(key: string, value: string) {
      if (local.getItem(rememberKey) === '1') local.setItem(key, value)
      else session.setItem(key, value)
    },
    removeItem(key: string) { local.removeItem(key); session.removeItem(key) },
    clearRemember() { local.removeItem(rememberKey) },
  }
}
