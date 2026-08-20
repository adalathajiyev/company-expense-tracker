import type { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

interface PageResult<T> {
  data: T[] | null
  error: PostgrestError | null
}

export async function fetchAllPages<T>(loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const rows: T[] = []

  let from = 0
  for (;;) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1)
    if (error) throw error

    const page = data ?? []
    if (page.length === 0) return rows
    rows.push(...page)
    // A project may configure a lower API row limit than PAGE_SIZE. Advancing
    // by the actual response length avoids silently treating that cap as EOF.
    from += page.length
  }
}
