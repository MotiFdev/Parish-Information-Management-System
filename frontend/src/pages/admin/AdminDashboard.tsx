import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { btnSecondary } from '../../components/ui/styles'
import { useToast } from '../../components/toast/toastContext'
import { RunBackupButton } from '../../features/admin/backup/RunBackupButton'
import { ActiveSessionsPanel } from '../../features/admin/dashboard/ActiveSessionsPanel'
import { getAlerts, getHealth, getSessions, reviewAlert, useLiveData, type HealthReading, type SecurityAlert } from '../../features/admin/dashboard/dashboardApi'
import { SecurityAlertsPanel } from '../../features/admin/dashboard/SecurityAlertsPanel'
import { SystemHealthPanel } from '../../features/admin/dashboard/SystemHealthPanel'
import { timeFormat } from '../../features/admin/format'
import { lastGood, listBackups, type BackupRun, type Database } from '../../features/admin/backupData'
import { createUser } from '../../features/admin/users/usersApi'
import { UserFormDialog } from '../../features/admin/UserFormDialog'
import { AdminLayout } from '../../layouts/AdminLayout'

const dayFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

/** "Today, 2:00 AM", "Yesterday, 2:00 AM", "Nov 3, 2:00 AM", or "never". */
function backupLabel(runs: BackupRun[] | null, db: Database) {
  if (runs === null) return '…'
  const run = lastGood(runs, db)
  if (!run) return 'never'
  const at = new Date(run.at)
  const now = new Date()
  const day =
    dayKey(at) === dayKey(now) ? 'Today' : dayKey(at) === dayKey(new Date(now.getTime() - 86_400_000)) ? 'Yesterday' : dayFormat.format(at)
  return `${day}, ${timeFormat.format(at)}`
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Health and sessions refresh every minute while the page is open; alerts every two.
const HEALTH_EVERY_MS = 60_000
const SESSIONS_EVERY_MS = 60_000
const ALERTS_EVERY_MS = 120_000

function serverSummary(h: HealthReading) {
  const latest = [...h.latency].reverse().find((p) => p.p95Ms !== null)?.p95Ms ?? null
  const ram = h.memoryUsedGb !== null && h.memoryTotalGb ? (h.memoryUsedGb / h.memoryTotalGb) * 100 : null
  const high =
    (h.cpuPercent !== null && h.cpuPercent >= h.limits.cpuPercent) ||
    (ram !== null && ram >= h.limits.memoryPercent) ||
    (latest !== null && latest >= h.limits.latencyMs)
  return high ? 'Server readings are above normal; see System health.' : 'Server load and API response time are normal.'
}

// One sentence that answers "do I need to do anything?" before any panel is read.
function alertSummary(alerts: SecurityAlert[]) {
  const high = alerts.filter((a) => a.severity === 'high').length
  const review = alerts.length - high
  const parts: string[] = []
  if (high) parts.push(`${plural(high, 'alert')} ${high === 1 ? 'needs' : 'need'} action`)
  if (review) parts.push(`${review} to review`)
  return { text: parts.length ? `${parts.join(' and ')}.` : 'No open security alerts.', urgent: high > 0 }
}

export default function AdminDashboard() {
  const { toast } = useToast()
  const health = useLiveData(getHealth, HEALTH_EVERY_MS)
  const sessions = useLiveData(getSessions, SESSIONS_EVERY_MS)
  const alerts = useLiveData(getAlerts, ALERTS_EVERY_MS)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [backups, setBackups] = useState<BackupRun[] | null>(null)
  const loadBackups = useCallback(() => {
    listBackups()
      .then((r) => setBackups(r.runs))
      .catch(() => setBackups((b) => b ?? []))
  }, [])
  useEffect(loadBackups, [loadBackups])

  const alertLine = alerts.state.status === 'ready' ? alertSummary(alerts.state.data) : null
  const serverLine = health.state.status === 'ready' ? serverSummary(health.state.data) : null

  return (
    <AdminLayout activeHref="/admin/dashboard">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Dashboard</h1>
          {(alertLine || serverLine) && (
            <p className="mt-2 max-w-2xl text-lg leading-snug text-stone-700">
              {alertLine && <span className={`font-semibold ${alertLine.urgent ? 'text-red-700' : 'text-forest'}`}>{alertLine.text}</span>}{' '}
              {serverLine}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <RunBackupButton
            onStart={() => setBackingUp(true)}
            onDone={() => {
              setBackingUp(false)
              loadBackups()
            }}
          />
          <button type="button" onClick={() => setAddUserOpen(true)} className={btnSecondary}>
            <Icon name="userPlus" className="size-4.5" />
            Add user
          </button>
        </div>
      </div>

      <p aria-live="polite" className="mt-4 border-t border-stone-300/60 pt-3 text-sm text-stone-600">
        {backingUp ? (
          <span className="font-semibold text-forest">Backing up the relational and vector databases…</span>
        ) : (
          <>
            <span className="font-semibold text-stone-800">Last backup</span> · relational database {backupLabel(backups, 'relational')} · vector
            database {backupLabel(backups, 'vector')}
          </>
        )}
      </p>

      {/* Alerts get the wider column: they are the part of this page that asks for a decision. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <SecurityAlertsPanel
          state={alerts.state}
          onRetry={() => alerts.reload()}
          onReview={async (alert) => {
            await reviewAlert(alert.id)
            alerts.set((list) => list.filter((a) => a.id !== alert.id))
          }}
          className="lg:col-span-7"
        />
        <SystemHealthPanel state={health.state} onCheck={() => health.reload(true)} onRetry={() => health.reload(true)} className="lg:col-span-5" />
      </div>

      <div className="mt-6">
        <ActiveSessionsPanel state={sessions.state} onRetry={() => sessions.reload()} />
      </div>

      <UserFormDialog
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onSave={async (v) => {
          const { inviteSent } = await createUser(v)
          setAddUserOpen(false)
          const name = `${v.firstName} ${v.lastName}`
          toast(
            inviteSent
              ? `Account created for ${name}. A link to set a password was sent to ${v.email}.`
              : `Account created for ${name}, but the email could not be sent. Send a reset link from User Management.`,
          )
        }}
      />
    </AdminLayout>
  )
}
