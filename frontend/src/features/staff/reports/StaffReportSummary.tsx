import type { IconName } from '../../../components/ui/Icon'
import { StatTile } from '../../../components/ui/StatTile'
import type { Report } from '../../priest/reports/reportData'
import { number } from '../../priest/reports/reportFormat'
import type { StaffReportConfig } from './staffReports'

interface Stat {
  icon: IconName
  label: string
  value: string
  note: string
}

const share = (part: number, whole: number) => `${whole ? Math.round((part / whole) * 100) : 0}%`

/** Four headline figures for whichever report is open, read straight from its rows. */
function stats(r: Report, c: StaffReportConfig): Stat[] {
  if (c.type === 'daily') {
    // The chart counts entries per kind of work, using the audit log's category names.
    const count = (category: string) => r.chart.items.find((i) => i.label === category)?.value ?? 0
    const people = new Set(r.rows.map((row) => row[1])).size
    return [
      { icon: 'list', label: 'Entries logged', value: number.format(r.rows.length), note: r.period },
      { icon: 'file', label: 'Request updates', value: number.format(count('Record requests')), note: 'Status changes, remarks, and links' },
      { icon: 'check', label: 'Document work', value: number.format(count('Document verification')), note: 'Checked, uploaded, or filed' },
      {
        icon: 'seal',
        label: 'Certificates released',
        value: number.format(count('Certificate release')),
        note: `${people} ${people === 1 ? 'person' : 'people'} logged work`,
      },
    ]
  }

  if (c.type === 'turnaround') {
    const [, done, avg, fastest, slowest] = r.total ?? []
    const groups = r.rows.filter((row) => Number(row[1]) > 0)
    const slow = [...groups].sort((a, b) => Number(b[2]) - Number(a[2]))[0]
    return [
      { icon: 'check', label: 'Requests completed', value: number.format(Number(done)), note: r.period },
      { icon: 'clock', label: 'Average turnaround', value: `${number.format(Number(avg))} days`, note: 'Submission to ready for collection' },
      { icon: 'chart', label: 'Range', value: `${fastest} to ${slowest} days`, note: 'Fastest and slowest request' },
      {
        icon: 'alert',
        label: 'Slowest on average',
        value: slow ? String(slow[0]) : 'None',
        note: slow ? `${number.format(Number(slow[2]))} days across ${slow[1]} requests` : '',
      },
    ]
  }

  if (c.type === 'appointments') {
    const [, , approved, rejected, total] = (r.total ?? []).map(Number)
    const busiest = [...r.rows].sort((a, b) => Number(b[4]) - Number(a[4]))[0]
    const chapelRows = r.rows.filter((row) => row[0] !== 'Parish Church' && row[0] !== 'Homes')
    const topChapel = [...chapelRows].sort((a, b) => Number(b[4]) - Number(a[4]))[0]
    return [
      { icon: 'calendar', label: 'Booking requests', value: number.format(total), note: r.period },
      { icon: 'check', label: 'Approved', value: number.format(approved), note: `${share(approved, total)} of requests, ${number.format(rejected)} rejected` },
      {
        icon: 'church',
        label: 'Busiest venue',
        value: busiest ? String(busiest[0]) : 'None',
        note: busiest ? `${number.format(Number(busiest[4]))} requests` : '',
      },
      {
        icon: 'mapPin',
        label: 'Busiest chapel',
        value: topChapel && Number(topChapel[4]) ? String(topChapel[0]) : 'None',
        note: topChapel ? `${number.format(Number(topChapel[4]))} requests, Sona ${topChapel[1]}` : '',
      },
    ]
  }

  const grand = Number(r.total?.[r.total.length - 1] ?? 0)
  const kinds = r.columns.slice(1, -1).map((label, i) => ({ label, value: Number(r.total?.[i + 1] ?? 0) }))
  const common = [...kinds].sort((a, b) => b.value - a.value)[0]
  const top = [...r.chart.items].sort((a, b) => b.value - a.value)[0]
  return [
    { icon: 'book', label: 'Sacraments recorded', value: number.format(grand), note: r.period },
    {
      icon: 'seal',
      label: 'Most recorded',
      value: common?.label ?? 'None',
      note: common ? `${number.format(common.value)}, ${share(common.value, grand)} of the total` : '',
    },
    { icon: 'chart', label: 'Busiest month', value: top?.label ?? 'None', note: top ? `${number.format(top.value)} recorded` : '' },
    {
      icon: 'calendar',
      label: 'Monthly average',
      value: number.format(Math.round(grand / Math.max(1, r.rows.length))),
      note: `Over ${r.rows.length} ${r.rows.length === 1 ? 'month' : 'months'}`,
    },
  ]
}

export function StaffReportSummary({ report, config, className = '' }: { report: Report; config: StaffReportConfig; className?: string }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {stats(report, config).map((s) => (
        <StatTile key={s.label} icon={s.icon} label={s.label} value={s.value} note={s.note} />
      ))}
    </div>
  )
}
