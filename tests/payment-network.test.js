import { describe, expect, it } from 'vitest'
import { detectPaymentNetwork, normalizePaymentPhone } from '../src/utils/paymentNetwork.js'

describe('automatic payment network detection', () => {
  it.each(['650', '651', '652', '653', '654', '670', '679', '680', '684', '685', '689'])('detects MTN prefix %s', prefix => {
    expect(detectPaymentNetwork(prefix + '000001')).toBe('mtn')
  })
  it.each(['655', '656', '657', '658', '659', '690', '699'])('detects Orange prefix %s', prefix => {
    expect(detectPaymentNetwork(prefix + '000001')).toBe('orange')
  })
  it.each(['620000001', '660000001', '640000001', '222000001', '67000000', '6700000000', '+234670000001', 'call670000001', ''])('rejects unknown or malformed number %s', phone => {
    expect(detectPaymentNetwork(phone)).toBe('')
  })
  it.each(['670000001', '+237 670 000 001', '237670000001', '00237670000001'])('normalizes %s', phone => {
    expect(normalizePaymentPhone(phone)).toBe('670000001')
    expect(detectPaymentNetwork(phone)).toBe('mtn')
  })
})
