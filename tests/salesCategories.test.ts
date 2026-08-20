import { describe, expect, it } from 'vitest'
import { createEmptySale, saleCategories } from '../src/modules/sales/constants'

describe('sale categories', () => {
  it('provides the controlled category list in display order', () => {
    expect(saleCategories).toEqual([
      'Pallet',
      'Pellet',
      'Furniture',
      'Raw materials',
      'Metal Pipes',
      'Sawdust',
      'Transportation',
      'Other',
    ])
  })

  it('defaults new and migrated sales to Other', () => {
    const sale = createEmptySale()
    expect(sale.category).toBe('Other')
    expect(sale.description).toBeNull()
  })
})
