import { parish } from '../../parishioner/sampleData'
import { ReportChart, ReportTable } from './ReportParts'
import type { Report } from './reportData'

const today = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })

interface Props {
  report: Report
  preparedBy: string
  className?: string
}

/** The printed report sheet. Print and PDF use exactly this element (see the print rules in index.css). */
export function ReportPreview({ report: r, preparedBy, className = '' }: Props) {
  return (
    <article id="report-print" aria-label={`${r.title} report`} className={`bg-white ${className}`}>
      <header className="border-b border-stone-300 pb-4">
        <p className="font-serif text-lg font-semibold text-forest">{parish.name}</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-stone-900">{r.title}</h2>
        <p className="mt-1 text-stone-700">{r.period}</p>
        <p className="mt-0.5 text-sm text-stone-600">
          Prepared by {preparedBy} on {today.format(new Date())}
        </p>
        {r.note && <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-brown">{r.note}</p>}
      </header>
      <figure className="mt-5">
        <figcaption className="mb-3 text-sm font-semibold text-stone-800">{r.chart.title}</figcaption>
        <ReportChart report={r} />
      </figure>
      <div className="mt-6">
        <ReportTable report={r} />
      </div>
    </article>
  )
}
