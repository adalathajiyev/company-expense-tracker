import { roundMoney, sumMoney } from '../../lib/money'
import type { RawMaterialReceiptCostInput, RawMaterialReceiptItemInput } from './types'

export function calculateRawMaterialReceiptTotals(
  items: RawMaterialReceiptItemInput[],
  costs: RawMaterialReceiptCostInput[],
  exchangeRateToAzn: number,
) {
  const purchaseCostOriginal = sumMoney(items.map((item) => item.quantity * item.unit_price))
  const purchaseCostAzn = roundMoney(purchaseCostOriginal * exchangeRateToAzn)
  const additionalCostAzn = sumMoney(costs.map((cost) => cost.amount_azn))

  return {
    purchaseCostOriginal,
    purchaseCostAzn,
    additionalCostAzn,
    landedCostAzn: sumMoney([purchaseCostAzn, additionalCostAzn]),
  }
}

export function formatRawMaterialQuantity(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)
}

export function summarizeRawMaterialQuantities(items: Pick<RawMaterialReceiptItemInput, 'quantity' | 'unit'>[]) {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.unit, (totals.get(item.unit) ?? 0) + Number(item.quantity))
  return [...totals.entries()]
    .map(([unit, quantity]) => `${formatRawMaterialQuantity(quantity)} ${unit}`)
    .join(', ')
}

export function summarizeRawMaterialNames(items: Pick<RawMaterialReceiptItemInput, 'material_name'>[]) {
  const names = [...new Set(items.map((item) => item.material_name.trim()).filter(Boolean))]
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}
