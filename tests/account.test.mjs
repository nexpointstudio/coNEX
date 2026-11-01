import test from 'node:test'
import assert from 'node:assert/strict'
import { signupEnabled, technicalEmail, validateInput } from '../supabase/functions/account/policy.ts'
import { validateNewPassword } from '../src/features/auth/password.ts'

test('public signup opens only for explicit true', () => {
  assert.equal(signupEnabled('true'), true)
  for (const value of [undefined, '', 'false', 'TRUE', '1']) assert.equal(signupEnabled(value), false)
})

test('password accepts 8 and 128 characters without truncation', () => {
  assert.equal(validateNewPassword('12345678'), '12345678')
  assert.equal(validateNewPassword('a'.repeat(128)).length, 128)
  assert.throws(() => validateNewPassword('1234567'))
  assert.throws(() => validateNewPassword('a'.repeat(129)))
})

test('server validates signup and login independently', () => {
  assert.equal(validateInput({ action: 'register', username: 'RUBEN', password: '12345678' }).username, 'ruben')
  assert.equal(validateInput({ action: 'login', username: 'RUBEN', password: 'x' }).password, 'x')
  assert.throws(() => validateInput({ action: 'register', username: 'ruben', password: '1234567' }))
  assert.throws(() => validateInput({ action: 'login', username: 'ruben ', password: 'x' }))
  assert.throws(() => validateInput({ action: 'delete', username: 'ruben', password: '12345678' }))
})

test('technical email is a unique Gmail plus alias and rejects other domains', () => {
  const id = '123456781234123412345678'
  assert.equal(technicalEmail('studio@gmail.com', id), 'studio+conex-123456781234123412345678@gmail.com')
  assert.throws(() => technicalEmail('studio@example.com', id))
  assert.throws(() => technicalEmail('bad..name@gmail.com', id))
})
