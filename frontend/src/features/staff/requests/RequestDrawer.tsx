import { useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { StatusBadge } from '../../parishioner/home/StatusBadge'
import { ApiError } from '../../../lib/api'
import { navigate } from '../../../lib/router'
import { lookUpEntry, type ElsewhereEntry, type RegisterEntry } from './requestsApi'
import { stage, type OfficeRequest, type RequestDoc } from './requestsData'

const dateTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})
const when = (iso?: string) => (iso ? dateTime.format(new Date(iso)) : '')

/** Sacramental Records, on this request's register. */
const registerHref = (r: OfficeRequest, params: Record<string, string>) =>
  `/secretary/sacraments?${new URLSearchParams({ register: r.recordType.toLowerCase(), ...params })}`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stone-100 px-5 py-5">
      <h3 className="mb-3 font-semibold text-stone-900">{title}</h3>
      {children}
    </section>
  )
}

function Check({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon name={done ? 'check' : 'clock'} className={`mt-0.5 size-4 shrink-0 ${done ? 'text-forest' : 'text-stone-500'}`} strokeWidth={done ? 2.5 : 1.8} />
      <span className={done ? 'text-stone-800' : 'text-stone-700'}>
        {children}
        <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
      </span>
    </li>
  )
}

export interface DrawerActions {
  onStart: () => void
  onDocVerify: (doc: RequestDoc) => void
  onDocProblem: (doc: RequestDoc, status: 'Needs Resubmission' | 'Rejected') => void
  onViewDoc: (doc: RequestDoc) => void
  /** Saves the register place; rejects with an ApiError the lookup shows. */
  onLinkRegister: (ref: { book: string; page: string; line: string }) => Promise<void>
  onAddRemark: (text: string) => void
  onRequestDocs: () => void
  /** Sends the request back for the requester to correct the details they typed. */
  onReturnDetails: () => void
  onSendToPriest: () => void
  onReady: () => void
  onComplete: () => void
  onClose: () => void
}

type LookupMode = 'link' | 'record' | 'check' | 'view'

/**
 * Book, page, and line lookup in the digital register. While checking a certificate request or
 * correction, staff link the entry; after a New Registration is approved, they record where it
 * was written. Paper-only entries can be recorded by reference.
 */
