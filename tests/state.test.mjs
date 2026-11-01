import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeMessages, isNearBottom } from '../src/features/chat/messageState.ts'
import { unreadCount } from '../src/features/notifications/state.ts'
import { createSessionStorage } from '../src/lib/supabase/sessionStorage.ts'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

test('messages sort consistently and deduplicate realtime overlap', () => {
  const first = { id: 'a', created_at: '2026-10-31T10:00:00Z' }
  const second = { id: 'b', created_at: first.created_at }
  assert.deepEqual(mergeMessages([second], [first, second]).map(message => message.id), ['a', 'b'])
  assert.equal(isNearBottom(1000, 895, 100), true)
  assert.equal(isNearBottom(1000, 200, 100), false)
})

test('notification unread count excludes read items', () => {
  assert.equal(unreadCount([{ read_at: null }, { read_at: '2026-10-31T10:00:00Z' }]), 1)
})

test('remember moves session between tab and persistent storage, then clears', () => {
  const local = memoryStorage()
  const tab = memoryStorage()
  const storage = createSessionStorage(local, tab)
  storage.setItem('conex.auth', 'token')
  assert.equal(tab.getItem('conex.auth'), 'token')
  assert.equal(local.getItem('conex.auth'), null)
  storage.setRemember(true)
  assert.equal(local.getItem('conex.auth'), 'token')
  assert.equal(tab.getItem('conex.auth'), null)
  storage.setRemember(false)
  assert.equal(tab.getItem('conex.auth'), 'token')
  assert.equal(local.getItem('conex.auth'), null)
  storage.removeItem('conex.auth')
  storage.clearRemember()
  assert.equal(storage.getItem('conex.auth'), null)
  assert.equal(local.getItem('conex.remember'), null)
})
