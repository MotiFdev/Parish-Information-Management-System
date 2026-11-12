import { useState } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, btnSecondary, cardClass } from '../../components/ui/styles'
import type { PeriodPreset } from '../../features/priest/reports/ReportBuilder'
import { reportCsv } from '../../features/priest/reports/reportData'
import { ReportPreview } from '../../features/priest/reports/ReportPreview'
import { ReportChart, ReportTable } from '../../features/priest/reports/ReportParts'
import { sacraments } from '../../features/priest/sampleData'
import { StaffReportBuilder } from '../../features/staff/reports/StaffReportBuilder'
import { StaffReportSummary } from '../../features/staff/reports/StaffReportSummary'
import {
  addMonths,
  reportTypes,
  thisMonth,
  todayKey,
  useStaffReport,
  type ReportOptions,
  type StaffReportConfig,
  type StaffReportType,
} from '../../features/staff/reports/staffReports'
import { useAccountName } from '../../features/auth/useAccountName'
import { StaffLayout } from '../../layouts/StaffLayout'
import { download } from '../../lib/download'
import { navigate, useLocation } from '../../lib/router'
import { useStaffDefaults } from '../../features/staff/settings/settingsApi'

const PATH = '/secretary/reports'
const noOptions: ReportOptions = { people: [], categories: [], event_types: [] }
/** Periods end with the current month, so they move on as time passes. */
const presetRange = (p: Exclude<PeriodPreset, 'custom'>): Pick<StaffReportConfig, 'from' | 'to'> => {
  const now = thisMonth()
  return p === 'last12' ? { from: addMonths(now, -11), to: now } : { from: `${now.slice(0, 4)}-01`, to: now }
}

export default function StaffReportsPage() {
  const startPeriod = useStaffDefaults().reportPeriod
  const preparedBy = `${useAccountName().full}, Parish Office`
  const { query } = useLocation()
  const { toast } = useToast()
  // ?report= picks the report, so each one can be linked to from elsewhere.
  const type = (reportTypes.find((t) => t.value === query.get('report'))?.value ?? 'daily') as StaffReportType
  const [options, setOptions] = useState<Omit<StaffReportConfig, 'type'>>({
    date: todayKey(),
    activity: 'all',
    staff: '',
    ...presetRange(startPeriod),
    sacraments,
    groupBy: 'recordType',
    eventType: 'all',
  })
  const [preset, setPreset] = useState<PeriodPreset>(startPeriod)
  const config: StaffReportConfig = { ...options, type }

  const errors = {
    date: type === 'daily' && !config.date ? 'Choose a day.' : type === 'daily' && config.date > todayKey() ? 'Choose today or an earlier day.' : undefined,
    range:
      type !== 'daily' && config.from > config.to
        ? 'The start month is after the end month.'
        : type !== 'daily' && config.to > thisMonth()
          ? 'Choose this month or an earlier one.'
          : undefined,
    sacraments: type === 'sacramental' && config.sacraments.length === 0 ? 'Choose at least one sacrament.' : undefined,
  }
  const valid = !errors.date && !errors.range && !errors.sacraments
  const { data, loading, error } = useStaffReport(config, valid)
  const report = valid ? (data?.report ?? null) : null
  const choices = data?.options ?? noOptions
  const ready = !!report
  const state = error && !report ? 'error' : !report && valid ? 'loading' : 'ready'
  const hasRows = !!report && report.rows.length > 0
  const exportable = ready && hasRows

  const fileName = (ext: string) =>
    `${(report?.title ?? 'report').toLowerCase().replace(/[^a-z]+/g, '-')}-${type === 'daily' ? config.date : `${config.from}-to-${config.to}`}.${ext}`

  return (
    <StaffLayout activeHref={PATH}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between print:hidden">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">Reports</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            Pick a report and its options. The figures, chart, and table update as you go, and Print, PDF, and CSV use exactly what you see.
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
      {report && ready && hasRows && <StaffReportSummary report={report} config={config} className="mt-6 print:hidden" />}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12 print:hidden">
        <section aria-labelledby="sr-chart-title" className={`${cardClass} min-w-0 xl:col-span-8`}>
          <header className="border-b border-stone-100 px-5 py-4">
            <h2 id="sr-chart-title" className="font-serif text-2xl font-semibold text-stone-900">
              {report && ready ? report.title : 'Report'}
            </h2>
            {report && ready && (
              <p className="text-sm text-stone-600">
                {report.period}
                {loading && <span className="ml-2 text-stone-500">Updating…</span>}
              </p>
            )}
          </header>
          {state === 'loading' ? (
            <LoadingState what="report data" variant="chart" />
          ) : !valid ? (
            <p className="px-5 py-12 text-center text-stone-600">Fix the highlighted options to see the report.</p>
          ) : state === 'error' || !report ? (
            error && error !== 'error' ? (
              <p className="px-5 py-12 text-center text-stone-600">{error}</p>
            ) : (
              <ErrorState what="report data" help="If it keeps happening, tell the system administrator." />
            )
          ) : !hasRows ? (
            <div className="px-5 py-12 text-center">
              <p className="font-semibold text-stone-800">{type === 'daily' ? 'No office work was logged on this day' : 'Nothing recorded in this period'}</p>
              <p className="mt-1 text-sm text-stone-600">
                {type === 'daily' ? 'Choose another day, or set Kind of work and Done by back to everyone.' : 'Choose a longer period.'}
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
          <StaffReportBuilder
            config={config}
            options={choices}
            preset={preset}
            errors={errors}
            onChange={({ type: next, ...rest }) => {
              if (next) {
                const p = new URLSearchParams(query)
                p.set('report', next)
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

      {report && ready && hasRows && (
        <>
          <section aria-labelledby="sr-table-title" className={`${cardClass} mt-6 print:hidden`}>
            <header className="border-b border-stone-100 px-5 py-4">
              <h2 id="sr-table-title" className="font-serif text-xl font-semibold text-stone-900">
                {type === 'daily' ? 'Log entries' : 'Details'}
              </h2>
              <p className="text-sm text-stone-600">
                {type === 'daily' ? 'In the order they happened. Export CSV downloads this list.' : 'The same figures that Export CSV downloads.'}
              </p>
            </header>
            {/* On phones the five-column log reads better as one card per entry; the table stays for wider screens and print. */}
            {type === 'daily' && (
              <ol className="divide-y divide-stone-100 md:hidden">
                {report.rows.map((row, i) => (
                  <li key={i} className="px-5 py-3 text-sm">
                    <p className="flex flex-wrap gap-x-2">
                      <span className="font-semibold text-stone-900 tabular-nums">{row[0]}</span>
                      <span className="text-stone-700">{row[1]}</span>
                    </p>
                    <p className="font-semibold text-stone-900">{row[2]}</p>
                    <p className="break-words text-stone-700">{row[3]}</p>
                    {row[4] && <p className="mt-0.5 break-words text-stone-600">{row[4]}</p>}
                  </li>
                ))}
              </ol>
            )}
            <div className={`px-5 py-3 ${type === 'daily' ? 'max-md:hidden' : ''}`}>
              <ReportTable report={report} />
            </div>
          </section>
          {/* Print-only sheet: a clean report without the page around it. */}
          <ReportPreview report={report} preparedBy={preparedBy} className="hidden print:block" />
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {report && ready ? `Report updated: ${report.title}, ${report.period}${hasRows ? '' : ', nothing to show'}.` : ''}
      </p>
    </StaffLayout>
  )
}
