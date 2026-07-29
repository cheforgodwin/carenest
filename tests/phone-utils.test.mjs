import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidCameroonPhone, normalizePhoneNumber } from '../src/firebase/phoneUtils.js'

test('normalizes a local Cameroon number without a +237 prefix', () => {
  assert.equal(normalizePhoneNumber('677123456', '237'), '+237677123456')
})

test('accepts a phone already prefixed with +237', () => {
  assert.equal(normalizePhoneNumber('+237677123456', '237'), '+237677123456')
})

test('validates a Cameroon mobile number with the expected pattern', () => {
  assert.equal(isValidCameroonPhone('677123456', '237'), true)
  assert.equal(isValidCameroonPhone('670123456', '237'), true)
  assert.equal(isValidCameroonPhone('123456789', '237'), false)
})
