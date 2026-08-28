import { describe, expect, it } from 'vitest'
import { getSessionExpiryTime, hasSessionExpired, SESSION_MAX_AGE_MS } from '../src/lib/sessionExpiry'

describe('session expiry', () => {
  const signedInAt = '2026-08-01T10:00:00.000Z'
  const signedInAtMs = Date.parse(signedInAt)

  it('expires exactly 14 days after the last sign-in', () => {
    expect(getSessionExpiryTime(signedInAt)).toBe(signedInAtMs + SESSION_MAX_AGE_MS)
    expect(hasSessionExpired(signedInAt, signedInAtMs + SESSION_MAX_AGE_MS - 1)).toBe(false)
    expect(hasSessionExpired(signedInAt, signedInAtMs + SESSION_MAX_AGE_MS)).toBe(true)
  })

  it('rejects sessions without a trustworthy last sign-in time', () => {
    expect(hasSessionExpired()).toBe(true)
    expect(hasSessionExpired('not-a-date')).toBe(true)
  })
})
