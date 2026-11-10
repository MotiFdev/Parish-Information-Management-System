import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { btnDanger, btnPrimary, btnSecondary } from './styles'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  /** While true the confirm button is disabled and shows `busyLabel`. */
  busy?: boolean
  busyLabel?: string
  children: ReactNode
}

export function ConfirmDialog({ open, onClose, onConfirm, title, confirmLabel, tone = 'default', busy = false, busyLabel, children }: Props) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="confirm-title">
      <div className="px-6 pt-5 pb-4">
        <h2 id="confirm-title" className="font-serif text-2xl font-semibold text-stone-900">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-stone-700">{children}</div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`${tone === 'danger' ? btnDanger : btnPrimary} disabled:cursor-wait disabled:opacity-70`}
        >
          {busy ? (busyLabel ?? 'Working…') : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
