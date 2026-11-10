import { useState } from 'react'
import { Link } from '../../../components/Link'
import { Card } from '../../../components/ui/Card'
import { FileInput } from '../../../components/ui/FileInput'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, cardClass } from '../../../components/ui/styles'
import { ApiError } from '../../../lib/api'
import { fileProblem } from '../../../lib/upload'
import { StatusBadge } from '../home/StatusBadge'
import { useInquiry } from '../inquiries/inquiryContext'
import { usePortal } from '../portalContext'
import { StatusStepper } from '../requests/StatusStepper'
import { uploadRequestDocument } from '../requests/requestsApi'
import { DetailsEditor } from './DetailsEditor'
import { awaitingUpload, isOpen, parish, type RecordRequest, type RequestDocument } from '../sampleData'
import { useOfficeHours } from '../officeHours'

/** A record request found by its reference number: progress, remarks, and documents to upload. */
export function RequestStatus({ request: r, onChange }: { request: RecordRequest; onChange: (r: RecordRequest) => void }) {
  const officeHours = useOfficeHours()
  const { setOpen: setChatOpen } = useInquiry()
  const open = isOpen(r)
  const waiting = open ? r.documents.filter(awaitingUpload) : []
  const fixDetails = open && Boolean(r.detailsReturned)

  return (
    <section aria-labelledby="result-heading" className="mt-10">
      <h2 id="result-heading" className="font-serif text-3xl font-semibold text-stone-900">
        {r.recordType} · {r.requestType}
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-600">
        <span className="font-mono font-semibold text-stone-800">{r.number}</span>
        <span>For {r.subject}</span>
        <StatusBadge status={r.status} />
      </p>

      {fixDetails && (
        <a href="#details" className="mt-6 flex flex-col gap-3 rounded-2xl border border-gold bg-gold-soft p-5 hover:border-brown sm:flex-row sm:items-center">
          <Icon name="alert" className="size-6 shrink-0 text-brown" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-stone-900">The parish office asked you to correct your details</span>
            <span className="mt-0.5 block text-stone-700">{r.detailsReturned?.note}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-forest">
            <Icon name="pencil" className="size-4" />
            Edit below
          </span>
        </a>
      )}

      {waiting.length > 0 && (
        <a
          href="#documents"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-gold bg-gold-soft p-5 hover:border-brown sm:flex-row sm:items-center"
        >
          <Icon name="alert" className="size-6 shrink-0 text-brown" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-stone-900">
              {waiting.length === 1 ? 'The parish office needs a document from you' : `The parish office needs ${waiting.length} documents from you`}
            </span>
            <span className="mt-0.5 block text-stone-700">{waiting.map((d) => d.label).join(', ')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-forest">
            <Icon name="upload" className="size-4" />
            Upload below
          </span>
        </a>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {r.status === 'Rejected' ? (
            <section className="flex gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6">
              <Icon name="xCircle" className="size-6 shrink-0 text-red-700" />
              <div>
                <h3 className="font-semibold text-red-900">This request was not approved</h3>
                <p className="mt-1 leading-relaxed text-red-900/80">{r.rejectionReason}</p>
                <Link href="/parishioner/requests/new" className={`${btnPrimary} mt-4`}>
                  Start a new request
                </Link>
              </div>
            </section>
          ) : (
            <Card level="h3" title="Progress">
              <div className="px-5 py-6">
                <StatusStepper status={r.status} />
              </div>
              {r.status === 'Ready for Collection' && (
                <p className="border-t border-stone-100 bg-forest-soft/60 px-5 py-3.5 text-sm text-stone-800">
                  Bring a valid ID and this reference number when you collect at the parish office, {officeHours}.
                </p>
              )}
            </Card>
          )}

          {fixDetails && <DetailsEditor key={r.detailsReturned?.at} request={r} onSaved={onChange} />}

          {r.remarks.length > 0 && (
            <Card level="h3" title={waiting.length ? 'Remarks and additional requirements' : 'Remarks from the parish office'}>
              <ol className="divide-y divide-stone-100">
                {r.remarks.map((m, i) => (
                  <li key={i} className="flex gap-3 px-5 py-4">
                    <Icon
                      name={m.kind === 'requirement' ? 'alert' : 'message'}
                      className={`mt-0.5 size-5 shrink-0 ${m.kind === 'requirement' ? 'text-brown' : 'text-forest'}`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-600">
                        {m.kind === 'requirement' ? 'Additional requirement' : 'Remark'} · {m.by},{' '}
                        {new Date(m.at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="mt-0.5 text-stone-800">{m.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <div id="documents" className="scroll-mt-24">
            <Card level="h3" title="Supporting documents">
              <ul className="divide-y divide-stone-100">
                {r.documents.map((d) => (
                  <DocumentRow key={`${d.id}-${d.fileName}`} reference={r.number} doc={d} canUpload={open} onUploaded={onChange} />
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card level="h3" title="Summary">
            <dl className="divide-y divide-stone-100 text-sm">
              {[
                ['Submitted', r.submittedOn],
                ['Relationship', r.relationship],
                ['Purpose', r.purpose],
                ['Parish', parish.name],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-5 py-3">
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="text-right font-medium text-stone-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card level="h3" title="Activity">
            <ol className="px-5 py-5">
              {[...r.history].reverse().map((h, i, all) => (
                <li key={`${h.status}-${h.date}-${i}`} className={`relative border-l-2 border-forest-soft pl-5 ${i < all.length - 1 ? 'pb-5' : ''}`}>
                  <span className={`absolute top-1 -left-[7px] size-3 rounded-full ring-4 ring-white ${i === 0 ? 'bg-gold' : 'bg-forest/40'}`} />
                  <p className="text-sm font-semibold text-stone-800">{h.status}</p>
                  <p className="text-sm text-stone-600">{h.date}</p>
                  {h.note && <p className="mt-1 text-sm text-stone-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className={`flex w-full items-center gap-3 p-5 text-left hover:border-forest/40 ${cardClass}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-soft text-forest">
              <Icon name="message" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-stone-900">Have a question?</span>
              <span className="block text-sm text-stone-500">Ask the parish about requirements</span>
            </span>
            <Icon name="chevronRight" className="size-5 shrink-0 text-stone-400" />
          </button>
        </div>
      </div>
    </section>
  )
}

interface DocumentRowProps {
  reference: string
  doc: RequestDocument
  canUpload: boolean
  onUploaded: (r: RecordRequest) => void
}

function DocumentRow({ reference, doc, canUpload, onUploaded }: DocumentRowProps) {
  const { toast } = usePortal()
  const [file, setFile] = useState<File>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const waiting = canUpload && awaitingUpload(doc)
  const inputId = `reupload-${doc.id}`

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-stone-900">{doc.label}</p>
          {doc.fileName ? (
            <p className="mt-0.5 flex max-w-full items-center gap-1.5 text-sm text-stone-600">
              <Icon name="paperclip" className="size-3.5 shrink-0" />
              <span className="truncate">{doc.fileName}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-stone-500">Requested by the parish office. Not uploaded yet.</p>
          )}
        </div>
        {doc.fileName && <StatusBadge status={doc.status} />}
      </div>
      {doc.note && <p className="mt-2 text-sm text-stone-700">{doc.note}</p>}
      {waiting && (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!file) return setError('Choose the file to upload.')
            setBusy(true)
            try {
              onUploaded(await uploadRequestDocument(reference, doc.id, file))
              toast('Document uploaded. The secretary will review it again.')
            } catch (err) {
              setBusy(false)
              setError(
                err instanceof ApiError && (err.status === 422 || err.status === 409)
                  ? (err.field('file') ?? err.message)
                  : 'The document could not be uploaded. Please try again.',
              )
            }
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <FileInput
                id={inputId}
                fileName={file?.name}
                invalid={!!error}
                disabled={busy}
                onChange={(f) => {
                  const problem = fileProblem(f)
                  setError(problem)
                  setFile(problem ? undefined : f)
                }}
              />
            </div>
            <button type="submit" disabled={busy} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
              <Icon name="upload" className="size-4" />
              {busy ? 'Uploading…' : doc.fileName ? 'Upload again' : 'Upload'}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-1.5 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}
    </li>
  )
}
