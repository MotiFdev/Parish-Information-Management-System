import { useState, type ReactNode } from 'react'
import { DocumentViewer, type ViewableFile } from '../../components/DocumentViewer'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Drawer } from '../../components/ui/Drawer'
import { btnSecondary, cardClass } from '../../components/ui/styles'
import { DocProblemDialog, RequirementDialog, ReturnDetailsDialog } from '../../features/staff/requests/RequestDialogs'
import { RequestDrawer } from '../../features/staff/requests/RequestDrawer'
import { runStep, useOfficeRequests, type Step } from '../../features/staff/requests/requestsApi'
import { noFilters, type Filters, type OfficeRequest, type RequestDoc } from '../../features/staff/requests/requestsData'
import { RequestsTable } from '../../features/staff/requests/RequestsTable'
import { StaffLayout } from '../../layouts/StaffLayout'
import { api, ApiError } from '../../lib/api'
import { usePreviewState } from '../../lib/preview'
import { navigate, useLocation } from '../../lib/router'
import { useStaffDefaults } from '../../features/staff/settings/settingsApi'

const PATH = '/secretary/requests'
const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso))

type Confirm = {
  kind: 'send' | 'ready' | 'complete'
  request: OfficeRequest
} | null

export default function RecordRequestsPage() {
  const defaults = useStaffDefaults()
  const pageSize = Number(defaults.pageSize)
  const preview = usePreviewState()
  const { query } = useLocation()
  const { toast } = useToast()
  const { items, failed, reload, replace } = useOfficeRequests()
  const [filters, setFilters] = useState<Filters>(noFilters)
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<ViewableFile | null>(null)
  const [problem, setProblem] = useState<{ doc: RequestDoc; status: 'Needs Resubmission' | 'Rejected' } | null>(null)
  const [requirementFor, setRequirementFor] = useState<OfficeRequest | null>(null)
  const [returnFor, setReturnFor] = useState<OfficeRequest | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)

  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : failed && !items ? 'error' : !items ? 'loading' : 'ready'
  const all = state === 'empty' || !items ? [] : items
  const q = filters.search.trim().toLowerCase()
  const filtered = all.filter(
    (r) =>
      (filters.recordType === 'all' || r.recordType === filters.recordType) &&
      (filters.requestType === 'all' || r.requestType === filters.requestType) &&
      (filters.status === 'all' || r.status === filters.status) &&
      (!filters.from || dayOf(r.submittedAt) >= filters.from) &&
      (!filters.to || dayOf(r.submittedAt) <= filters.to) &&
      (!q || [r.subject, r.client.name, r.number].some((v) => v.toLowerCase().includes(q))),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize)
  const open = all.find((r) => r.number === query.get('request')) ?? null

  const hrefFor = (number?: string) => {
    const params = new URLSearchParams()
    if (number) params.set('request', number)
    if (query.get('preview')) params.set('preview', query.get('preview')!)
    const qs = params.toString()
    return qs ? `${PATH}?${qs}` : PATH
  }

  /**
   * Runs a workflow step and shows the server's copy. Errors other than validation are
   * reported here; validation errors are rethrown for the dialog or form that sent them.
   */
  const step = async (r: OfficeRequest, s: Step, done: (u: OfficeRequest) => string, opts: { rethrow422?: boolean } = {}) => {
    setBusy(true)
    try {
      const updated = await runStep(r.id, s)
      replace(updated)
      toast(done(updated))
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && opts.rethrow422) throw err
      if (err instanceof ApiError && err.status === 409) {
        toast(err.message)
        reload()
      } else toast(err instanceof ApiError && err.status !== 500 ? err.message : 'That could not be saved. Please try again in a moment.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const view = async (d: RequestDoc) => {
    if (!d.file) return
    const base = { label: d.label, file: d.file, note: d.note }
    if (!d.documentId) return setViewing(base)
    setViewing({ ...base, loading: true })
    try {
      const { url } = await api<{ url: string }>(`/api/documents/${d.documentId}/link`)
      setViewing((v) => (v?.file === d.file ? { ...base, url } : v))
    } catch {
      setViewing((v) => (v?.file === d.file ? { ...base, error: 'The file could not be opened. Close this and try again.' } : v))
    }
  }

  const confirmCopy: Record<NonNullable<Confirm>['kind'], { title: string; label: string; body: (r: OfficeRequest) => ReactNode }> = {
    send: {
      title: 'Send to the priest?',
      label: 'Send to priest',
      body: (r) => (
        <p>
          All {r.documents.length} documents are verified
          {r.register ? ` and the entry at book ${r.register.book}, page ${r.register.page}, line ${r.register.line} is recorded` : ''}. The request goes to the
          priest’s approval queue, and {r.client.name} is told it is waiting for approval.
        </p>
      ),
    },
    ready: {
      title: 'Mark ready for collection?',
      label: 'Mark ready',
      body: (r) => <p>{r.client.name} is told the certificate is ready to collect at the parish office.</p>,
    },
    complete: {
      title: 'Mark completed?',
      label: 'Mark completed',
      body: (r) => <p>Confirms {r.client.name} has collected the certificate. The request is closed and the release is written to the audit log.</p>,
    },
  }

  const ready = state === 'ready' || state === 'empty'

  return (
    <StaffLayout activeHref={PATH}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Record Requests</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Check each request against the register and its documents, then send it to the priest. Release certificates once they are signed.
          </p>
        </div>
        {ready && (
          <button type="button" onClick={reload} className={btnSecondary}>
            Refresh
          </button>
        )}
      </div>

      <div className="mt-6">
        {!ready ? (
          <div className={cardClass}>
            {state === 'loading' ? (
              <LoadingState what="record requests" />
            ) : (
              <ErrorState what="record requests" help="If it keeps happening, tell the system administrator." />
            )}
          </div>
        ) : all.length === 0 ? (
          <div className={`${cardClass} px-5 py-12 text-center`}>
            <p className="font-semibold text-stone-800">No record requests yet</p>
            <p className="mt-1 text-sm text-stone-600">Requests appear here as parishioners submit them from their portal.</p>
          </div>
        ) : (
          <RequestsTable
            rows={rows}
            matching={filtered.length}
            total={all.length}
            filters={filters}
            onFilters={(f) => {
              setFilters((x) => ({ ...x, ...f }))
              setPage(0)
            }}
            onClear={() => {
              setFilters(noFilters)
              setPage(0)
            }}
            page={current}
            pageSize={pageSize}
            onPage={setPage}
            onView={(r) => navigate(hrefFor(r.number))}
          />
        )}
      </div>

      <Drawer open={open !== null} onClose={() => open && navigate(hrefFor(), { replace: true })} labelledBy="req-detail-title">
        {open && (
          <RequestDrawer
            key={open.id}
            request={open}
            busy={busy}
            actions={{
              onClose: () => navigate(hrefFor(), { replace: true }),
              onStart: () => step(open, { kind: 'start' }, (u) => `Verification started on ${u.number}. It is assigned to you.`),
              onDocVerify: (d) => step(open, { kind: 'review', documentId: d.id, status: 'Verified' }, () => `${d.label} verified.`),
              onDocProblem: (doc, status) => setProblem({ doc, status }),
              onViewDoc: view,
              onLinkRegister: async (ref) => {
                await step(open, { kind: 'register', ...ref }, () => `Recorded book ${ref.book}, page ${ref.page}, line ${ref.line}.`, { rethrow422: true })
              },
              onAddRemark: (text) => step(open, { kind: 'remark', body: text }, (u) => `Remark added. ${u.client.name} can see it.`),
              onRequestDocs: () => setRequirementFor(open),
              onReturnDetails: () => setReturnFor(open),
              onSendToPriest: () => setConfirm({ kind: 'send', request: open }),
              onReady: () => setConfirm({ kind: 'ready', request: open }),
              onComplete: () => setConfirm({ kind: 'complete', request: open }),
            }}
          />
        )}
      </Drawer>

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />

      <DocProblemDialog
        target={problem}
        onClose={() => setProblem(null)}
        onSubmit={async (note) => {
          if (!open || !problem) return
          const ok = await step(open, { kind: 'review', documentId: problem.doc.id, status: problem.status, note }, (u) =>
            problem.status === 'Needs Resubmission'
              ? `${u.client.name} was asked to upload the ${problem.doc.label} again.`
              : `${problem.doc.label} rejected. ${u.client.name} was told why.`,
          )
          if (ok) setProblem(null)
        }}
      />

      <RequirementDialog
        request={requirementFor}
        onClose={() => setRequirementFor(null)}
        onSubmit={async (labels, message) => {
          if (!requirementFor) return
          const ok = await step(requirementFor, { kind: 'requirements', labels, message }, (u) => `${u.client.name} was asked for: ${labels.join(', ')}.`)
          if (ok) setRequirementFor(null)
        }}
      />

      <ReturnDetailsDialog
        request={returnFor}
        onClose={() => setReturnFor(null)}
        onSubmit={async (note) => {
          if (!returnFor) return
          const ok = await step(returnFor, { kind: 'return-details', note }, (u) => `Sent back to ${u.client.name} to fix the details. They were notified.`)
          if (ok) setReturnFor(null)
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? confirmCopy[confirm.kind].title : ''}
        confirmLabel={confirm ? confirmCopy[confirm.kind].label : ''}
        onConfirm={async () => {
          if (!confirm || busy) return
          const { kind, request: r } = confirm
          const ok = await step(r, { kind }, (u) =>
            kind === 'send'
              ? `${u.number} sent to the priest for approval.`
              : kind === 'ready'
                ? `${u.number} is ready for collection. ${u.client.name} was notified.`
                : `${u.number} completed.`,
          )
          if (ok) setConfirm(null)
        }}
      >
        {confirm && confirmCopy[confirm.kind].body(confirm.request)}
      </ConfirmDialog>
    </StaffLayout>
  )
}
