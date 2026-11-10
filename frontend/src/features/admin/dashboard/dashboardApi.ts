import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { Role } from '../sampleData'

// Client for /api/admin/dashboard/*. Times arrive as ISO strings in UTC and
// are formatted in the viewer's time zone.

export interface HealthReading {
  cpuPercent: number | null
  memoryUsedGb: number | null
  memoryTotalGb: number | null
  measuredAt: Date
  /** p95 per window, oldest first; null where no requests came in. */
  latency: Array<{ windowStart: Date; p95Ms: number | null; requests: number }>
  windowMinutes: number
  limits: { cpuPercent: number; memoryPercent: number; latencyMs: number }
}

export interface ActiveSession {
  id: string
  name: string
  role: Role
  device: 'desktop' | 'phone'
  client: string
  ip: string
  signedInAt: Date | null
  lastActiveAt: Date
  current: boolean
}

export interface SecurityAlert {
  id: string
  severity: 'high' | 'review'
  title: string
  detail: string
  ip: string
  occurrences: number
  lastSeenAt: Date
}

const gb = (bytes: number | null) => (bytes === null ? null : Math.round((bytes / 1024 ** 3) * 10) / 10)

export async function getHealth(fresh = false): Promise<HealthReading> {
  const r = await api<{
    cpu_percent: number | null
    memory_used_bytes: number | null
    memory_total_bytes: number | null
    measured_at: string
    latency: { window_minutes: number; series: Array<{ window_start: string; p95_ms: number | null; requests: number }> }
    limits: { cpu_percent: number; memory_percent: number; latency_ms: number }
  }>(`/api/admin/dashboard/health${fresh ? '?fresh=1' : ''}`)

  return {
    cpuPercent: r.cpu_percent,
    memoryUsedGb: gb(r.memory_used_bytes),
    memoryTotalGb: gb(r.memory_total_bytes),
    measuredAt: new Date(r.measured_at),
    latency: r.latency.series.map((p) => ({ windowStart: new Date(p.window_start), p95Ms: p.p95_ms, requests: p.requests })),
    windowMinutes: r.latency.window_minutes,
    limits: { cpuPercent: r.limits.cpu_percent, memoryPercent: r.limits.memory_percent, latencyMs: r.limits.latency_ms },
  }
}

export async function getSessions(): Promise<ActiveSession[]> {
  const r = await api<{
    data: Array<{
      session_id_hint: string
      name: string
      role: Role
      device: 'desktop' | 'phone'
      client: string
      ip_address: string | null
      signed_in_at: string | null
      last_active_at: string
      is_current: boolean
    }>
  }>('/api/admin/dashboard/sessions')

  return r.data.map((s) => ({
    id: s.session_id_hint,
    name: s.name,
    role: s.role,
    device: s.device,
    client: s.client,
    ip: s.ip_address ?? 'Unknown',
    signedInAt: s.signed_in_at ? new Date(s.signed_in_at) : null,
    lastActiveAt: new Date(s.last_active_at),
    current: s.is_current,
  }))
}

export async function getAlerts(): Promise<SecurityAlert[]> {
  const r = await api<{
    data: Array<{ alert_id: string; severity: 'high' | 'review'; title: string; detail: string; ip_address: string; occurrences: number; last_seen_at: string }>
  }>('/api/admin/dashboard/alerts')

  return r.data.map((a) => ({
    id: a.alert_id,
    severity: a.severity,
    title: a.title,
    detail: a.detail,
    ip: a.ip_address,
    occurrences: a.occurrences,
    lastSeenAt: new Date(a.last_seen_at),
  }))
}

export const reviewAlert = (id: string) => api(`/api/admin/dashboard/alerts/${id}/review`, { method: 'POST' })

/* ---------- Loading ---------- */

export type Loaded<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T; refreshing: boolean }

/**
 * Loads once, then again every `everyMs` while the tab is visible. A failed
 * background refresh keeps showing the last good data instead of an error.
 */
export function useLiveData<T>(load: (fresh: boolean) => Promise<T>, everyMs: number) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' })

  // `load` should be a stable function (the module-level getters above); a new one restarts polling.
  const run = useCallback(async (fresh: boolean) => {
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : { status: 'loading' }))
    try {
      const data = await load(fresh)
      setState({ status: 'ready', data, refreshing: false })
    } catch (e) {
      setState((s) =>
        s.status === 'ready' ? { ...s, refreshing: false } : { status: 'error', message: e instanceof Error ? e.message : 'Request failed.' },
      )
    }
  }, [load])

  useEffect(() => {
    void run(false)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run(false)
    }, everyMs)
    return () => window.clearInterval(timer)
  }, [run, everyMs])

  /** `fresh` asks the server to measure now instead of using its short cache. */
  const reload = useCallback((fresh = false) => run(fresh), [run])
  const set = useCallback((update: (data: T) => T) => setState((s) => (s.status === 'ready' ? { ...s, data: update(s.data) } : s)), [])

  return { state, reload, set }
}
