import type { ReactNode } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary } from '../../../components/ui/styles'
import type { AwaitingRequest } from '../sampleData'
import { isOverdue, waitingDays, waitingText } from '../waiting'
import { dateTime, registerRef, requestTitle } from './labels'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stone-100 px-5 py-5">
      <h3 className="mb-3 font-semibold text-stone-900">{title}</h3>
      {children}
    </section>
  )
}

export type RequestDocument = AwaitingRequest['documents'][number]

interface Props {
  request: AwaitingRequest
  /** Files the priest has verified in this drawer. */
  verifiedDocs: string[]
  onToggleDoc: (file: string) => void
  onViewDoc: (doc: RequestDocument) => void
  onSign: () => void
  onReject: () => void
  onClose: () => void
}

// Drawer content: header and decision bar stay put while the body scrolls.
export function RequestDetail({ request: r, verifiedDocs, onToggleDoc, onViewDoc, onSign, onReject, onClose }: Props) {
  const days = waitingDays(r.verifiedAt)
  const checked = r.documents.filter((d) => verifiedDocs.includes(d.file)).length
  const allChecked = checked === r.documents.length

  return (
    <article aria-labelledby="detail-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-stone-700">{r.number}</span>
          <span className={`font-semibold ${isOverdue(days) ? 'text-brown' : 'text-stone-600'}`}>{waitingText(days)}</span>
        </p>
        <h2 id="detail-title" className="mt-1 font-serif text-3xl font-semibold text-stone-900">
          {requestTitle(r)}
        </h2>
        <p className="text-lg text-stone-700">{r.subject}</p>
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

      <div className="min-h-0 flex-1 overflow-y-auto [&>section:first-child]:border-t-0">

      {/* For corrections the decision is the change itself, so it comes first. */}
      {r.corrections && (
        <Section title="Proposed correction">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-stone-600">
                <tr className="border-b border-stone-200">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Field
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    In the register now
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Proposed
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.corrections.map((c) => (
                  <tr key={c.field} className="border-b border-stone-100 align-top">
                    <th scope="row" className="py-2.5 pr-3 font-medium text-stone-800">
                      {c.field}
                    </th>
                    <td className="py-2.5 pr-3 text-stone-700">{c.from}</td>
                    <td className="py-2.5">
                      <span className="rounded bg-gold-soft px-1.5 py-0.5 font-semibold text-stone-900">{c.to}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-stone-600">Approving updates the register entry. The old and new values are kept in the audit log.</p>
        </Section>
      )}

      <Section title="Secretary check">
        <blockquote className="border-l-2 border-stone-300 pl-3 whitespace-pre-line text-stone-800">{r.remarks}</blockquote>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-600">Checked by</dt>
            <dd className="font-medium text-stone-900">
              {r.verifiedBy}, {dateTime.format(new Date(r.verifiedAt))}
            </dd>
          </div>
          <div>
            <dt className="text-stone-600">Register entry</dt>
            <dd className="font-medium text-stone-900">
              {r.recordType} register · {registerRef(r)}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Documents">
        <p className="-mt-1 mb-3 text-sm text-stone-600">
          The secretary has verified {r.documents.length === 1 ? 'this document' : r.documents.length === 2 ? 'both documents' : `all ${r.documents.length} documents`}. Check each one yourself before signing:{' '}
          <span className="font-semibold text-stone-800 tabular-nums">
            {checked} of {r.documents.length}
          </span>{' '}
          done.
        </p>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {r.documents.map((d) => {
            const mine = verifiedDocs.includes(d.file)
            const name = d.note && d.label === 'Other' ? d.note : d.label
            return (
              <li key={d.file} className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-start">
                <span className="flex min-w-0 flex-1 gap-3">
                  <Icon name="file" className="mt-0.5 size-5 shrink-0 text-stone-500" />
                  <span className="min-w-0">
                    <span className="block font-medium text-stone-900">{name}</span>
                    <span className="block break-all text-stone-600">{d.file}</span>
                    {d.note && d.label !== 'Other' && <span className="mt-0.5 block text-stone-700">{d.note}</span>}
                    <span className="mt-1 flex items-center gap-1 text-xs text-stone-600">
                      <Icon name="check" className="size-3.5 text-forest" strokeWidth={2.5} />
                      Verified by the secretary
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 gap-2 max-sm:ml-8">
                  <button
                    type="button"
                    onClick={() => onViewDoc(d)}
                    aria-label={`View ${name}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 font-semibold text-stone-700 hover:border-forest/50 hover:text-forest"
                  >
                    <Icon name="eye" className="size-4" />
                    View
                  </button>
                  <button
                    type="button"
                    aria-pressed={mine}
                    onClick={() => onToggleDoc(d.file)}
                    aria-label={mine ? `${name} verified by you. Undo` : `Verify ${name}`}
                    className={`inline-flex min-h-11 min-w-28 items-center justify-center gap-1.5 rounded-lg px-3 font-semibold ${
                      mine ? 'bg-forest text-white hover:bg-forest-dark' : 'border border-forest/40 bg-white text-forest hover:bg-forest-soft'
                    }`}
                  >
                    <Icon name="check" className="size-4" strokeWidth={2.5} />
                    {mine ? 'Verified' : 'Verify'}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title={r.requestType === 'New Registration' ? 'Details to register' : 'Details given'}>
        <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
          {r.details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-stone-600">{k}</dt>
              <dd className="font-medium text-stone-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Requested by">
        <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-stone-600">Name</dt>
            <dd className="font-medium text-stone-900">
              {r.client.name} <span className="font-normal text-stone-600">({r.client.relationship.toLowerCase()})</span>
            </dd>
          </div>
          <div>
            <dt className="text-stone-600">Purpose</dt>
            <dd className="font-medium text-stone-900">{r.purpose}</dd>
          </div>
          <div>
            <dt className="text-stone-600">Submitted</dt>
            <dd className="font-medium text-stone-900">{dateTime.format(new Date(r.submittedAt))}</dd>
          </div>
        </dl>
      </Section>

      </div>

      {/* Kept in view while reading a long request; the decision is always one move away. */}
      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
        {!allChecked && (
          <p id="sign-blocked" className="text-sm text-stone-700 max-sm:order-last sm:mr-auto">
            Verify every document to sign ({checked} of {r.documents.length}).
          </p>
        )}
        <button
          type="button"
          onClick={onReject}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-700/40 bg-white px-5 font-semibold text-red-700 hover:bg-red-50"
        >
          <Icon name="xCircle" className="size-4.5" />
          Reject
        </button>
        <button type="button" onClick={onSign} disabled={!allChecked} aria-describedby={allChecked ? undefined : 'sign-blocked'} className={btnPrimary}>
          <Icon name="seal" className="size-4.5" />
          Verify & Sign
        </button>
      </div>
    </article>
  )
}
