import { useState, type FormEvent } from 'react'
import { Link } from '../../../components/Link'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, cardClass, inputClass } from '../../../components/ui/styles'
import type { PreviewState } from '../../../lib/preview'
import type { SearchHit } from '../../priest/aiSearch/search'
import { noFilters, searchRegisters } from '../../aiSearch/aiSearchApi'

const TOP = 3
const year = (iso: string) => iso.slice(0, 4)

type Answer = { asked: string; hits: SearchHit[] } | { asked: string; error: string }

interface Props {
  state: PreviewState
  /** From the dashboard data; null while it loads. */
  ai: { ready: boolean; strong: number } | null
  className?: string
}

// A quick lookup from the dashboard: the top few matches inline, the full
// results (history, filters) on the AI Record Search page. Same search as that
// page, so it is saved to the person's history there too.
export function AiSearchCard({ state, ai, className = '' }: Props) {
  const [draft, setDraft] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const strong = ai?.strong ?? 0.75
  const usable = state === 'ready' && !!ai?.ready

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const q = draft.trim()
    if (!q) {
      setError('Type a name, year, or parent’s name.')
      return document.getElementById('dash-ai-q')?.focus()
    }
    setError(undefined)
    setBusy(true)
    const r = await searchRegisters(q, noFilters, true)
    setBusy(false)
    setAnswer('error' in r ? { asked: q, error: r.error } : { asked: q, hits: r.results })
  }

  const asked = answer?.asked ?? ''
  const hits = answer && 'hits' in answer ? answer.hits : []

  return (
    <section aria-labelledby="dash-ai-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="border-b border-stone-100 px-5 py-4">
        <h2 id="dash-ai-title" className="font-serif text-2xl font-semibold text-stone-900">
          AI Record Search
        </h2>
        <p className="text-sm text-stone-600">Find a register entry by asking in plain words.</p>
      </header>

      <form role="search" onSubmit={submit} className="px-5 pt-4">
        <label htmlFor="dash-ai-q" className="sr-only">
          Search the registers
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
            <input
              id="dash-ai-q"
              type="search"
              value={draft}
              maxLength={300}
              onChange={(e) => {
                setDraft(e.target.value)
                setError(undefined)
              }}
              disabled={!usable}
              placeholder="e.g. Dela Cruz baptism 1987"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'dash-ai-q-error' : undefined}
              className={`${inputClass} pl-10 disabled:bg-stone-50`}
            />
          </div>
          <button type="submit" disabled={!usable || busy} className={`${btnPrimary} disabled:cursor-wait`}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error && (
          <p id="dash-ai-q-error" className="mt-1.5 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      <div aria-live="polite" className="flex-1 px-5 py-4">
        {state === 'loading' ? (
          <p className="text-sm text-stone-600">Loading…</p>
        ) : state === 'error' ? (
          <p className="text-sm text-stone-700">Search is unavailable right now. If it keeps happening, tell the system administrator.</p>
        ) : state === 'empty' ? (
          <p className="text-sm text-stone-700">Nothing is indexed yet, so there is nothing to search.</p>
        ) : ai && !ai.ready ? (
          <p className="text-sm text-stone-700">AI search is not set up yet. The system administrator needs to add the Gemini API key on the server.</p>
        ) : busy ? (
          <p role="status" className="flex items-center gap-2 text-sm text-stone-600">
            <span className="size-4 rounded-full border-2 border-forest/25 border-t-forest motion-safe:animate-spin" aria-hidden="true" />
            Searching the registers…
          </p>
        ) : answer && 'error' in answer ? (
          <p role="alert" className="text-sm text-stone-700">
            {answer.error}
          </p>
        ) : !answer ? (
          <p className="text-sm text-stone-600">
            The best {TOP} matches show here. Scores of {strong.toFixed(2)} and above are strong matches.
          </p>
        ) : hits.length === 0 ? (
          <p className="text-sm text-stone-700">No entries matched “{asked}” closely enough. Try a surname alone or a year.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-stone-600">
              {hits.length} {hits.length === 1 ? 'match' : 'matches'} for “{asked}”
            </p>
            <ol className="space-y-2">
              {hits.slice(0, TOP).map((h) => (
                <li key={h.entry.id}>
                  <Link
                    href={`/secretary/sacraments?register=${h.entry.type.toLowerCase()}&entry=${h.entry.id}`}
                    className="flex min-h-11 items-start justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 hover:border-forest/50 hover:bg-forest-soft/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-stone-900">{h.entry.subject}</span>
                      <span className="block text-sm text-stone-600">
                        {h.entry.type} · {year(h.entry.date)} · Book {h.entry.register.book}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${h.score >= strong ? 'text-forest' : 'text-stone-700'}`}>
                      {h.score.toFixed(2)}
                      <span className="sr-only">{h.score >= strong ? ', strong match' : ', match'}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-stone-100 px-5 py-3">
        <Link
          href={asked ? `/secretary/ai-search?q=${encodeURIComponent(asked)}` : '/secretary/ai-search'}
          className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-forest hover:underline"
        >
          {asked && hits.length > TOP ? `See all ${hits.length} results` : 'Open AI Record Search'}
          <Icon name="chevronRight" className="size-4" />
        </Link>
      </div>
    </section>
  )
}
