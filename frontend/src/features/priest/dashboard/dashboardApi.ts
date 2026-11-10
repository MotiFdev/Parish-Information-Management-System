import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { Sacrament } from '../sampleData'

// Dashboard & Analytics figures (backend Priest\DashboardController). The
// certificate queue comes from approvalsApi's useApprovalQueue.

export interface PriestDashboardData {
  /** The last twelve months, oldest first, as 'YYYY-MM'; the last is this month. */
  months: string[]
  parishioners: number
  /** Register entries per month, aligned with `months`, by the sacrament's date. */
  trend: Record<Sacrament, number[]>
  /** January to this month. */
  this_year: Record<Sacrament, number>
  /** Mass intentions scheduled per month (pending and approved), aligned with `months`. */
  mass_bookings: number[]
  corrections_waiting: Record<Sacrament, number>
}

/** 'YYYY-MM' as a Date on the first of that month, for month-name formatting. */
export const monthDate = (m: string) => new Date(`${m}-01T12:00:00+08:00`)

export function usePriestDashboard() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; value: PriestDashboardData | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<PriestDashboardData>('/api/priest/dashboard')
      .then((d) => !cancelled && setResult({ attempt, value: d }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const value = result?.value
  return {
    data: value && value !== 'error' ? value : null,
    failed: result?.attempt === attempt && value === 'error',
    reload: useCallback(() => setAttempt((n) => n + 1), []),
  }
}
