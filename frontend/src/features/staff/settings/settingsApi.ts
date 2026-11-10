import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { useAuth, type StaffPreferences } from '../../auth/authContext'

// Staff Settings (backend Staff\SettingsController): this person's notification
// choices and page defaults, and the office hours everyone on staff shares.

export type StaffPrefKey = keyof StaffPreferences['notify']
export type StaffDefaults = StaffPreferences['defaults']

export interface StaffSettings extends StaffPreferences {
  office_hours: string
}

export const fallbackDefaults: StaffDefaults = { register: 'Baptism', calendarView: 'month', reportPeriod: 'last12', pageSize: '10' }

export function useStaffSettings() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; value: StaffSettings | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<StaffSettings>('/api/secretary/settings')
      .then((r) => !cancelled && setResult({ attempt, value: r }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const current = result?.attempt === attempt ? result.value : null
  return {
    settings: current === 'error' ? null : current,
    failed: current === 'error',
    reload: () => setAttempt((a) => a + 1),
  }
}

export const saveNotifications = (patch: Partial<Record<StaffPrefKey, boolean>>) =>
  api<StaffSettings>('/api/secretary/settings/notifications', { method: 'PUT', body: patch })

export const saveDefaults = (d: StaffDefaults & { officeHours: string }) =>
  api<StaffSettings>('/api/secretary/settings/defaults', {
    method: 'PUT',
    body: { register: d.register, calendar_view: d.calendarView, report_period: d.reportPeriod, page_size: d.pageSize, office_hours: d.officeHours },
  })

/** Where the office pages open for the signed-in staff member, as chosen in Settings. */
export function useStaffDefaults(): StaffDefaults {
  return useAuth().user?.preferences?.defaults ?? fallbackDefaults
}

/** Keeps the signed-in account in step after a save, so pages pick up the new defaults at once. */
export function useSyncAccount() {
  const { user, setUser } = useAuth()
  return (s: StaffSettings) => user && setUser({ ...user, preferences: { notify: s.notify, defaults: s.defaults } })
}
