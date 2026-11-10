// Works out the next date of a chapel fiesta from its free-text description
// ("May 15", "Last Sunday of September"). Fiesta dates are stored as text
// (section 7.9), so anything this cannot read returns null and the page shows
// the text alone rather than a guessed date.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, last: -1 }
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function dateIn(year: number, text: string): Date | null {
  const t = text.trim().toLowerCase()
  const fixed = t.match(/^([a-z]+)\s+(\d{1,2})$/)
  if (fixed) {
    const m = MONTHS.indexOf(fixed[1])
    return m === -1 ? null : new Date(year, m, Number(fixed[2]))
  }
  const rule = t.match(/^(first|second|third|fourth|last)\s+([a-z]+)\s+of\s+([a-z]+)$/)
  if (!rule) return null
  const m = MONTHS.indexOf(rule[3])
  const wd = DAYS.indexOf(rule[2])
  if (m === -1 || wd === -1) return null
  if (ORDINALS[rule[1]] === -1) {
    const last = new Date(year, m + 1, 0)
    return new Date(year, m, last.getDate() - ((last.getDay() - wd + 7) % 7))
  }
  const first = new Date(year, m, 1)
  return new Date(year, m, 1 + ((wd - first.getDay() + 7) % 7) + (ORDINALS[rule[1]] - 1) * 7)
}

/** The next fiesta on or after today, and how many days away it is. */
export function nextFiesta(text: string, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
    const d = dateIn(year, text)
    if (!d) return null
    if (d >= start) return { date: d, days: Math.round((d.getTime() - start.getTime()) / 86_400_000) }
  }
  return null
}
