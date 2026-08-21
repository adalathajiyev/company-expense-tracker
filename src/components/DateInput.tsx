import DatePicker from 'react-datepicker'

interface Props {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

function fromIsoDate(value?: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 12)
}

function toIsoDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DateInput({ value, onChange, min, max, required, disabled, autoFocus }: Props) {
  return <DatePicker
    selected={fromIsoDate(value)}
    onChange={(date: Date | null) => onChange(date ? toIsoDate(date) : '')}
    minDate={fromIsoDate(min) ?? undefined}
    maxDate={fromIsoDate(max) ?? undefined}
    dateFormat="dd/MM/yyyy"
    placeholderText="DD/MM/YYYY"
    calendarStartDay={1}
    showMonthDropdown
    showYearDropdown
    dropdownMode="select"
    strictParsing
    required={required}
    disabled={disabled}
    autoFocus={autoFocus}
    autoComplete="off"
    wrapperClassName="date-input"
  />
}
