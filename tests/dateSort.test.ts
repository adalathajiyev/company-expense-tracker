import { describe, expect, it } from 'vitest'
import { sortByEnteredDateDesc } from '../src/lib/dateSort'

describe('entered-date sorting', () => {
  it('sorts by the user-entered date before creation time', () => {
    const rows = [
      { id: 'new-backdated', enteredDate: '2026-07-10', createdAt: '2026-08-21T10:00:00Z' },
      { id: 'older-current', enteredDate: '2026-08-20', createdAt: '2026-08-20T10:00:00Z' },
      { id: 'newer-current', enteredDate: '2026-08-20', createdAt: '2026-08-20T11:00:00Z' },
    ]

    const sorted = sortByEnteredDateDesc(rows, (row) => row.enteredDate, (row) => row.createdAt)

    expect(sorted.map((row) => row.id)).toEqual(['newer-current', 'older-current', 'new-backdated'])
  })
})
