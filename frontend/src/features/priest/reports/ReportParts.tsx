import type { Report } from './reportData'
import { number, peso } from './reportFormat'

// Ranked horizontal bars, one hue, value at each bar's tip: the parts are few
// and the reader compares them, so a pie would only hide the differences.
function Bars({ items, money }: { items: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-2.5" aria-hidden="true">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
          <span className="truncate text-stone-700">{i.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-4 rounded-r bg-forest print:bg-stone-700" style={{ width: `${Math.max(1, (i.value / max) * 80)}%` }} />
            <span className="text-xs font-semibold whitespace-nowrap text-stone-800 tabular-nums">{money ? peso.format(i.value) : number.format(i.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Columns({ items, tall }: { items: { label: string; value: number }[]; tall?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div aria-hidden="true">
      <div className={`flex items-end gap-1 border-b border-stone-300 ${tall ? 'h-56' : 'h-32'}`}>
        {items.map((i) => (
          <div key={i.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] text-stone-700 tabular-nums">{i.value}</span>
            <span className="w-full max-w-6 rounded-t bg-forest print:bg-stone-700" style={{ height: `${Math.max(2, (i.value / max) * 82)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[11px] text-stone-600">
        {items.map((i, n) => (
          <span key={i.label} className="flex-1 text-center">
            {items.length <= 6 || n % 2 === 0 ? i.label.split(' ')[0] : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ReportChart({ report, tall }: { report: Report; tall?: boolean }) {
  return report.chart.kind === 'bars' ? <Bars items={report.chart.items} money={report.chart.money} /> : <Columns items={report.chart.items} tall={tall} />
}

export function ReportTable({ report: r }: { report: Report }) {
  const cell = (v: string | number, col: number) => (typeof v === 'number' ? (r.money?.includes(col) ? peso.format(v) : number.format(v)) : v)
  const left = (col: number) => col === 0 || r.textColumns?.includes(col)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">
          {r.title}, {r.period}
        </caption>
        <thead>
          <tr className="border-b border-stone-300 text-stone-600">
            {r.columns.map((c, i) => (
              <th key={c} scope="col" className={`py-2 font-semibold ${i === 0 ? 'pr-4 text-left' : left(i) ? 'px-3 text-left' : 'px-3 text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {r.rows.map((row, n) => (
            <tr key={n}>
              {row.map((v, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap text-stone-800">
                    {v}
                  </th>
                ) : (
                  <td key={i} className={`px-3 py-2 text-stone-800 ${left(i) ? 'min-w-40 text-left' : 'text-right'}`}>
                    {cell(v, i)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {r.total && (
          <tfoot>
            <tr className="border-t-2 border-stone-400">
              {r.total.map((v, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-4 text-left font-semibold text-stone-900">
                    {v}
                  </th>
                ) : (
                  <td key={i} className={`px-3 py-2 font-semibold text-stone-900 ${left(i) ? 'text-left' : 'text-right'}`}>
                    {cell(v, i)}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
