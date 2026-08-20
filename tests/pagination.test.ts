import { describe, expect, it } from 'vitest'
import { fetchAllPages } from '../src/lib/pagination'

describe('Supabase pagination', () => {
  it('continues when the API enforces a lower row cap than requested', async () => {
    const source = [1, 2, 3, 4, 5]
    const rows = await fetchAllPages<number>(async (from) => ({
      data: source.slice(from, from + 2),
      error: null,
    }))

    expect(rows).toEqual(source)
  })
})
