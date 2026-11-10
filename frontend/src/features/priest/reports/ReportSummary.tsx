import { StatTile } from '../../../components/ui/StatTile'
import type { IconName } from '../../../components/ui/Icon'
import { number, peso } from './reportFormat'
import type { Report, ReportConfig } from './reportData'

interface Stat {
  icon: IconName
  label: string
  value: string
  note: string
}

const share = (part: number, whole: number) => `${whole ? ((part / whole) * 100).toFixed(1) : '0'}%`

/** Four headline figures for whichever report is chosen, read straight from its rows. */
function stats(r: Report, c: ReportConfig): Stat[] {
  const items = r.chart.items
  const top = [...items].sort((a, b) => b.value - a.value)[0]
  const low = [...items].sort((a, b) => a.value - b.value)[0]
  const total = Number(r.total?.[1] ?? 0)

  if (c.type === 'Sacramental') {
    const grand = Number(r.total?.[r.total.length - 1] ?? 0)
    // Columns 1..n-2 are the sacraments; the last column is the row total.
    const kinds = r.columns.slice(1, -1).map((label, i) => ({ label, value: Number(r.total?.[i + 1] ?? 0) }))
    const common = [...kinds].sort((a, b) => b.value - a.value)[0]
    return [
      { icon: 'book', label: 'Sacraments recorded', value: number.format(grand), note: r.period },
      { icon: 'chart', label: 'Busiest month', value: top ? top.label : 'None', note: top ? `${number.format(top.value)} recorded` : '' },
      {
        icon: 'calendar',
        label: 'Monthly average',
        value: number.format(Math.round(grand / Math.max(1, r.rows.length))),
        note: `Over ${r.rows.length} ${r.rows.length === 1 ? 'month' : 'months'}`,
      },
      {
        icon: 'seal',
        label: 'Most recorded',
        value: common?.label ?? 'None',
        note: common ? `${number.format(common.value)}, ${share(common.value, grand)} of the total` : '',
      },
    ]
  }

  if (c.type === 'Financial') {
    // Columns: category, entries, amount, share.
    const total = Number(r.total?.[2] ?? 0)
    const months = r.months ?? 1
    return [
      { icon: 'chart', label: 'Total collected', value: peso.format(total), note: r.period },
      { icon: 'seal', label: 'Largest category', value: top?.label ?? 'None', note: top ? `${peso.format(top.value)}, ${share(top.value, total)}` : '' },
      {
        icon: 'calendar',
        label: 'Monthly average',
        value: peso.format(Math.round(total / months)),
        note: `Over ${months} ${months === 1 ? 'month' : 'months'}`,
      },
      { icon: 'list', label: 'Smallest category', value: low?.label ?? 'None', note: low ? `${peso.format(low.value)}, ${share(low.value, total)}` : '' },
    ]
  }

  const groupName = { sona: 'Sona', age: 'age group', sex: 'group' }[c.groupBy]
  return [
    { icon: 'users', label: 'Parishioners', value: number.format(total), note: r.period },
    { icon: 'chart', label: `Largest ${groupName}`, value: top?.label ?? 'None', note: top ? `${number.format(top.value)}, ${share(top.value, total)}` : '' },
    { icon: 'list', label: `Smallest ${groupName}`, value: low?.label ?? 'None', note: low ? `${number.format(low.value)}, ${share(low.value, total)}` : '' },
    { icon: 'mapPin', label: c.groupBy === 'sona' ? 'Sonas' : 'Groups', value: number.format(items.length), note: 'In this report' },
  ]
}

export function ReportSummary({ report, config, className = '' }: { report: Report; config: ReportConfig; className?: string }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {stats(report, config).map((s) => (
        <StatTile key={s.label} icon={s.icon} label={s.label} value={s.value} note={s.note} />
      ))}
    </div>
  )
}
