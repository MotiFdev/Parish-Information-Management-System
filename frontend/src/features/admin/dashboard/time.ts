import { timeFormat } from '../format'

const dayAndTime = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** "8:02 AM" today, "Yesterday, 4:48 PM", otherwise "Nov 3, 8:02 AM". */
export function clockTime(at: Date, now = new Date()) {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(at, now)) return timeFormat.format(at)
  if (sameDay(at, yesterday)) return `Yesterday, ${timeFormat.format(at)}`
  return dayAndTime.format(at)
}

/** "Now", "4 min ago", "2 hr ago", then a clock time. */
export function relativeTime(at: Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 6 * 60) return `${Math.floor(minutes / 60)} hr ago`
  return clockTime(at, now)
}

/** "Today, 9:58 AM" style, for alert times. */
export function dayTime(at: Date, now = new Date()) {
  return sameDay(at, now) ? `Today, ${timeFormat.format(at)}` : clockTime(at, now)
}
