const MONEY_SCALE = 100

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE
}

export function sumMoney(values: Iterable<number>) {
  let minorUnits = 0
  for (const value of values) minorUnits += Math.round(value * MONEY_SCALE)
  return minorUnits / MONEY_SCALE
}
