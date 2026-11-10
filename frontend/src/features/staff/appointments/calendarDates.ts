// Calendar maths on plain 'YYYY-MM-DD' day keys in the parish's time zone, so a
// 6:00 AM Mass never slips into the previous day for a browser elsewhere.

const TZ = 'Asia/Manila'
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })

export type View = 'month' | 'week' | 'day'

export const dayKey = (iso: string | Date) => keyFmt.format(typeof iso === 'string' ? new Date(iso) : iso)
export const todayKey = () => dayKey(new Date())

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const fmt = (d: Date) => d.toISOString().slice(0, 10)

export const addDays = (key: string, n: number) => {
  const d = parse(key)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}
export const addMonths = (key: string, n: number) => {
  const d = parse(key)
  return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}
/** Weeks start on Sunday, as parish calendars do. */
export const startOfWeek = (key: string) => addDays(key, -parse(key).getUTCDay())

/** Six rows of seven days covering the month that holds `key`. */
export function monthGrid(key: string) {
  const d = parse(key)
  const first = fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)))
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7)

const monthTitle = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayTitle = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const weekdayShort = (key: string) => new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' }).format(parse(key))
export const dayNumber = (key: string) => parse(key).getUTCDate()
export const longDay = (key: string) => dayTitle.format(parse(key))

export function rangeTitle(view: View, key: string) {
  if (view === 'month') return monthTitle.format(parse(key))
  if (view === 'day') return dayTitle.format(parse(key))
  const s = startOfWeek(key)
  return `${shortDay.format(parse(s))} to ${shortDay.format(parse(addDays(s, 6)))}, ${s.slice(0, 4)}`
}

export const timeOf = (iso: string) => new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(iso))
export const whenOf = (iso: string) => new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(iso))
