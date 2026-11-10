import { useState } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { fromKey, sameSlot, timeLabel, toKey, type Availability, type Slot } from './slots'

interface Props {
  availability: Availability
  venueLabel: string
  selected?: Slot
  onPick: (slot: Slot) => void
}

export function SlotPicker({ availability, venueLabel, selected, onPick }: Props) {
  const { first_date, last_date, times, taken } = availability
  const firstDay = fromKey(first_date)
  const lastDay = fromKey(last_date)
  const isTaken = (slot: Slot) => taken.some((t) => sameSlot(t, slot))
  const fullyBooked = (key: string) => times.every((time) => isTaken({ date: key, time }))

  const [month, setMonth] = useState(() => {
    const start = selected ? fromKey(selected.date) : firstDay
    return new Date(start.getFullYear(), start.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | undefined>(selected?.date)

  const firstWeekday = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]

  const canPrev = month > new Date(firstDay.getFullYear(), firstDay.getMonth(), 1)
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= lastDay
  const shiftMonth = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1))

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
      <div className="-mx-1 rounded-xl border border-stone-200 p-1 sm:mx-0 sm:p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canPrev}
            aria-label="Previous month"
            className="grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon name="chevronLeft" />
          </button>
          <p className="font-serif text-lg font-semibold text-stone-900" aria-live="polite">
            {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canNext}
            aria-label="Next month"
            className="grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon name="chevronRight" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 text-center text-xs font-semibold text-stone-400">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="py-1.5">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 sm:gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`blank-${i}`} />
            const key = toKey(d)
            const full = d >= firstDay && d <= lastDay && fullyBooked(key)
            const disabled = d < firstDay || d > lastDay || full
            const open = key === selectedDate
            const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedDate(key)}
                aria-pressed={open}
                aria-label={full ? `${label}, fully booked` : label}
                className={`relative h-11 rounded-lg text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-stone-300 ${
                  open ? 'bg-forest text-white' : 'text-stone-700 hover:bg-forest-soft enabled:hover:text-forest'
                }`}
              >
                {d.getDate()}
                {selected?.date === key && (
                  <span className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${open ? 'bg-gold' : 'bg-forest'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {selectedDate ? (
          <>
            <p className="text-sm font-semibold text-stone-700">
              {fromKey(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-xs text-stone-500">{venueLabel}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-1">
              {times.map((time) => {
                const slot = { date: selectedDate, time }
                const booked = isTaken(slot)
                const chosen = sameSlot(selected, slot)
                return (
                  <li key={time}>
                    <button
                      type="button"
                      disabled={booked}
                      onClick={() => onPick(slot)}
                      aria-pressed={chosen}
                      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:border-stone-100 disabled:bg-stone-50 disabled:text-stone-400 ${
                        chosen ? 'border-forest bg-forest text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-forest/50'
                      }`}
                    >
                      {timeLabel(time)}
                      <span className="text-xs font-normal">{booked ? 'Booked' : chosen ? 'Selected' : ''}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">
            Pick a date to see open times.
          </p>
        )}
      </div>
    </div>
  )
}
