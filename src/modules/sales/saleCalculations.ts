const SALE_DECIMAL_PLACES = 6
const DECIMAL_PATTERN = /^(?:\d+|\d*\.\d+)$/

interface ParsedDecimal {
  units: bigint
  scale: number
}

function parseSaleDecimal(value: string): ParsedDecimal | null {
  const normalized = value.trim()
  if (!DECIMAL_PATTERN.test(normalized)) return null

  const [wholePart = '', fractionPart = ''] = normalized.split('.')
  if (fractionPart.length > SALE_DECIMAL_PLACES) return null

  const digits = `${wholePart || '0'}${fractionPart}`.replace(/^0+(?=\d)/, '')
  return { units: BigInt(digits || '0'), scale: fractionPart.length }
}

export function calculateSaleAmount(quantity: string, unitPrice: string): string | null {
  const parsedQuantity = parseSaleDecimal(quantity)
  const parsedUnitPrice = parseSaleDecimal(unitPrice)
  if (!parsedQuantity || !parsedUnitPrice || parsedQuantity.units <= 0n || parsedUnitPrice.units <= 0n) return null

  const product = parsedQuantity.units * parsedUnitPrice.units
  const productScale = parsedQuantity.scale + parsedUnitPrice.scale
  let cents: bigint

  if (productScale <= 2) {
    cents = product * (10n ** BigInt(2 - productScale))
  } else {
    const divisor = 10n ** BigInt(productScale - 2)
    cents = (product + (divisor / 2n)) / divisor
  }

  if (cents <= 0n) return null
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}
