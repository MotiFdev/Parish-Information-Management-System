import { useState } from 'react'
import { inputClass } from '../../components/ui/styles'
import { OfferingsLedger } from '../../features/offerings/OfferingsLedger'
import { addMonths, thisMonth } from '../../features/staff/reports/staffReports'
import { StaffLayout } from '../../layouts/StaffLayout'

const PATH = '/secretary/offerings'
const monthLong = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const label = (m: string) => monthLong.format(new Date(`${m}-01T00:00:00Z`))

type Period = 'month' | 'last3' | 'year' | 'last12'
const periods: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'year', label: 'This year so far' },
  { value: 'last12', label: 'Last 12 months' },
]

const rangeOf = (p: Period) => {
  const now = thisMonth()
  const from = p === 'month' ? now : p === 'last3' ? addMonths(now, -2) : p === 'year' ? `${now.slice(0, 4)}-01` : addMonths(now, -11)
  return { from, to: now }
}

// The offerings ledger for the parish office. The priest sees the same entries,
// added up, in Reports & Analytics > Financial.
export default function OfferingsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const { from, to } = rangeOf(period)

  return (
    <StaffLayout activeHref={PATH}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Offerings</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        Record collections, Mass intentions, stole and certificate fees, and donations as they come in. The priest sees the totals in the Financial report.
      </p>

      <div className="mt-6 sm:w-64">
        <label htmlFor="offerings-period" className="mb-1.5 block text-sm font-medium text-stone-700">
          Period
        </label>
        <select id="offerings-period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={inputClass}>
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <OfferingsLedger from={from} to={to} period={from === to ? label(from) : `${label(from)} to ${label(to)}`} className="mt-4" />
    </StaffLayout>
  )
}
