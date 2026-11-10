import { useState } from 'react'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary } from '../../../components/ui/styles'
import { useToast } from '../../../components/toast/toastContext'
import { databases, runBackup, type BackupRun } from '../backupData'

interface Props {
  onStart?: () => void
  /** The two new runs, or null when the backup could not start. */
  onDone?: (runs: BackupRun[] | null) => void
  disabled?: boolean
  className?: string
}

// Shared by the dashboard quick action and Backup & Recovery.
export function RunBackupButton({ onStart, onDone, disabled, className = '' }: Props) {
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)

  const start = async () => {
    setConfirmOpen(false)
    setRunning(true)
    onStart?.()
    try {
      const runs = await runBackup()
      const failed = runs.filter((r) => r.result === 'Failed')
      toast(
        failed.length
          ? `Backup failed for the ${failed.map((r) => databases[r.db].name.toLowerCase()).join(' and ')}. ${failed[0].error ?? ''}`
          : 'Backup finished for both databases.',
      )
      onDone?.(runs)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The backup could not start. Try again.')
      onDone?.(null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setConfirmOpen(true)} disabled={running || disabled} className={`${btnPrimary} ${className}`}>
        {running ? (
          <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <Icon name="database" className="size-4.5" />
        )}
        {running ? 'Backing up…' : 'Run backup now'}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void start()}
        title="Run a backup now?"
        confirmLabel="Start backup"
      >
        <p>
          This backs up both databases: the relational database (parishioners, sacramental records, requests, and accounts) and
          the vector database used by AI record search. It usually takes under a minute.
        </p>
      </ConfirmDialog>
    </>
  )
}
