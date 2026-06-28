import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFundingAmount } from './walletService.js'

test('validateFundingAmount rejects non-positive values', () => {
  assert.throws(() => validateFundingAmount(0), /positive/i)
  assert.throws(() => validateFundingAmount(-10), /positive/i)
  assert.throws(() => validateFundingAmount('5'), /positive/i)
})

test('validateFundingAmount accepts positive monetary values', () => {
  assert.equal(validateFundingAmount(25), 25)
  assert.equal(validateFundingAmount(12.5), 12.5)
})