function RegisterLookup({ r, mode, onLink }: { r: OfficeRequest; mode: LookupMode; onLink: DrawerActions['onLinkRegister'] }) {
  const start = r.register ?? { book: '', page: '', line: '' }
  const [ref, setRef] = useState({ book: String(start.book), page: String(start.page), line: String(start.line) })
  const [result, setResult] = useState<{ ref: typeof ref; entry: RegisterEntry | null; elsewhere: ElsewhereEntry[] } | null>(null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const valid = [ref.book, ref.page, ref.line].every((v) => /^\d+$/.test(v) && Number(v) > 0)
  const saved = r.register && String(r.register.book) === ref.book && String(r.register.page) === ref.page && String(r.register.line) === ref.line
  const canSave = mode === 'link' || mode === 'record'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) {
      setError('Enter the book, page, and line as whole numbers.')
      setResult(null)
      return
    }
    setError(undefined)
    setBusy(true)
    try {
      setResult({ ref: { ...ref }, ...(await lookUpEntry(r.recordType, ref)) })
    } catch {
      setError('The register could not be searched. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await onLink(ref)
    } catch (err) {
      setError(err instanceof ApiError ? (err.field('book') ?? err.message) : 'That could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {r.register ? (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-stone-800">
          <Icon name="check" className="size-4 text-forest" strokeWidth={2.5} />
          {r.recordType} book {r.register.book}, page {r.register.page}, line {r.register.line}
          {r.registerLinked ? ' (in the digital register)' : ' (paper register)'}
          {r.registerRecordId && (
            <button
              type="button"
              onClick={() => navigate(registerHref(r, { entry: r.registerRecordId! }))}
              className="ml-1 font-semibold text-brown underline underline-offset-2 hover:text-stone-900"
            >
              View entry
            </button>
          )}
        </p>
      ) : mode === 'record' ? (
        <p className="mb-3 text-sm text-stone-700">
          Use <span className="font-semibold">Create register entry</span> below to add it to the digital register with this request’s details. If it is only in
          the paper register, record its book, page, and line here instead.
        </p>
      ) : mode === 'check' ? (
        <p className="mb-3 text-sm text-stone-700">New registration: check that this sacrament is not already recorded before sending it on.</p>
      ) : mode === 'link' ? (
        <p className="mb-3 text-sm text-stone-700">Find the entry in the {r.recordType.toLowerCase()} register and record it on this request.</p>
      ) : (
        <p className="mb-3 text-sm text-stone-700">No register entry recorded.</p>
      )}
      {mode !== 'view' && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2" aria-label="Register lookup">
          {(['book', 'page', 'line'] as const).map((k) => (
            <div key={k}>
              <label htmlFor={`lookup-${k}`} className="mb-1 block text-xs font-medium text-stone-600 capitalize">
                {k}
              </label>
              <input
                id={`lookup-${k}`}
                inputMode="numeric"
                value={ref[k]}
                onChange={(e) => {
                  setRef((x) => ({ ...x, [k]: e.target.value.replace(/\D/g, '') }))
                  setResult(null)
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'lookup-error' : undefined}
                className={`${inputClass} w-20 tabular-nums`}
              />
            </div>
          ))}
          <button type="submit" disabled={busy} className={btnSecondary}>
            <Icon name="search" className="size-4.5" />
            Look up
          </button>
        </form>
      )}
      {error && (
        <p id="lookup-error" role="alert" className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {result && !result.entry && (
          <div className="mt-3 rounded-lg bg-ivory px-3 py-2.5 text-sm text-stone-700">
            <p>
              Nothing at book {result.ref.book}, page {result.ref.page}, line {result.ref.line} in the digital {r.recordType.toLowerCase()} register.
              {canSave && !saved && ' If the entry is at this place in the paper register, record the reference.'}
            </p>
            {result.elsewhere.map((x) => (
              <p key={x.register} className="mt-2 font-medium text-brown">
                That place in the {x.register.toLowerCase()} register holds {x.subject || 'an entry'}. Each register has its own books; this request is for the{' '}
                {r.recordType.toLowerCase()} register.
              </p>
            ))}
            {canSave && !saved && (
              <button type="button" onClick={save} disabled={busy} className={`${btnPrimary} mt-3`}>
                Record this reference
              </button>
            )}
          </div>
        )}
        {result?.entry && (
          <div className="mt-3 rounded-xl border border-stone-200 px-4 py-3 text-sm">
            <p className="font-semibold text-stone-900">{result.entry.subject || 'Unnamed entry'}</p>
            <dl className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {(
                [
                  ['Date', result.entry.event_date],
                  ['Place', result.entry.event_place],
                  ['Minister', result.entry.officiating_minister],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline text-stone-600">{k}: </dt>
                    <dd className="inline text-stone-800">{v}</dd>
                  </div>
                ))}
            </dl>
            {canSave && !saved && (
              <button type="button" onClick={save} disabled={busy} className={`${btnPrimary} mt-3`}>
                {mode === 'record' ? 'Record this entry' : 'Link this entry'}
              </button>
            )}
            {mode === 'check' && <p className="mt-2 font-semibold text-brown">This sacrament may already be recorded. Compare before registering it again.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function RemarkForm({ onAdd }: { onAdd: (t: string) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return setError('Write the remark first.')
        onAdd(text.trim())
        setText('')
      }}
      className="mt-3"
    >
      <label htmlFor="remark-text" className="mb-1 block text-sm font-medium text-stone-700">
        Add a remark
      </label>
      <textarea
        id="remark-text"
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(undefined)
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'remark-text-error' : 'remark-text-hint'}
        className={inputClass}
      />
      {error ? (
        <p id="remark-text-error" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p id="remark-text-hint" className="mt-1 text-sm text-stone-600">
          The requester sees remarks on their request page.
        </p>
      )}
      <button type="submit" className={`${btnSecondary} mt-2`}>
        Add remark
      </button>
    </form>
  )
}

export function RequestDrawer({ request: r, actions: a, busy = false }: { request: OfficeRequest; actions: DrawerActions; busy?: boolean }) {
  const checking = r.status === 'Under Verification' && !r.sentToPriestAt
  const open = r.status === 'Pending' || checking
  const verified = r.documents.filter((d) => d.file && d.status === 'Verified').length
  const allVerified = r.documents.length > 0 && verified === r.documents.length
  const newReg = r.requestType === 'New Registration'
  const lookupMode: LookupMode = checking ? (newReg ? 'check' : 'link') : r.status === 'Approved' && newReg && !r.createdEntry ? 'record' : 'view'
  const registerOk = r.requestType === 'New Registration' || Boolean(r.register)
  const detailsOk = !r.detailsReturned
  const canSend = allVerified && registerOk && detailsOk

  let nextStep: ReactNode
  let footer: ReactNode = null
  if (r.status === 'Pending') {
    nextStep = <p>Nobody has started on this request. Starting assigns it to you and moves it to Under Verification.</p>
    footer = (
      <button type="button" onClick={a.onStart} disabled={busy} className={btnPrimary}>
        Start verification
      </button>
    )
  } else if (checking) {
    nextStep = (
      <ul className="space-y-1.5">
        <Check done={allVerified}>
          Documents verified: {verified} of {r.documents.length}
        </Check>
        <Check done={registerOk}>
          {r.requestType === 'New Registration'
            ? 'New registration: no existing entry to link'
            : r.register
              ? 'Register entry linked'
              : 'Register entry linked by book, page, and line'}
        </Check>
        <Check done={detailsOk}>
          {r.detailsReturned ? (
            <>
              Waiting for the requester to correct their details (sent back {when(r.detailsReturned.at)}): {r.detailsReturned.note}
            </>
          ) : r.detailsUpdatedAt ? (
            `Details corrected by the requester ${when(r.detailsUpdatedAt)}`
          ) : (
            'Details given look right'
          )}
        </Check>
      </ul>
    )
    footer = (
      <>
        <button type="button" onClick={a.onReturnDetails} disabled={busy || Boolean(r.detailsReturned)} className={btnSecondary}>
          <Icon name="pencil" className="size-4.5" />
          Send back to fix details
        </button>
        <button type="button" onClick={a.onRequestDocs} disabled={busy} className={btnSecondary}>
          Request documents
        </button>
        <button
          type="button"
          onClick={a.onSendToPriest}
          disabled={!canSend || busy}
          aria-describedby={canSend ? undefined : 'send-blocked'}
          className={btnPrimary}
        >
          <Icon name="seal" className="size-4.5" />
          Mark verified and send to priest
        </button>
      </>
    )
  } else if (r.status === 'Under Verification') {
    nextStep = <p>Sent to the priest {when(r.sentToPriestAt)}. Nothing to do until it is approved or rejected.</p>
  } else if (r.status === 'Approved' && r.requestType === 'New Registration' && !r.createdEntry) {
    nextStep = (
      <p>
        Approved {when(r.decidedAt)}
        {r.decidedBy ? ` by ${r.decidedBy}` : ''}. Write the entry in the register book, then create it here: the form opens filled in with this request’s
        details, and you add the book, page, and line.
      </p>
    )
    footer = (
      <button type="button" onClick={() => navigate(registerHref(r, { edit: 'new', from: r.id }))} disabled={busy} className={btnPrimary}>
        <Icon name="plus" className="size-4.5" />
        Create register entry
      </button>
    )
  } else if (r.status === 'Approved') {
    nextStep = (
      <p>
        Approved and signed {when(r.decidedAt)}
        {r.decidedBy ? ` by ${r.decidedBy}` : ''}. Release the certificate when it is printed; the requester is told it is ready.
      </p>
    )
    footer = (
      <button type="button" onClick={a.onReady} disabled={busy} className={btnPrimary}>
        Mark ready for collection
      </button>
    )
  } else if (r.status === 'Ready for Collection') {
    nextStep = <p>Ready since {when(r.readyAt)}. Mark it completed when the requester collects the certificate.</p>
    footer = (
      <button type="button" onClick={a.onComplete} disabled={busy} className={btnPrimary}>
        <Icon name="check" className="size-4.5" />
        Mark completed
      </button>
    )
  } else if (r.status === 'Rejected') {
    nextStep = (
      <p>
        Rejected {when(r.decidedAt)}
        {r.decidedBy ? ` by ${r.decidedBy}` : ''}. Reason: <span className="font-semibold">{r.rejectionReason}</span>
      </p>
    )
  } else {
    nextStep = <p>Completed {when(r.completedAt)}. The certificate was collected.</p>
  }

  return (
    <article aria-labelledby="req-detail-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-stone-700">{r.number}</span>
            <StatusBadge status={r.status} />
            <span className="text-stone-600">{stage(r)}</span>
          </p>
          <h2 id="req-detail-title" className="mt-1 font-serif text-3xl font-semibold text-stone-900">
            {r.recordType} · {r.requestType.toLowerCase()}
          </h2>
          <p className="text-lg text-stone-700">{r.subject}</p>
        </div>
        <button
          type="button"
          onClick={a.onClose}
          aria-label="Close details"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <section aria-label="Next step" className="bg-ivory/60 px-5 py-4 text-sm text-stone-800">
          <h3 className="mb-1.5 font-semibold text-forest">Next step</h3>
          {nextStep}
        </section>

        {r.corrections && (
          <Section title="Requested correction">
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
                    Requested
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.corrections.map((c) => (
                  <tr key={c.field} className="border-b border-stone-100">
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
            {r.corrections.some((c) => c.reason) && (
              <p className="mt-2 text-sm text-stone-700">
                <span className="font-semibold">Reason given:</span>{' '}
                {r.corrections
                  .map((c) => c.reason)
                  .filter(Boolean)
                  .join('; ')}
              </p>
            )}
          </Section>
        )}

        <Section title={`Documents (${verified} of ${r.documents.length} verified)`}>
          {r.documents.length === 0 ? (
            <p className="text-sm text-stone-600">No documents uploaded.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {r.documents.map((d) => (
                <li key={d.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start gap-3">
                    <Icon name="file" className="mt-0.5 size-5 shrink-0 text-stone-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-stone-900">{d.label}</span>
                      <span className="block break-all text-stone-600">{d.file ?? 'Requested, not uploaded yet'}</span>
                      {d.note && <span className="mt-0.5 block text-stone-700">{d.note}</span>}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="mt-2 ml-8 flex flex-wrap gap-2">
                    {d.file && (
                      <button
                        type="button"
                        onClick={() => a.onViewDoc(d)}
                        aria-label={`View ${d.label}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 font-semibold text-stone-700 hover:border-forest/50 hover:text-forest"
                      >
                        <Icon name="eye" className="size-4" />
                        View
                      </button>
                    )}
                    {checking && d.file && !busy && d.status !== 'Verified' && (
                      <button
                        type="button"
                        onClick={() => a.onDocVerify(d)}
                        aria-label={`Verify ${d.label}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-forest/40 bg-white px-3 font-semibold text-forest hover:bg-forest-soft"
                      >
                        <Icon name="check" className="size-4" strokeWidth={2.5} />
                        Verify
                      </button>
                    )}
                    {checking && d.file && !busy && d.status !== 'Needs Resubmission' && (
                      <button
                        type="button"
                        onClick={() => a.onDocProblem(d, 'Needs Resubmission')}
                        aria-label={`Ask for ${d.label} again`}
                        className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-3 font-semibold text-stone-700 hover:border-brown/50 hover:text-brown"
                      >
                        Ask to resubmit
                      </button>
                    )}
                    {checking && d.file && !busy && d.status !== 'Rejected' && (
                      <button
                        type="button"
                        onClick={() => a.onDocProblem(d, 'Rejected')}
                        aria-label={`Reject ${d.label}`}
                        className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-3 font-semibold text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Register entry">
          <RegisterLookup key={`${r.id}-${lookupMode}-${r.register?.book ?? ''}`} r={r} mode={lookupMode} onLink={a.onLinkRegister} />
        </Section>

        <Section title="Details given">
          {r.detailsReturned && (
            <p className="mb-3 rounded-lg bg-gold-soft/70 px-3 py-2.5 text-sm text-stone-800">
              Sent back to the requester to fix: <span className="font-semibold">{r.detailsReturned.note}</span>
            </p>
          )}
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {r.subjectDetails.map(([k, v]) => (
              <div key={k}>
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Requested by">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            {(
              [
                ['Name', `${r.client.name} (${r.client.relationship.toLowerCase()})`],
                ['Purpose', r.purpose],
                ['Contact number', r.client.contact],
                ['Email', r.client.email],
                ['Address', r.client.address],
                ['Submitted', when(r.submittedAt)],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium break-words text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Remarks and requirements">
          {r.remarks.length === 0 ? (
            <p className="text-sm text-stone-600">No remarks yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {r.remarks.map((m, i) => (
                <li key={i} className="border-l-2 border-stone-300 pl-3">
                  <p className="text-stone-800">{m.text}</p>
                  <p className="text-xs text-stone-600">
                    {m.kind === 'requirement' ? 'Additional requirement' : 'Remark'} · {m.by}, {when(m.at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {open && <RemarkForm onAdd={a.onAddRemark} />}
        </Section>
      </div>

      <div className="flex flex-col gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&>button]:whitespace-nowrap">
        {checking && !canSend && (
          <p id="send-blocked" className="text-sm text-stone-700 sm:basis-full">
            {!allVerified ? 'Verify every document' : 'Link the register entry'} to send it on.
          </p>
        )}
        {footer ?? (
          <button type="button" onClick={a.onClose} className={btnSecondary}>
            Close
          </button>
        )}
      </div>
    </article>
  )
}
