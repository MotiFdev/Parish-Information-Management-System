import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import { timeFormat } from '../format'
import type { HealthReading, Loaded } from './dashboardApi'

const errorHelp = 'If it keeps happening, check the server and API logs.'

function Meter({ label, valueText, percent, limit }: { label: string; valueText: string; percent: number | null; limit: number }) {
  if (percent === null)
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-stone-800">{label}</span>
        <span className="text-sm text-stone-500">Not available on this server</span>
      </div>
    )

  const high = percent >= limit
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-stone-800">{label}</span>
        <span className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900 tabular-nums">{valueText}</span>
          <span className={`ml-2 font-semibold ${high ? 'text-red-700' : 'text-forest'}`}>{high ? 'High' : 'Normal'}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} usage`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${valueText}, ${high ? 'high' : 'normal'}`}
        className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200"
      >
        <div className={`h-full rounded-full ${high ? 'bg-red-700' : 'bg-forest'}`} style={{ width: `${Math.min(100, percent)}%` }} />
        {/* Tick at the limit so "Normal" has a visible reference point. */}
        <span className="absolute inset-y-0 w-0.5 bg-stone-500" style={{ left: `${limit}%` }} aria-hidden="true" />
      </div>
    </div>
  )
}

function LatencyChart({ points, limit, minutes }: { points: HealthReading['latency']; limit: number; minutes: number }) {
  const w = 240
  const h = 56
  const values = points.map((p) => p.p95Ms)
  const known = values.filter((v): v is number => v !== null)
  const max = Math.max(...known, limit * 0.5) * 1.15
  const step = w / (values.length - 1)
  const y = (v: number) => (h - (v / max) * h).toFixed(1)

  // Windows with no requests break the line rather than dropping to zero.
  const segments: string[] = []
  let current: string[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current.join(' '))
      current = []
    } else current.push(`${(i * step).toFixed(1)},${y(v)}`)
  })
  if (current.length) segments.push(current.join(' '))

  const dots = values.flatMap((v, i) => (v === null ? [] : [{ x: i * step, y: y(v) }]))
  const peak = Math.max(...known)
  const low = Math.min(...known)

  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Response time over the last ${minutes * values.length} minutes, between ${low} and ${peak} milliseconds.`}
        className="h-16 w-full overflow-visible"
      >
        <line x1="0" x2={w} y1={h} y2={h} className="stroke-stone-300" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {segments.map((pts) => (
          <polyline key={pts} points={pts} fill="none" className="stroke-forest" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {/* A lone reading between gaps has no line, so every reading also gets a dot. */}
        {dots.map((d) => (
          <circle key={d.x} cx={d.x} cy={d.y} r="1.6" className="fill-forest" />
        ))}
      </svg>
      <figcaption className="mt-1.5 flex justify-between text-xs text-stone-500">
        <span>{minutes * values.length} min ago</span>
        <span>Peak {peak} ms</span>
      </figcaption>
    </figure>
  )
}

interface Props {
  state: Loaded<HealthReading>
  onCheck: () => void
  onRetry: () => void
  className?: string
}

export function SystemHealthPanel({ state, onCheck, onRetry, className = '' }: Props) {
  const ready = state.status === 'ready'
  const checking = ready && state.refreshing

  return (
    <section aria-labelledby="health-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 id="health-title" className="font-serif text-xl font-semibold text-stone-900">
            System health
          </h2>
          {ready && <p className="text-sm text-stone-500">Checked at {timeFormat.format(state.data.measuredAt)}</p>}
        </div>
        {ready && (
          <button
            type="button"
            onClick={onCheck}
            disabled={checking}
            className="-mr-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft disabled:cursor-wait disabled:opacity-60"
          >
            <Icon name="refresh" className={`size-4 ${checking ? 'motion-safe:animate-spin' : ''}`} />
            {checking ? 'Checking…' : 'Check again'}
          </button>
        )}
      </header>

      {state.status === 'loading' ? (
        <LoadingState what="server readings" />
      ) : state.status === 'error' ? (
        <ErrorState what="the server readings" help={errorHelp} onRetry={onRetry} />
      ) : (
        <HealthBody reading={state.data} checking={checking} />
      )}
    </section>
  )
}

function HealthBody({ reading, checking }: { reading: HealthReading; checking: boolean }) {
  const { cpuPercent, memoryUsedGb, memoryTotalGb, latency, limits, windowMinutes } = reading
  const ramPercent = memoryUsedGb !== null && memoryTotalGb ? Math.round((memoryUsedGb / memoryTotalGb) * 100) : null
  const latest = [...latency].reverse().find((p) => p.p95Ms !== null)?.p95Ms ?? null
  const latencyHigh = latest !== null && latest >= limits.latencyMs
  const hasLatency = latency.some((p) => p.p95Ms !== null)

  return (
    <div aria-busy={checking} className={`space-y-6 px-5 py-5 transition-opacity ${checking ? 'opacity-50' : ''}`}>
      <Meter label="CPU" valueText={`${cpuPercent}%`} percent={cpuPercent} limit={limits.cpuPercent} />
      <Meter label="Memory" valueText={`${memoryUsedGb} of ${memoryTotalGb} GB`} percent={ramPercent} limit={limits.memoryPercent} />
      <div className="border-t border-stone-100 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span>
            <span className="block font-semibold text-stone-800">API response time</span>
            <span className="block text-xs text-stone-500">95th percentile, every {windowMinutes} minutes</span>
          </span>
          {latest !== null && (
            <span className="text-sm">
              <span className="text-2xl font-semibold text-stone-900 tabular-nums">{latest}</span>
              <span className="text-stone-600"> ms</span>
              <span className={`ml-2 font-semibold ${latencyHigh ? 'text-red-700' : 'text-forest'}`}>{latencyHigh ? 'Slow' : 'Normal'}</span>
            </span>
          )}
        </div>
        {hasLatency ? (
          <LatencyChart points={latency} limit={limits.latencyMs} minutes={windowMinutes} />
        ) : (
          <p className="mt-3 text-sm text-stone-600">No API requests in the last hour yet. The chart fills in as people use the system.</p>
        )}
      </div>
    </div>
  )
}
