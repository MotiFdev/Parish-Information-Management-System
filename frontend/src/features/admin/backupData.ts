import { api } from '../../lib/api'

// Backup & Recovery API (/api/admin/backups). The relational database is the
// whole PostgreSQL database (pg_dump); the vector database is the AI search
// embeddings on their own.

export type Database = 'relational' | 'vector'

export const databases: Record<Database, { name: string; holds: string }> = {
  relational: {
    name: 'Relational database',
    holds: 'Parishioners, sacramental records, requests, appointments, accounts, and the audit log, plus a copy of the AI search index.',
  },
  vector: {
    name: 'Vector database',
    holds: 'The embeddings AI record search uses to find records. They can also be rebuilt by re-indexing.',
  },
}

export interface BackupRun {
  id: string
  db: Database
  /** ISO timestamp the backup started. */
  at: string
  trigger: 'Scheduled' | 'Manual' | 'Before restore'
  by: string | null
  result: 'Succeeded' | 'Failed'
  sizeBytes: number | null
  durationMs: number | null
  error: string | null
  /** Succeeded and its file is still kept. */
  restorable: boolean
}

export interface BackupSchedule {
  /** "HH:MM" in the parish time zone. */
  time: string
  timezone: string
  keepDays: number
}

interface ApiRun {
  id: string
  database: Database
  trigger: BackupRun['trigger']
  by: string | null
  status: BackupRun['result']
  size_bytes: number | null
  duration_ms: number | null
  error: string | null
  started_at: string
  restorable: boolean
}

const toRun = (r: ApiRun): BackupRun => ({
  id: r.id,
  db: r.database,
  at: r.started_at,
  trigger: r.trigger,
  by: r.by,
  result: r.status,
  sizeBytes: r.size_bytes,
  durationMs: r.duration_ms,
  error: r.error,
  restorable: r.restorable,
})

/** Newest first. */
export async function listBackups(): Promise<{ runs: BackupRun[]; schedule: BackupSchedule }> {
  const res = await api<{ data: ApiRun[]; schedule: { time: string; timezone: string; keep_days: number } }>('/api/admin/backups')
  return { runs: res.data.map(toRun), schedule: { time: res.schedule.time, timezone: res.schedule.timezone, keepDays: res.schedule.keep_days } }
}

/** Backs up both databases. Resolves once both finish; either may have failed. */
export async function runBackup(): Promise<BackupRun[]> {
  const res = await api<{ data: ApiRun[] }>('/api/admin/backups', { method: 'POST' })
  return res.data.map(toRun)
}

export interface RestoreResult {
  database: Database
  /** The backup of the current data taken just before a relational restore. */
  safety_backup_id: string | null
  embeddings_restored: number | null
  embeddings_skipped: number | null
}

export function restoreBackup(id: string) {
  return api<RestoreResult>(`/api/admin/backups/${id}/restore`, { method: 'POST', body: { confirm: 'RESTORE' } })
}

/** The newest successful backup of one database. */
export const lastGood = (runs: BackupRun[], db: Database) => runs.find((r) => r.db === db && r.result === 'Succeeded')
