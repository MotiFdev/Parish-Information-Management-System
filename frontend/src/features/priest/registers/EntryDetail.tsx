import type { ReactNode } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { btnSecondary } from '../../../components/ui/styles'
import type { ViewableFile } from '../../../components/DocumentViewer'
import type { RegisterEntry } from '../registerData'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stone-100 px-5 py-5 first:border-t-0">
      <h3 className="mb-3 font-semibold text-stone-900">{title}</h3>
      {children}
    </section>
  )
}

interface Props {
  entry: RegisterEntry
  onViewScan: (scan: ViewableFile) => void
  onClose: () => void
  /** Staff portal: its own footer buttons in place of the priest's read-only note. */
  actions?: ReactNode
  /** Shown above the entry, e.g. a correction waiting for the priest. */
  notice?: ReactNode
}

// Read-only for the priest: changes go through a Record Correction request that
// staff file and the priest approves. Staff reuse it with their own actions.
export function EntryDetail({ entry: e, onViewScan, onClose, actions, notice }: Props) {
  const ref = `Book ${e.register.book}, page ${e.register.page}, line ${e.register.line}`

  return (
    <article aria-labelledby="entry-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-700">
            {e.type} register · {ref}
          </p>
          <h2 id="entry-title" className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {e.subject}
          </h2>
          {!actions && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600">
              <Icon name="lock" className="size-4" />
              Read-only
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notice}
        <Section title="Entry">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {e.details.map(([k, v]) => {
              const changed = e.correction && v.includes(e.correction.to)
              return (
                <div key={k}>
                  <dt className="text-stone-600">{k}</dt>
                  <dd className="font-medium text-stone-900">{changed ? <span className="rounded bg-gold-soft box-decoration-clone px-1">{v}</span> : v}</dd>
                </div>
              )
            })}
          </dl>
        </Section>

        {e.correction && (
          <Section title="Correction history">
            <div className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
              <p className="text-stone-800">
                {e.correction.field}: <span className="text-stone-600 line-through decoration-stone-400">{e.correction.from}</span>
                <span aria-label="changed to" className="px-1 text-stone-500">
                  →
                </span>
                <span className="font-semibold text-stone-900">{e.correction.to}</span>
              </p>
              <p className="mt-1 text-stone-600">
                Approved {e.correction.approvedOn} under {e.correction.request}. The old value is kept in the audit log.
              </p>
            </div>
          </Section>
        )}

        <Section title="Scanned register page">
          {e.scans.length === 0 && <p className="text-sm text-stone-600">No scan of this page yet.</p>}
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 empty:hidden">
            {e.scans.map((s) => (
              <li key={s.file} className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center">
                <span className="flex min-w-0 flex-1 gap-3">
                  <Icon name="book" className="mt-0.5 size-5 shrink-0 text-stone-500" />
                  <span className="min-w-0">
                    <span className="block font-medium text-stone-900">{s.label}</span>
                    <span className="block break-all text-stone-600">{s.file}</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onViewScan(s)}
                  aria-label={`View ${s.label}`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-lg border border-stone-300 bg-white px-3 font-semibold text-stone-700 hover:border-forest/50 hover:text-forest max-sm:ml-8 sm:self-auto"
                >
                  <Icon name="eye" className="size-4" />
                  View
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {actions ? (
        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
          {actions}
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-stone-700 sm:mr-auto">
            Something wrong? Ask the parish office to file a correction. It comes back here for your approval.
          </p>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Close
          </button>
        </div>
      )}
    </article>
  )
}
