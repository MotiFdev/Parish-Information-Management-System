import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, btnSecondary, cardClass } from '../../components/ui/styles'
import { OfferingsLedger } from '../../features/offerings/OfferingsLedger'
import { ReportBuilder, type PeriodPreset } from '../../features/priest/reports/ReportBuilder'
import { ReportPreview } from '../../features/priest/reports/ReportPreview'
import { ReportChart, ReportTable } from '../../features/priest/reports/ReportParts'
import { ReportSummary } from '../../features/priest/reports/ReportSummary'
import { reportCsv, type Report, type ReportConfig, type ReportType } from '../../features/priest/reports/reportData'
import { useServerReport } from '../../features/priest/reports/useServerReport'
import { sacraments } from '../../features/priest/sampleData'
import { addMonths, thisMonth } from '../../features/staff/reports/staffReports'
import { useAccountName } from '../../features/auth/useAccountName'
import { PriestLayout } from '../../layouts/PriestLayout'
import { download } from '../../lib/download'
import { usePreviewState } from '../../lib/preview'
import { navigate, useLocation } from '../../lib/router'

const PATH = '/priest/reports'
const reportTypes: ReportType[] = ['Demographic', 'Sacramental', 'Financial']

/** Periods end with the current month, so they move on as time passes. */
const presetRange = (p: Exclude<PeriodPreset, 'custom'>): Pick<ReportConfig, 'from' | 'to'> => {
  const now = thisMonth()
  return p === 'last12' ? { from: addMonths(now, -11), to: now } : { from: `${now.slice(0, 4)}-01`, to: now }
}

const queryFor = (c: ReportConfig) => {
  const p = new URLSearchParams({ type: c.type.toLowerCase() })
  if (c.type === 'Demographic') {
    p.set('group_by', c.groupBy)
    return p
  }
  p.set('from', c.from)
  p.set('to', c.to)
  if (c.type === 'Sacramental') c.sacraments.forEach((s) => p.append('sacraments[]', s))
  return p
}

