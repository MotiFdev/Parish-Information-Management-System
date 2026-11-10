import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { timeLabel } from '../../parishioner/appointments/slots'

export type EventStatus = 'Pending' | 'Approved' | 'Rejected'

/** A GKK or PYA-KKK event as both portals get it (CommunityEvents::present on the backend). */
export interface CommunityEvent {
  event_id: string
  name: string
  venue: string
  /** "2026-11-20" */
  event_date: string
  /** "14:30", parish time */
  start_time: string
  status: EventStatus
  officers: Array<{ officer_id: string; name: string; position: string; ministry: string | null; chapel_name: string | null; term_year: number }>
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  /** The PPC's reason, when rejected. */
  review_note: string | null
}

export interface EventInput {
  name: string
  venue: string
  event_date: string
  start_time: string
  officer_ids: string[]
}

/** "Fri, Nov 20, 2026" from "2026-11-20", without a time zone shift. */
export function formatEventDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Fri, Nov 20, 2026 · 2:30 PM" */
export const formatEventWhen = (e: Pick<CommunityEvent, 'event_date' | 'start_time'>) => `${formatEventDate(e.event_date)} · ${timeLabel(e.start_time)}`

/** Today in the parish's calendar, as "YYYY-MM-DD". */
export function parishToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

/** Loads events from /api/community/events or /api/ppc/events. */
export function useEvents(path: '/api/community/events' | '/api/ppc/events') {
  const [state, setState] = useState<CommunityEvent[] | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ data: CommunityEvent[] }>(path)
      .then((r) => !cancelled && setState(r.data))
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [path, attempt])

  const reload = useCallback(() => {
    setState('loading')
    setAttempt((n) => n + 1)
  }, [])

  /** Puts the server's copy of one event in the list, or takes it out when null. */
  const keep = useCallback((id: string, updated: CommunityEvent | null) => {
    setState((s) => {
      if (typeof s === 'string') return s
      if (!updated) return s.filter((e) => e.event_id !== id)
      return s.some((e) => e.event_id === id) ? s.map((e) => (e.event_id === id ? updated : e)) : [...s, updated]
    })
  }, [])

  return { state, reload, keep }
}

export async function saveEvent(input: EventInput, id?: string) {
  const r = await api<{ data: CommunityEvent }>(id ? `/api/community/events/${id}` : '/api/community/events', { method: id ? 'PATCH' : 'POST', body: input })
  return r.data
}

export async function deleteEvent(id: string) {
  await api(`/api/community/events/${id}`, { method: 'DELETE' })
}

export async function approveEvent(id: string) {
  return (await api<{ data: CommunityEvent }>(`/api/ppc/events/${id}/approve`, { method: 'POST' })).data
}

export async function rejectEvent(id: string, reason: string) {
  return (await api<{ data: CommunityEvent }>(`/api/ppc/events/${id}/reject`, { method: 'POST', body: { reason } })).data
}
