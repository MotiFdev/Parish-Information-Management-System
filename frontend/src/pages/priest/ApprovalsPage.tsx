import { useState } from 'react'
import { Link } from '../../components/Link'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { Icon } from '../../components/ui/Icon'
import { btnSecondary, cardClass } from '../../components/ui/styles'
import { ApprovalsTable } from '../../features/priest/approvals/ApprovalsTable'
import { DocumentViewer, type ViewableFile } from '../../components/DocumentViewer'
import { RejectDialog } from '../../features/priest/approvals/RejectDialog'
import { decide, useApprovalQueue } from '../../features/priest/approvals/approvalsApi'
import { RequestDetail, type RequestDocument } from '../../features/priest/approvals/RequestDetail'
import { SignDialog } from '../../features/priest/approvals/SignDialog'
import { type AwaitingRequest, type RequestType, type Sacrament } from '../../features/priest/sampleData'
import { useAccountName } from '../../features/auth/useAccountName'
import { PriestLayout } from '../../layouts/PriestLayout'
import { api, ApiError } from '../../lib/api'
import { usePreviewState } from '../../lib/preview'
import { navigate, useLocation } from '../../lib/router'

const PATH = '/priest/records/verify'
const PAGE_SIZE = 10

export default function ApprovalsPage() {
  const signer = useAccountName().full
  const preview = usePreviewState()
  const { query } = useLocation()
  const { toast } = useToast()
  const { items, failed, reload, remove } = useApprovalQueue()
  const [recordType, setRecordType] = useState<Sacrament | 'all'>('all')
  const [requestType, setRequestType] = useState<RequestType | 'all'>('all')
  const [signing, setSigning] = useState<AwaitingRequest | null>(null)
  const [rejecting, setRejecting] = useState<AwaitingRequest | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  /** Request number -> files the priest has verified. */
  const [checkedDocs, setCheckedDocs] = useState<Record<string, string[]>>({})
  const [viewing, setViewing] = useState<(ViewableFile & { key: string }) | null>(null)

  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : failed && !items ? 'error' : !items ? 'loading' : 'ready'
  const all = state === 'empty' || !items ? [] : [...items].sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))
  const q = search.trim().toLowerCase()
  const filtered = all.filter(
    (r) =>
      (recordType === 'all' || r.recordType === recordType) &&
      (requestType === 'all' || r.requestType === requestType) &&
      (!q || [r.subject, r.number, r.client.name, r.verifiedBy].some((v) => v.toLowerCase().includes(q))),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  // The open drawer lives in the URL, so the dashboard and bookmarks can open a request directly.
  const open = all.find((r) => r.number === query.get('request')) ?? null

  // Keep ?preview= so the design-state switcher survives opening and closing the drawer.
  const hrefFor = (number?: string) => {
    const params = new URLSearchParams()
    if (number) params.set('request', number)
    if (query.get('preview')) params.set('preview', query.get('preview')!)
    const qs = params.toString()
    return qs ? `${PATH}?${qs}` : PATH
  }

  const closeDrawer = () => {
    if (open) navigate(hrefFor(), { replace: true })
  }

  const toggleDoc = (number: string, file: string) =>
    setCheckedDocs((c) => {
      const list = c[number] ?? []
      return {
        ...c,
        [number]: list.includes(file) ? list.filter((f) => f !== file) : [...list, file],
      }
    })

  // Filters and search always start from the first page.
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(0)
    }

  const finish = (done: AwaitingRequest) => {
    remove(done.id ?? done.number)
    navigate(hrefFor(), { replace: true })
    // The row that opened the drawer is gone, so the dialogs can't hand focus back to it.
    window.setTimeout(() => document.getElementById('approvals-title')?.focus())
  }

  const ready = state === 'ready' || state === 'empty'

  /** Opens a document: the stored file through a short-lived signed link, or the placeholder for sample data. */
  const view = async (d: RequestDocument) => {
    const base = { key: d.file, label: d.label, file: d.file, note: d.note }
    if (!d.documentId) return setViewing(base)
    setViewing({ ...base, loading: true })
    try {
      const { url } = await api<{ url: string }>(`/api/documents/${d.documentId}/link`)
      setViewing((v) => (v?.key === d.file ? { ...base, url } : v))
    } catch {
      setViewing((v) => (v?.key === d.file ? { ...base, error: 'The file could not be opened. Close this and try again.' } : v))
    }
  }

  /** Sends the decision. A request someone else already decided leaves the queue; other failures stay in the dialog. */
  const send = async (r: AwaitingRequest, decision: { approve: true } | { approve: false; reason: string }) => {
    try {
      await decide(r.id ?? r.number, decision)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast(err.message)
        setSigning(null)
        setRejecting(null)
        finish(r)
        reload()
        return false
      }
      throw new Error(
        err instanceof ApiError && err.status !== 500 ? (err.field('reason') ?? err.message) : 'That could not be saved. Please try again in a moment.',
        { cause: err },
      )
    }
    return true
  }

  return (
    <PriestLayout activeHref={PATH}>
      <h1 id="approvals-title" tabIndex={-1} className="font-serif text-4xl font-semibold text-stone-900 focus:outline-none">
        Certificate Approvals
      </h1>
      <p className="mt-1 max-w-2xl text-stone-600">Requests the secretary has checked against the register. Approve and sign, or reject with a reason.</p>

      <div className="mt-6">
        {!ready ? (
          <div className={cardClass}>
            {state === 'loading' ? (
              <LoadingState what="requests awaiting approval" variant="table" />
            ) : (
              <>
                <ErrorState what="requests awaiting approval" help="If it keeps happening, the parish office can check the system." />
                <div className="px-5 pb-5 text-center">
                  <button type="button" onClick={reload} className={btnSecondary}>
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        ) : all.length === 0 ? (
          <div className={`${cardClass} flex flex-col items-center gap-2 px-5 py-14 text-center`}>
            <Icon name="seal" className="size-9 text-forest" />
            <p className="font-serif text-2xl font-semibold text-stone-900">All caught up</p>
            <p className="max-w-sm text-stone-600">
              Nothing is waiting for your signature. Requests appear here once the secretary has checked the register and the documents.
            </p>
            <Link href="/priest/dashboard" className={`${btnSecondary} mt-3`}>
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <ApprovalsTable
            requests={rows}
            matching={filtered.length}
            total={all.length}
            search={search}
            onSearch={filter(setSearch)}
            page={current}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            recordType={recordType}
            requestType={requestType}
            onRecordType={filter(setRecordType)}
            onRequestType={filter(setRequestType)}
            onClear={() => {
              setSearch('')
              setRecordType('all')
              setRequestType('all')
              setPage(0)
            }}
            onView={(r) => navigate(hrefFor(r.number))}
          />
        )}
      </div>

      <Drawer open={open !== null} onClose={closeDrawer} labelledBy="detail-title">
        {open && (
          <RequestDetail
            key={open.number}
            request={open}
            verifiedDocs={checkedDocs[open.number] ?? []}
            onToggleDoc={(file) => toggleDoc(open.number, file)}
            onViewDoc={view}
            onClose={closeDrawer}
            onSign={() => setSigning(open)}
            onReject={() => setRejecting(open)}
          />
        )}
      </Drawer>

      <DocumentViewer
        doc={viewing}
        onClose={() => setViewing(null)}
        verify={{
          verified: open !== null && viewing !== null && (checkedDocs[open.number] ?? []).includes(viewing.key),
          onToggle: () => open && viewing && toggleDoc(open.number, viewing.key),
        }}
      />

      <SignDialog
        request={signing}
        signer={signer}
        onClose={() => setSigning(null)}
        onApprove={async () => {
          if (!signing) return
          const r = signing
          if (!(await send(r, { approve: true }))) return
          toast(
            r.requestType === 'Record Correction'
              ? `Correction to the ${r.recordType.toLowerCase()} entry for ${r.subject} approved. ${r.client.name} was notified.`
              : r.requestType === 'New Registration'
                ? `${r.number} approved. The secretary will write the entry in the register before releasing it.`
                : `${r.number} approved and signed. The secretary can now release the certificate.`,
          )
          setSigning(null)
          finish(r)
        }}
      />

      <RejectDialog
        request={rejecting}
        onClose={() => setRejecting(null)}
        onReject={async (reason) => {
          if (!rejecting) return
          const r = rejecting
          if (!(await send(r, { approve: false, reason }))) return
          toast(`${r.number} rejected. ${r.client.name} was told why.`)
          setRejecting(null)
          finish(r)
        }}
      />
    </PriestLayout>
  )
}
