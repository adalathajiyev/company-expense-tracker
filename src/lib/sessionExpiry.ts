export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired after 14 days. Please sign in again.'

export function getSessionExpiryTime(lastSignInAt?: string | null) {
  if (!lastSignInAt) return null

  const signedInAt = Date.parse(lastSignInAt)
  if (!Number.isFinite(signedInAt)) return null

  return signedInAt + SESSION_MAX_AGE_MS
}

export function hasSessionExpired(lastSignInAt?: string | null, now = Date.now()) {
  const expiresAt = getSessionExpiryTime(lastSignInAt)
  return expiresAt === null || now >= expiresAt
}
