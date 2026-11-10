import { api, apiDownload } from '../../../lib/api'
import type { Role } from '../sampleData'

// Client for /api/admin/audit-logs. Labels, activity groups, and the parish
// time zone all come from the server so new action codes need no frontend change.

export interface AuditEntry {
  id: string
  /** ISO timestamp already in the parish's time zone (e.g. +08:00). */
  at: string
  /** null for actions with no signed-in person, such as a failed sign-in. */
  user: { name: string; role: Role | null } | null
  action: string
  label: string
  category: string | null
  /** Shown in red: failed sign-ins, rejections, deactivations. */
  alert: boolean
  table: string
  recordId: string
  /** Human-readable name for the affected record. */
  record: string
  ip: string
  /** Changed fields: [before, after]. */
  changes: Record<string, [before: string | null, after: string | null]>
  note: string | null
  /** Anything else the action recorded. */
  extra: Record<string, string | null> | null
}

export interface AuditFilters {
  search: string
  category: string
  from: string
  to: string
}

export interface AuditPage {
  entries: AuditEntry[]
  total: number
  perPage: number
  categories: Array<{ key: string; label: string }>
  timezone: string
}

function params(f: AuditFilters) {
  const p = new URLSearchParams()
  if (f.search) p.set('search', f.search)
  if (f.category !== 'all') p.set('category', f.category)
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  return p
}

export async function listAuditLogs(filters: AuditFilters, page: number, perPage: number): Promise<AuditPage> {
  const p = params(filters)
  p.set('page', String(page + 1))
  p.set('per_page', String(perPage))

  const r = await api<{
    data: Array<{
      id: string
      at: string
      user: { name: string; role: Role | null } | null
      action: string
      label: string
      category: string | null
      alert: boolean
      table: string
      record_id: string
      record: string
      ip_address: string
      changes: Record<string, [string | null, string | null]>
      note: string | null
      extra: Record<string, string | null> | null
    }>
    meta: { total: number; per_page: number }
    categories: Array<{ key: string; label: string }>
    timezone: string
  }>(`/api/admin/audit-logs?${p}`)

  return {
    entries: r.data.map((e) => ({
      id: e.id,
      at: e.at,
      user: e.user,
      action: e.action,
      label: e.label,
      category: e.category,
      alert: e.alert,
      table: e.table,
      recordId: e.record_id,
      record: e.record,
      ip: e.ip_address,
      changes: e.changes ?? {},
      note: e.note,
      extra: e.extra,
    })),
    total: r.meta.total,
    perPage: r.meta.per_page,
    categories: r.categories,
    timezone: r.timezone,
  }
}

/** The server builds the file from every matching entry, not just the page on screen. */
export function exportAuditLogs(filters: AuditFilters, format: 'csv' | 'json') {
  const p = params(filters)
  p.set('format', format)
  return apiDownload(`/api/admin/audit-logs/export?${p}`, `audit-log.${format}`)
}
