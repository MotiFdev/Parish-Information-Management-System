import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import type { Sacrament } from '../../priest/sampleData'
import type { EventType } from '../appointments/appointmentsData'

// The staff dashboard (backend Staff\DashboardController): the office's open
// request queue, directory and register totals, the next 7 days of
// appointments, and the latest office work. The AI search card is separate.

export type QueueStatus = 'Pending' | 'Under Verification'

export interface QueueRequest {
  number: string
  recordType: Sacrament
  requestType: 'New Registration' | 'Certificate Request' | 'Record Correction'
  subject: string
  client: string
  submittedAt: string
  status: QueueStatus
  documents: { total: number; verified: number; resubmit: number }
  /** Sent back to the requester to correct their details. */
  detailsReturned: boolean
  /** Who is checking it; set once verification has started. */
  assignee: string | null
}

export interface UpcomingEvent {
  id: string
  type: EventType
  title: string
  start: string
  venue: 'Parish Church' | 'Chapel' | "Client's Home"
  /** Chapel and Sona, for chapel and home events. */
  place: string | null
  status: 'Approved' | 'Pending'
  assigned: string | null
}

export interface OfficeActivity {
  id: string
  by: string
  action: string
  record: string
  details: string
  at: string
}

export interface StaffDashboardData {
  requests: QueueRequest[]
  parishioners: number
  registers: Record<Sacrament, number>
  /** AI Record Search: whether the Gemini key is set, and the score from which a match is strong. */
  ai: { ready: boolean; strong: number }
  events: UpcomingEvent[]
  activity: OfficeActivity[]
}

export function useStaffDashboard() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; value: StaffDashboardData | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<StaffDashboardData>('/api/secretary/dashboard')
      .then((r) => !cancelled && setResult({ attempt, value: r }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const current = result?.attempt === attempt ? result.value : null
  return {
    data: current === 'error' ? null : current,
    failed: current === 'error',
    reload: () => setAttempt((a) => a + 1),
  }
}
