const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })

/** Calendar days in the parish's time zone since `iso`, so "yesterday" means yesterday. */
export function waitingDays(iso: string) {
  const day = (d: Date) => new Date(dayKey.format(d)).getTime()
  return Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000)
}

export function waitingText(days: number) {
  if (days <= 0) return 'Sent today'
  if (days === 1) return 'Waiting since yesterday'
  return `Waiting ${days} days`
}

/** Three days or more reads as overdue. */
export const isOverdue = (days: number) => days >= 3
