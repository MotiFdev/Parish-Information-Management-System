import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { cardClass, inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/toast/toastContext'
import { RestoreDialog } from '../../features/admin/backup/RestoreDialog'
import { RunBackupButton } from '../../features/admin/backup/RunBackupButton'
import {
  databases,
  lastGood,
  listBackups,
  restoreBackup,
  type BackupRun,
  type BackupSchedule,
  type Database,
} from '../../features/admin/backupData'
import { AdminLayout } from '../../layouts/AdminLayout'

const TZ = 'Asia/Manila'
const whenFormat = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
const longFormat = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short', timeZone: TZ })
const errorHelp = 'If it keeps happening, check the server and API logs.'

const when = (r: BackupRun) => whenFormat.format(new Date(r.at))
const size = (bytes: number | null) => {
  if (bytes === null) return ''
  const mb = bytes / 1048576
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
const duration = (ms: number | null) => {
  if (ms === null) return ''
  const s = Math.round(ms / 1000)
  if (s < 1) return 'under 1 s'
  const m = Math.floor(s / 60)
  return m ? `${m} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`
}
const triggerLabel = (r: BackupRun) =>
  r.trigger === 'Manual' ? `Manual${r.by ? `, by ${r.by}` : ''}` : r.trigger === 'Before restore' ? `Before a restore${r.by ? `, by ${r.by}` : ''}` : 'Scheduled'
const scheduleTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const dbOrder: Database[] = ['relational', 'vector']
// Four days of runs; older ones are a click away so Restore isn't pushed far down on phones.
const HISTORY_PREVIEW = 8

function StatusCard({ db, runs, running }: { db: Database; runs: BackupRun[]; running: boolean }) {
  const own = runs.filter((r) => r.db === db)
  const latest = own[0]
  const good = lastGood(runs, db)
  const points = own.filter((r) => r.restorable).length

  return (
    <section aria-labelledby={`status-${db}`} className={`${cardClass} px-5 py-5`}>
      <h2 id={`status-${db}`} className="font-serif text-2xl font-semibold text-stone-900">
        {databases[db].name}
      </h2>
      <p className="mt-1 text-sm text-stone-600">{databases[db].holds}</p>

      <p className="mt-4 flex items-center gap-2 font-semibold" aria-live="polite">
        {running ? (
          <>
            <span className="size-4 rounded-full border-2 border-forest/25 border-t-forest motion-safe:animate-spin" aria-hidden="true" />
            <span className="text-forest">Backing up now…</span>
          </>
        ) : !latest ? (
          <span className="text-stone-700">No backups yet</span>
        ) : latest.result === 'Succeeded' ? (
          <>
            <Icon name="check" className="size-5 text-forest" strokeWidth={2.5} />
            <span className="text-forest">Last backup succeeded</span>
          </>
        ) : (
          <>
            <Icon name="alert" className="size-5 text-red-700" />
            <span className="text-red-700">Last backup failed</span>
          </>
        )}
      </p>
      {!running && latest?.result === 'Failed' && <p className="mt-1 text-sm break-words text-red-800">{latest.error}</p>}

      {good && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-4">
          <div className="col-span-2">
            <dt className="text-stone-600">Last successful backup</dt>
            <dd className="font-semibold text-stone-900">{when(good)}</dd>
          </div>
          <div>
            <dt className="text-stone-600">Size</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">{size(good.sizeBytes)}</dd>
          </div>
          <div>
            <dt className="text-stone-600">Restore points</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">{points}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

export default function BackupPage() {
  const { toast } = useToast()
  const [runs, setRuns] = useState<BackupRun[] | null>(null)
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [restoreDb, setRestoreDb] = useState<Database>('relational')
  const [pointId, setPointId] = useState('')
  const [confirming, setConfirming] = useState<BackupRun | null>(null)
  const [showAll, setShowAll] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const load = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    listBackups()
      .then((res) => {
        if (cancelled) return
        setRuns(res.runs)
        setSchedule(res.schedule)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Request failed.')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const all = runs ?? []
  const points = all.filter((r) => r.db === restoreDb && r.restorable)
  const point = points.find((r) => r.id === pointId) ?? points[0]

  const restore = async () => {
    if (!confirming) return
    const result = await restoreBackup(confirming.id)
    const name = databases[confirming.db].name
    toast(
      result.database === 'relational'
        ? `${name} restored to ${when(confirming)}. The data from before the restore was backed up first.`
        : `${name} restored to ${when(confirming)}: ${result.embeddings_restored} entries${
            result.embeddings_skipped ? `, ${result.embeddings_skipped} skipped for records that no longer exist` : ''
          }.`,
    )
    setConfirming(null)
    setPointId('')
    // After a relational restore the signed-in account may be gone; a failed reload then shows on the page.
    load()
  }

  return (
    <AdminLayout activeHref="/admin/settings/backup">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Backup & Recovery</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Check that both databases are backed up, run a backup on demand, and restore one if something goes wrong.
            {schedule && (
              <>
                {' '}
                Backups run every night at {scheduleTime(schedule.time)}; files older than {schedule.keepDays} days are deleted, except the
                newest one.
              </>
            )}
          </p>
        </div>
        <RunBackupButton
          disabled={runs === null}
          onStart={() => setRunning(true)}
          onDone={() => {
            setRunning(false)
            load()
          }}
          className="shrink-0"
        />
      </div>

      {runs === null ? (
        <div className={`${cardClass} mt-6`}>
          {loadError ? <ErrorState what="backup status" help={`${loadError} ${errorHelp}`} onRetry={() => load()} /> : <LoadingState what="backup status" />}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {dbOrder.map((db) => (
              <StatusCard key={db} db={db} runs={all} running={running} />
            ))}
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-12">
            <section aria-labelledby="history-title" className={`${cardClass} lg:col-span-7`}>
              <header className="border-b border-stone-100 px-5 py-4">
                <h2 id="history-title" className="font-serif text-xl font-semibold text-stone-900">
                  Backup history
                </h2>
              </header>
              {all.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-stone-600">
                  No backups have run yet. Use <span className="font-semibold">Run backup now</span> to make the first one.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-stone-100">
                    {(showAll ? all : all.slice(0, HISTORY_PREVIEW)).map((r) => (
                      <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 px-5 py-3 text-sm">
                        <span className="font-semibold text-stone-900">{databases[r.db].name}</span>
                        <span className={`text-right font-semibold ${r.result === 'Failed' ? 'text-red-700' : 'text-forest'}`}>{r.result}</span>
                        <span className="text-stone-600">
                          {when(r)} · {triggerLabel(r)}
                        </span>
                        <span className="text-right text-stone-600 tabular-nums">
                          {r.result === 'Succeeded'
                            ? `${r.restorable ? size(r.sizeBytes) : 'file deleted'} · ${duration(r.durationMs)}`
                            : duration(r.durationMs)}
                        </span>
                        {r.error && <span className="col-span-2 break-words text-red-800">{r.error}</span>}
                      </li>
                    ))}
                  </ul>
                  {all.length > HISTORY_PREVIEW && (
                    <div className="border-t border-stone-100 px-5 py-2">
                      <button
                        type="button"
                        aria-expanded={showAll}
                        onClick={() => setShowAll((v) => !v)}
                        className="-ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft"
                      >
                        {showAll ? 'Show fewer' : `Show ${all.length - HISTORY_PREVIEW} older backups`}
                        <Icon name="chevronDown" className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section aria-labelledby="restore-title-card" className={`${cardClass} lg:sticky lg:top-24 lg:col-span-5`}>
              <header className="border-b border-stone-100 px-5 py-4">
                <h2 id="restore-title-card" className="font-serif text-xl font-semibold text-stone-900">
                  Restore from a backup
                </h2>
                <p className="mt-0.5 text-sm text-stone-600">Puts one database back to an earlier restore point.</p>
              </header>

              <div className="space-y-4 px-5 py-5">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-stone-700">Database</legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {dbOrder.map((db) => (
                      <label
                        key={db}
                        className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                          restoreDb === db ? 'border-forest bg-forest-soft text-forest' : 'border-stone-300 bg-white text-stone-700 hover:border-forest/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restore-db"
                          value={db}
                          checked={restoreDb === db}
                          onChange={() => {
                            setRestoreDb(db)
                            setPointId('')
                          }}
                          className="size-4 accent-forest"
                        />
                        {databases[db].name}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {points.length === 0 ? (
                  <p className="rounded-lg bg-ivory px-3 py-3 text-sm text-stone-700">
                    Restore points appear here after the first successful backup of the {databases[restoreDb].name.toLowerCase()}.
                  </p>
                ) : (
                  <>
                    <Field label="Restore point" htmlFor="restore-point" hint="Only backups that finished successfully and are still kept are listed.">
                      <select id="restore-point" value={point?.id} onChange={(e) => setPointId(e.target.value)} className={inputClass}>
                        {points.map((r) => (
                          <option key={r.id} value={r.id}>
                            {when(r)} · {size(r.sizeBytes)}
                            {r.trigger === 'Manual' ? ' · manual' : r.trigger === 'Before restore' ? ' · before a restore' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      type="button"
                      onClick={() => setConfirming(point)}
                      disabled={running}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-700/40 bg-white px-5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="refresh" className="size-4.5" />
                      Restore {databases[restoreDb].name.toLowerCase()}…
                    </button>
                    {running && <p className="text-sm text-stone-600">Restoring is available again once the backup finishes.</p>}
                  </>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <RestoreDialog
        run={confirming}
        when={confirming ? longFormat.format(new Date(confirming.at)) : ''}
        onClose={() => setConfirming(null)}
        onConfirm={restore}
      />
    </AdminLayout>
  )
}