export default function ReportsPage() {
  const preparedBy = useAccountName().full
  const preview = usePreviewState()
  const { query } = useLocation()
  const { toast } = useToast()
  // ?report= picks the report, so the dashboard and bookmarks can open one directly.
  const type = reportTypes.find((t) => t.toLowerCase() === query.get('report')) ?? 'Sacramental'
  const [options, setOptions] = useState<Omit<ReportConfig, 'type'>>({ ...presetRange('last12'), groupBy: 'sona', sacraments })
  const [preset, setPreset] = useState<PeriodPreset>('last12')
  const config: ReportConfig = { ...options, type }

  const errors = {
    range:
      type !== 'Demographic' && config.from > config.to
        ? 'The start month is after the end month.'
        : type !== 'Demographic' && config.to > thisMonth()
          ? 'Choose this month or an earlier one.'
          : undefined,
    sacraments: type === 'Sacramental' && config.sacraments.length === 0 ? 'Choose at least one sacrament.' : undefined,
  }
  const valid = !errors.range && !errors.sacraments
  const { data, loading, error, reload } = useServerReport<{ report: Report }>(valid ? `/api/priest/reports?${queryFor(config)}` : null, type)
  const report = valid ? (data?.report ?? null) : null

  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : error && !report ? 'error' : !report && valid ? 'loading' : 'ready'
  // Parishioners, offerings entered, or sacraments recorded: the sacramental total is the last column.
  const counted = report?.total ? Number(report.total[type === 'Sacramental' ? report.total.length - 1 : 1]) : 0
  const hasRows = state === 'ready' && !!report && report.rows.length > 0 && counted > 0
  const exportable = hasRows

  const fileName = (ext: string) =>
    `${(report?.title ?? 'report').toLowerCase().replace(/[^a-z]+/g, '-')}-${type === 'Demographic' ? thisMonth() : `${config.from}-to-${config.to}`}.${ext}`

  return (
    <PriestLayout activeHref={PATH}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between print:hidden">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Reports & Analytics</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Choose a report and its options; the figures, chart, and table update as you go. Print, PDF, and CSV use exactly what you see.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!exportable} onClick={() => window.print()} className={btnPrimary}>
            <Icon name="file" className="size-4.5" />
            Print
          </button>
          <button
            type="button"
            disabled={!exportable}
            onClick={() => {
              toast('In the print window, choose “Save as PDF” as the printer.')
              window.setTimeout(() => window.print(), 50)
            }}
            className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Icon name="download" className="size-4.5" />
            Export PDF
          </button>
          <button
            type="button"
            disabled={!exportable}
            onClick={() => {
              if (!report) return
              download(reportCsv(report), fileName('csv'), 'text/csv;charset=utf-8')
              toast(`Downloaded ${fileName('csv')}.`)
            }}
            className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Icon name="download" className="size-4.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Dashboard order: headline figures, then the chart beside its options, then the full table. */}
      {report && hasRows && <ReportSummary report={report} config={config} className="mt-6 print:hidden" />}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12 print:hidden">
        <section aria-labelledby="report-chart-title" className={`${cardClass} min-w-0 xl:col-span-8`}>
          <header className="border-b border-stone-100 px-5 py-4">
            <h2 id="report-chart-title" className="font-serif text-2xl font-semibold text-stone-900">
              {report && state === 'ready' ? report.title : 'Report'}
            </h2>
            {report && state === 'ready' && (
              <p className="text-sm text-stone-600">
                {report.period}
                {loading && <span className="ml-2 text-stone-500">Updating…</span>}
              </p>
            )}
          </header>
          {state === 'loading' ? (
            <LoadingState what="report data" />
          ) : !valid ? (
            <p className="px-5 py-12 text-center text-stone-600">Fix the highlighted options to see the report.</p>
          ) : state === 'error' || (state === 'ready' && !report) ? (
            error && error !== 'error' ? (
              <p className="px-5 py-12 text-center text-stone-600">{error}</p>
            ) : (
              <ErrorState what="report data" help="If it keeps happening, the parish office can check the system." onRetry={reload} />
            )
          ) : !hasRows || !report ? (
            <div className="px-5 py-12 text-center">
              <p className="font-semibold text-stone-800">
                {type === 'Demographic'
                  ? 'No parishioners in the directory yet'
                  : type === 'Financial'
                    ? 'No offerings recorded in this period'
                    : 'Nothing recorded in this period'}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {type === 'Demographic'
                  ? 'The office adds parishioners from the Parishioners page.'
                  : type === 'Financial'
                    ? 'Add entries in the offerings ledger below, or choose a longer period.'
                    : 'Choose a longer period.'}
              </p>
            </div>
          ) : (
            <div className="px-5 py-5">
              {report.note && <p className="mb-4 rounded-lg bg-gold-soft px-3 py-2 text-sm text-brown">{report.note}</p>}
              <p className="mb-3 text-sm font-semibold text-stone-800">{report.chart.title}</p>
              <ReportChart report={report} tall />
            </div>
          )}
        </section>

        {/* The options drive everything else, so on narrower screens they come first. */}
        <div className="max-xl:-order-1 xl:sticky xl:top-24 xl:col-span-4">
          <ReportBuilder
            config={config}
            preset={preset}
            errors={errors}
            onChange={({ type: next, ...rest }) => {
              if (next) {
                const p = new URLSearchParams(query)
                p.set('report', next.toLowerCase())
                navigate(`${PATH}?${p}`, { replace: true })
              }
              setOptions((prev) => ({ ...prev, ...rest }))
            }}
            onPreset={(p) => {
              setPreset(p)
              if (p !== 'custom') setOptions((prev) => ({ ...prev, ...presetRange(p) }))
            }}
          />
        </div>
      </div>

      {report && hasRows && (
        <>
          <section aria-labelledby="report-table-title" className={`${cardClass} mt-6 print:hidden`}>
            <header className="border-b border-stone-100 px-5 py-4">
              <h2 id="report-table-title" className="font-serif text-xl font-semibold text-stone-900">
                Details
              </h2>
              <p className="text-sm text-stone-600">The same figures that Export CSV downloads.</p>
            </header>
            <div className="px-5 py-3">
              <ReportTable report={report} />
            </div>
          </section>
          {/* Print-only sheet: a clean single-page report without the dashboard chrome. */}
          <ReportPreview report={report} preparedBy={preparedBy} className="hidden print:block" />
        </>
      )}

      {/* The Financial report is the ledger added up, so the entries sit right under it. */}
      {type === 'Financial' && valid && state === 'ready' && (
        <OfferingsLedger from={config.from} to={config.to} period={report?.period} onChanged={reload} className="mt-6 print:hidden" />
      )}

      {/* Announces what changed without reading the whole report again. */}
      <p className="sr-only" aria-live="polite">
        {report && state === 'ready' ? `Report updated: ${report.title}, ${report.period}${hasRows ? '' : ', nothing to show'}.` : ''}
      </p>
    </PriestLayout>
  )
}
