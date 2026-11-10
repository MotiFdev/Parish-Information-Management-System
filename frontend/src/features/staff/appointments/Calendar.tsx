import { Icon } from '../../../components/ui/Icon'
import type { Appointment } from './appointmentsData'
import { addDays, addMonths, dayKey, dayNumber, longDay, monthGrid, rangeTitle, sameMonth, startOfWeek, timeOf, todayKey, weekdayShort, type View } from './calendarDates'

const MAX_IN_CELL = 3

function Chip({ a, onOpen }: { a: Appointment; onOpen: (a: Appointment) => void }) {
  const pending = a.status === 'Pending'
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs leading-tight ${
        pending ? 'border border-dashed border-gold-deep bg-gold-soft text-stone-900' : 'bg-forest-soft text-stone-900 hover:bg-forest/15'
      }`}
    >
      <span className="font-semibold tabular-nums">{timeOf(a.start)}</span> {pending && <span className="font-semibold text-brown">Pending · </span>}
      {a.type}
    </button>
  )
}

function Row({ a, onOpen }: { a: Appointment; onOpen: (a: Appointment) => void }) {
  const pending = a.status === 'Pending'
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(a)}
        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm hover:border-forest/50 ${pending ? 'border-dashed border-gold-deep bg-gold-soft/50' : 'border-stone-200 bg-white'}`}
      >
        <span className="w-16 shrink-0 font-semibold text-stone-900 tabular-nums">{timeOf(a.start)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-stone-900">
            {a.type}
            {pending && <span className="text-brown"> · Pending</span>}
          </span>
          <span className="block text-stone-700">{a.title}</span>
          <span className="block text-xs text-stone-600">
            {a.venue}
            {a.assigned && ` · ${a.assigned}`}
          </span>
        </span>
      </button>
    </li>
  )
}

interface Props {
  view: View
  anchor: string
  events: Appointment[]
  onView: (v: View) => void
  onAnchor: (key: string) => void
  /** Jump to one day in day view; a single update so the date and view change together. */
  onDay: (key: string) => void
  onOpen: (a: Appointment) => void
}

export function Calendar({ view, anchor, events, onView, onAnchor, onDay, onOpen }: Props) {
  const today = todayKey()
  const byDay = new Map<string, Appointment[]>()
  for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
    const k = dayKey(e.start)
    byDay.set(k, [...(byDay.get(k) ?? []), e])
  }
  const step = (dir: 1 | -1) => onAnchor(view === 'month' ? addMonths(anchor, dir) : addDays(anchor, view === 'week' ? 7 * dir : dir))
  const openDay = onDay

  return (
    <section aria-labelledby="cal-title" className="rounded-2xl border border-stone-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label={`Previous ${view}`} className="grid size-11 place-items-center rounded-lg text-stone-700 hover:bg-stone-100">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={`Next ${view}`} className="grid size-11 place-items-center rounded-lg text-stone-700 hover:bg-stone-100">
            <Icon name="chevronRight" />
          </button>
          <button type="button" onClick={() => onAnchor(today)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft">
            Today
          </button>
          <h2 id="cal-title" aria-live="polite" className="ml-2 font-serif text-xl font-semibold text-stone-900 sm:text-2xl">
            {rangeTitle(view, anchor)}
          </h2>
        </div>
        <div role="group" aria-label="Calendar view" className="flex rounded-lg border border-stone-300 p-0.5">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              className={`min-h-10 rounded-md px-3 text-sm font-semibold capitalize ${view === v ? 'bg-forest text-white' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {view === 'month' && (
        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-stone-600" aria-hidden="true">
            {monthGrid(anchor)
              .slice(0, 7)
              .map((k) => (
                <span key={k} className="py-1.5">
                  {weekdayShort(k)}
                </span>
              ))}
          </div>
          <div role="grid" aria-label={rangeTitle('month', anchor)} className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200">
            {monthGrid(anchor).map((k) => {
              const items = byDay.get(k) ?? []
              const pendingCount = items.filter((i) => i.status === 'Pending').length
              const inMonth = sameMonth(k, anchor)
              return (
                <div key={k} role="gridcell" aria-label={`${longDay(k)}, ${items.length} ${items.length === 1 ? 'event' : 'events'}${pendingCount ? `, ${pendingCount} pending` : ''}`} className={`min-h-16 p-1 md:min-h-28 ${inMonth ? 'bg-white' : 'bg-stone-50'}`}>
                  <button
                    type="button"
                    onClick={() => openDay(k)}
                    aria-label={`Open ${longDay(k)}`}
                    className={`grid size-8 place-items-center rounded-full text-sm tabular-nums hover:bg-forest-soft ${
                      k === today ? 'bg-forest font-semibold text-white hover:bg-forest-dark' : inMonth ? 'text-stone-800' : 'text-stone-500'
                    }`}
                  >
                    {dayNumber(k)}
                  </button>
                  {/* Phones: a count to tap. Wider screens: the events themselves. */}
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openDay(k)}
                      aria-hidden="true"
                      tabIndex={-1}
                      className={`mt-0.5 block rounded px-1 text-[11px] font-semibold tabular-nums md:hidden ${pendingCount ? 'border border-dashed border-gold-deep bg-gold-soft text-brown' : 'bg-forest-soft text-forest'}`}
                    >
                      {items.length}
                    </button>
                  )}
                  <div className="mt-1 hidden space-y-1 md:block">
                    {items.slice(0, MAX_IN_CELL).map((a) => (
                      <Chip key={a.id} a={a} onOpen={onOpen} />
                    ))}
                    {items.length > MAX_IN_CELL && (
                      <button type="button" onClick={() => openDay(k)} className="w-full rounded px-1.5 py-0.5 text-left text-xs font-semibold text-forest hover:bg-forest-soft">
                        {items.length - MAX_IN_CELL} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="grid gap-3 p-3 md:grid-cols-7 md:gap-2">
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)).map((k) => {
            const items = byDay.get(k) ?? []
            return (
              <div key={k} className="min-w-0">
                <button
                  type="button"
                  onClick={() => openDay(k)}
                  className={`mb-1.5 flex min-h-11 w-full items-baseline gap-1.5 rounded-lg px-2 text-left text-sm ${k === today ? 'bg-forest text-white' : 'text-stone-800 hover:bg-stone-100'}`}
                >
                  <span className="font-semibold">{weekdayShort(k)}</span>
                  <span className="tabular-nums">{dayNumber(k)}</span>
                </button>
                {items.length ? (
                  <div className="space-y-1">
                    {items.map((a) => (
                      <Chip key={a.id} a={a} onOpen={onOpen} />
                    ))}
                  </div>
                ) : (
                  <p className="px-2 text-xs text-stone-500">Nothing booked</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {view === 'day' && (
        <div className="p-4 sm:p-5">
          {(byDay.get(anchor) ?? []).length ? (
            <ul className="space-y-2">
              {(byDay.get(anchor) ?? []).map((a) => (
                <Row key={a.id} a={a} onOpen={onOpen} />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-stone-600">Nothing booked on {longDay(anchor)}.</p>
          )}
        </div>
      )}
    </section>
  )
}
