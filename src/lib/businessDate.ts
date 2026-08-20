export const BUSINESS_TIME_ZONE = 'Asia/Baku'

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function getBusinessDate(date = new Date()) {
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getBusinessMonth(date = new Date()) {
  return getBusinessDate(date).slice(0, 7)
}

export function isFutureBusinessDate(value: string, date = new Date()) {
  return value > getBusinessDate(date)
}
