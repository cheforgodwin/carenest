import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertPhoneClaim,
  assertTransition,
  calculatePeerDeliveryQuote,
  coordinates,
  hashSecret,
  isTerminalDeliveryStatus,
  makeInvitationToken,
  makeOtp,
  normalizeCameroonPhone,
  safeDeliverySummary,
} from '../api/_peerDelivery.js'

afterEach(() => vi.unstubAllEnvs())

describe('peer-delivery server primitives', () => {
  it('normalizes only valid Cameroon mobile numbers', () => {
    expect(normalizeCameroonPhone('670 000 001')).toBe('+237670000001')
    expect(normalizeCameroonPhone('+237 670-000-001')).toBe('+237670000001')
    expect(normalizeCameroonPhone('12345')).toBe('')
  })

  it('requires the verified Firebase phone claim to match the delivery phone', () => {
    expect(assertPhoneClaim({ phone_number: '+237670000001' }, '670000001')).toBe('+237670000001')
    expect(() => assertPhoneClaim({ phone_number: '+237670000002' }, '670000001')).toThrow('Verify this Cameroon phone number')
    expect(() => assertPhoneClaim({}, '670000001')).toThrow('Verify this Cameroon phone number')
  })

  it('rejects invalid coordinates and status transitions', () => {
    expect(coordinates({ lat: 3.9, lng: 11.5 })).toEqual({ lat: 3.9, lng: 11.5 })
    expect(coordinates({ lat: null, lng: 11.5 })).toBeNull()
    expect(coordinates({ lat: 95, lng: 11 })).toBeNull()
    expect(assertTransition('awaiting_recipient', 'awaiting_payment')).toBe('awaiting_payment')
    expect(() => assertTransition('delivered', 'in_transit')).toThrow('transition is not allowed')
    expect(isTerminalDeliveryStatus('declined')).toBe(true)
    expect(isTerminalDeliveryStatus('in_transit')).toBe(false)
  })

  it('requires server pricing configuration and computes an XAF quote', () => {
    expect(() => calculatePeerDeliveryQuote({ pickup: { lat: 3.9, lng: 11.5 }, destination: { lat: 3.8, lng: 11.6 } })).toThrow('pricing is not configured')
    vi.stubEnv('PEER_DELIVERY_BASE_FEE_XAF', '800')
    vi.stubEnv('PEER_DELIVERY_PER_KM_XAF', '100')
    vi.stubEnv('PEER_DELIVERY_PER_KG_XAF', '200')
    const quote = calculatePeerDeliveryQuote({ pickup: { lat: 3.9, lng: 11.5 }, destination: { lat: 3.8, lng: 11.6 }, weightKg: 2 })
    expect(quote.currency).toBe('XAF')
    expect(quote.distanceKm).toBeGreaterThan(0)
    expect(quote.deliveryFee).toBeGreaterThan(1200)
    expect(quote.estimateMethod).toBe('straight_line_factor')
  })

  it('generates one-time secret material and omits internal delivery fields from summaries', () => {
    const token = makeInvitationToken()
    const otp = makeOtp()
    expect(token).toHaveLength(43)
    expect(otp).toMatch(/^\d{6}$/)
    expect(hashSecret(otp)).not.toBe(otp)
    const summary = safeDeliverySummary({ status: 'awaiting_recipient', senderId: 'sender', invitationTokenHash: 'secret', pickupOtpHash: 'secret', recipientPhone: '+237670000001' }, 'PD-1')
    expect(summary.id).toBe('PD-1')
    expect(summary.invitationTokenHash).toBeUndefined()
    expect(summary.pickupOtpHash).toBeUndefined()
    expect(summary.recipientPhone).toBeUndefined()
  })
})
