import { describe, expect, it } from 'vitest'
import { units } from '../src/lib/units'

describe('application units', () => {
  it('uses the shared unit list for expenses and sales', () => {
    expect(units).toEqual(['Piece', 'Kilogram', 'Meter', 'm2', 'm3', 'Box', 'Service'])
    expect(units).not.toContain('Liter')
  })
})
