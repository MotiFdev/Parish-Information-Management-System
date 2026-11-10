import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'

/** As the form shows it. The API calls the last one "Home". */
export type VenueType = 'Parish Church' | 'Chapel' | 'Client’s Home'

export const apiVenue = (v: VenueType) => (v === 'Client’s Home' ? 'Home' : v)

/** A date ("2026-11-09") and a 24-hour start time ("14:00"), both in parish time. */
export interface Slot {
  date: string
  time: string
}

/** GET /api/public/appointments/availability */
export interface Availability {
  first_date: string
  last_date: string
  times: string[]
  taken: Slot[]
}

/**
 * Open times for a venue. A Chapel venue waits for a chapel to be chosen.
 * `reload` refetches, e.g. after someone else took the chosen time.
 */
export function useAvailability(venue: VenueType, chapelId: number | null) {
  const needsChapel = venue === 'Chapel'
  const query = needsChapel && !chapelId ? null : `venue_type=${encodeURIComponent(apiVenue(venue))}${needsChapel ? `&chapel_id=${chapelId}` : ''}`
  const [state, setState] = useState<{ query: string; data?: Availability; failed?: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!query) return
    let cancelled = false
    api<Availability>(`/api/public/appointments/availability?${query}`)
      .then((data) => !cancelled && setState({ query, data }))
      .catch(() => !cancelled && setState({ query, failed: true }))
    return () => {
      cancelled = true
    }
  }, [query, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const current = state?.query === query ? state : null
  return { waitingForChapel: !query, data: current?.data, failed: current?.failed ?? false, loading: !!query && !current, reload }
}

export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "14:00" -> "2:00 PM" */
export const timeLabel = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const formatSlot = (s: Slot) =>
  `${fromKey(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${timeLabel(s.time)}`

export const sameSlot = (a: Slot | undefined, b: Slot) => !!a && a.date === b.date && a.time === b.time
