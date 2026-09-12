import { describe, expect, it } from 'vitest'
import {
  calculateRawMaterialReceiptTotals,
  summarizeRawMaterialNames,
  summarizeRawMaterialQuantities,
} from '../src/modules/raw-materials/rawMaterialCalculations'

describe('raw material receipt calculations', () => {
  it('converts invoice value and adds AZN landed costs', () => {
    const totals = calculateRawMaterialReceiptTotals([
      { material_name: 'Steel hinges', category: 'Hardware & fasteners', specification: null, quantity: 12, unit: 'Box', unit_price: 8.5 },
      { material_name: 'Nails', category: 'Hardware & fasteners', specification: null, quantity: 30, unit: 'Kilogram', unit_price: 2.25 },
    ], [
      { cost_type: 'Transportation', description: null, amount_azn: 75.2 },
      { cost_type: 'Customs duty', description: null, amount_azn: 24.8 },
    ], 1.7)

    expect(totals).toEqual({
      purchaseCostOriginal: 169.5,
      purchaseCostAzn: 288.15,
      additionalCostAzn: 100,
      landedCostAzn: 388.15,
    })
  })

  it('summarizes mixed units and material names without implying stock', () => {
    const items = [
      { material_name: 'Nails', quantity: 10, unit: 'Kilogram' },
      { material_name: 'Nails', quantity: 2.5, unit: 'Kilogram' },
      { material_name: 'Machine', quantity: 1, unit: 'Piece' },
      { material_name: 'Hinges', quantity: 4, unit: 'Box' },
    ]

    expect(summarizeRawMaterialQuantities(items)).toBe('12.5 Kilogram, 1 Piece, 4 Box')
    expect(summarizeRawMaterialNames(items)).toBe('Nails, Machine +1 more')
  })
})
