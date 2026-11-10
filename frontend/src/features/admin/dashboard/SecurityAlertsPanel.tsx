import { useRef, useState } from 'react'
import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import { useToast } from '../../../components/toast/toastContext'
import { ApiError } from '../../../lib/api'
import type { Loaded, SecurityAlert } from './dashboardApi'
import { dayTime } from './time'

const severity: Record<SecurityAlert['severity'], { label: string; tile: string; text: string }> = {
  high: { label: 'Needs action', tile: 'bg-red-50 text-red-700', text: 'text-red-700' },
  review: { label: 'Review', tile: 'bg-gold-soft text-brown', text: 'text-brown' },
}

interface Props {
  state: Loaded<SecurityAlert[]>
  /** Saves the review on the server; the panel removes the alert once it resolves. */
  onReview: (alert: SecurityAlert) => Promise<void>
  onRetry: () => void
  className?: string
}

export function SecurityAlertsPanel({ state, onReview, onRetry, className = '' }: Props) {
  const { toast } = useToast()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const alerts = state.status === 'ready' ? state.data : []

  const markReviewed = async (alert: SecurityAlert) => {
    setSaving(alert.id)
    try {
      await onReview(alert)
      toast(`Marked “${alert.title}” as reviewed.`)
      // The button that had focus is gone; keep keyboard users in the panel.
      headingRef.current?.focus()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save the review. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section aria-labelledby="alerts-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <h2 id="alerts-title" ref={headingRef} tabIndex={-1} className="font-serif text-xl font-semibold text-stone-900">
          Security alerts
        </h2>
        {alerts.length > 0 && <span className="text-sm font-semibold text-stone-600 tabular-nums">{alerts.length} open</span>}
      </header>

      {state.status === 'loading' ? (
        <LoadingState what="security alerts" />
      ) : state.status === 'error' ? (
        <ErrorState what="security alerts" help="If it keeps happening, check the server and API logs." onRetry={onRetry} />
      ) : alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-12 text-center">
          <Icon name="shield" className="size-7 text-forest" />
          <p className="font-semibold text-stone-800">No open alerts</p>
          <p className="max-w-sm text-sm text-stone-600">
            Repeated failed sign-ins, and staff, clergy, or administrator sign-ins from a new address, show up here for review.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {alerts.map((alert) => {
            const s = severity[alert.severity]
            return (
              <li key={alert.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${s.tile}`}>
                  <Icon name={alert.severity === 'high' ? 'lock' : 'alert'} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    <span className={s.text}>{s.label}</span>
                    <span className="text-stone-500">
                      {' '}
                      · {dayTime(alert.lastSeenAt)}
                      {alert.occurrences > 1 && ` · happened ${alert.occurrences} times`}
                    </span>
                  </p>
                  <h3 className="mt-0.5 font-semibold text-stone-900">{alert.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{alert.detail}</p>
                  <p className="mt-1.5 text-xs text-stone-500">
                    From <span className="font-medium break-all text-stone-700 tabular-nums">{alert.ip}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => markReviewed(alert)}
                  disabled={saving === alert.id}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-semibold text-stone-700 hover:border-forest/50 hover:text-forest disabled:cursor-wait disabled:opacity-60"
                >
                  <Icon name="check" className="size-4" />
                  {saving === alert.id ? 'Saving…' : 'Mark reviewed'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
