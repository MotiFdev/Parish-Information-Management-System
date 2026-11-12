import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { ApprovalStatus } from '../community/chapels/chapelsData'

/** A chapel as the PPC reviews it (Ppc\ChapelController::presentChapel). */
export interface ReviewChapel {
  chapel_id: number
  name: string
  sona_name: string | null
  patron: string | null
  fiesta_date: string | null
  contact_number: string | null
  fb_account_name: string | null
  approval_status: ApprovalStatus
  created_by: string | null
  reviewed_by: string | null
  review_note: string | null
}

/** An officer as the PPC reviews it (Ppc\ChapelController::presentOfficer). */
export interface ReviewOfficer {
  officer_id: string
  chapel_id: number
  chapel_name: string | null
  sona_name: string | null
  name: string
  position: string
  ministry: string | null
  age: number | null
  contact_number: string | null
  fb_account: string | null
  photo_url: string | null
  term_year: number
  approval_status: ApprovalStatus
  created_by: string | null
  reviewed_by: string | null
  review_note: string | null
}

/** Chapels and officers with one approval status. */
export function useChapelReviews(status: 'Pending' | 'Rejected') {
  const [state, setState] = useState<{ status: string; chapels: ReviewChapel[]; officers: ReviewOfficer[] } | 'error' | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ chapels: ReviewChapel[]; officers: ReviewOfficer[] }>(`/api/ppc/chapels?status=${status}`)
      .then((r) => !cancelled && setState({ status, ...r }))
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [status, attempt])

  const reload = useCallback(() => {
    setState(null)
    setAttempt((n) => n + 1)
  }, [])

  /** Takes decided rows off this list. */
  const drop = useCallback((chapelIds: number[], officerIds: string[]) => {
    setState((s) =>
      s && s !== 'error'
        ? { ...s, chapels: s.chapels.filter((c) => !chapelIds.includes(c.chapel_id)), officers: s.officers.filter((o) => !officerIds.includes(o.officer_id)) }
        : s,
    )
  }, [])

  const current = state && state !== 'error' && state.status === status ? state : null
  return { data: current, failed: state === 'error', reload, drop }
}

export const approveChapel = (id: number) => api(`/api/ppc/chapels/${id}/approve`, { method: 'POST' })

export const rejectChapel = (id: number, reason: string) => api(`/api/ppc/chapels/${id}/reject`, { method: 'POST', body: { reason } })

/** Approves several officers; ones another PPC Officer already decided come back in skipped. */
export const approveOfficers = (ids: string[]) =>
  api<{ approved: string[]; skipped: string[] }>('/api/ppc/officers/approve', { method: 'POST', body: { officer_ids: ids } })

export const rejectOfficer = (id: string, reason: string) => api(`/api/ppc/officers/${id}/reject`, { method: 'POST', body: { reason } })
