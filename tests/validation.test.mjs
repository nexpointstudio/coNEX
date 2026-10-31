import test from 'node:test'
import assert from 'node:assert/strict'
import { validateUsername } from '../src/features/auth/validation.ts'
import { validateMessage } from '../src/features/chat/types.ts'

test('username normalizes case and rejects invalid or oversized names', () => {
  assert.equal(validateUsername('Ruben_1'), 'ruben_1')
  for (const name of ['ab', 'a'.repeat(25), 'nome com espaço', 'ação', 'x@y']) {
    assert.throws(() => validateUsername(name))
  }
})

test('messages trim whitespace and enforce content limits', () => {
  assert.equal(validateMessage('  Olá  '), 'Olá')
  for (const content of ['', '   ', 'x'.repeat(2001)]) {
    assert.throws(() => validateMessage(content))
  }
})
