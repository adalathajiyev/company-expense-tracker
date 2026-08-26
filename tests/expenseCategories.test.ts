import { describe, expect, it } from 'vitest'
import { categories, createEmptyExpense } from '../src/modules/expenses/constants'

describe('expense categories', () => {
  it('uses the company expense categories in the requested order', () => {
    expect(categories).toEqual([
      'Other Projects',
      'Owner Costs',
      'Truck Costs',
      'Kitchen',
      'Office',
      'Salaries',
      'Government',
      'Maintenance',
      'Factory',
      'Raw Materials',
    ])
  })

  it('defaults new expenses to Office', () => {
    expect(createEmptyExpense().category).toBe('Office')
  })
})
