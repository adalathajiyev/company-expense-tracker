export function sortByEnteredDateDesc<T extends { id: string }>(
  items: readonly T[],
  getEnteredDate: (item: T) => string,
  getCreatedAt: (item: T) => string,
) {
  return [...items].sort((left, right) => (
    getEnteredDate(right).localeCompare(getEnteredDate(left))
    || getCreatedAt(right).localeCompare(getCreatedAt(left))
    || left.id.localeCompare(right.id)
  ))
}
