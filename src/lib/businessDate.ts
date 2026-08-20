export const BUSINESS_TIME_ZONE = 'Asia/Baku'

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const displayDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const displayDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function parseDate(value: string | Date) {
  if (value instanceof Date) return value
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
}

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

export function formatDate(value: string | Date) {
  return displayDateFormatter.format(parseDate(value))
}

export function formatDateTime(value: string | Date) {
  return displayDateTimeFormatter.format(parseDate(value))
}

export function formatMonth(value: string) {
  const [year, month] = value.slice(0, 7).split('-')
  return `${month}/${year}`
}
