export const cashTransferDeleteWindowMs = 24 * 60 * 60 * 1000

export function canDeleteCashTransfer(createdAt: string, now = new Date()) {
  const createdTime = new Date(createdAt).getTime()
  return Number.isFinite(createdTime) && createdTime > now.getTime() - cashTransferDeleteWindowMs
}
