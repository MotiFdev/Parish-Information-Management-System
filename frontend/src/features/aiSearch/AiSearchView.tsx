import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { ResultCard } from '../priest/aiSearch/ResultCard'
import { examples, type SearchHit } from '../priest/aiSearch/search'
import { sacraments, type Sacrament } from '../priest/sampleData'
import { clearSearches, forgetSearch, noFilters, searchRegisters, useSearchPage, type HistoryItem, type AiSearchBase, type SearchFilters } from './aiSearchApi'
import { usePreviewState } from '../../lib/preview'
import { navigate, useLocation } from '../../lib/router'

const SHOW = 10
const TZ = 'Asia/Manila'
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: TZ })

function when(iso: string) {
  const d = new Date(iso)
  const days = Math.round((new Date(dayKey.format(new Date())).getTime() - new Date(dayKey.format(d)).getTime()) / 86_400_000)
  return `${days === 0 ? 'Today' : days === 1 ? 'Yesterday' : dateFmt.format(d)}, ${timeFmt.format(d)}`
}

/** "Marriage · 2015 onward · strong only", or nothing when no filter is set. */
function filterSummary(f: SearchFilters) {
  const range = f.from && f.to ? (f.from === f.to ? f.from : `${f.from} to ${f.to}`) : f.from ? `${f.from} onward` : f.to ? `up to ${f.to}` : ''
  return [f.type !== 'all' && f.type, range, f.strongOnly && 'strong matches only'].filter(Boolean).join(' · ')
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const same = (a: SearchFilters & { q: string }, q: string, f: SearchFilters) =>
  a.q.toLowerCase() === q.toLowerCase() && a.type === f.type && a.from === f.from && a.to === f.to && a.strongOnly === f.strongOnly

/** One search request, keyed by its question and filters so a stale answer is never shown for a newer one. */
type Answer = { key: string; hits: SearchHit[]; type: Sacrament | null } | { key: string; error: string }

interface Props {
  /** The portal's API path for the search. */
  base: AiSearchBase
  /** This page's own path, for the question and filters in the URL. */
  path: string
  /** Where "View entry" opens the register entry in this portal. */
  entryHref: (entry: SearchHit['entry']) => string
}

// AI Record Search, shared by the staff and priest portals: the page wraps it
// in its own layout and says where entries open.
export function AiSearchView({ base, path, entryHref }: Props) {
  const preview = usePreviewState()
  const { query } = useLocation()
  const { toast } = useToast()
  const page = useSearchPage(base)
  const years = page.data?.years ?? []
  const q = query.get('q') ?? ''
  const filters: SearchFilters = {
    type: (sacraments.find((s) => s.toLowerCase() === query.get('type')) ?? 'all') as Sacrament | 'all',
    from: /^\d{4}$/.test(query.get('from') ?? '') ? query.get('from')! : '',
    to: /^\d{4}$/.test(query.get('to') ?? '') ? query.get('to')! : '',
    strongOnly: query.get('strong') === '1',
  }
  const key = q ? JSON.stringify([q, filters]) : ''
  const [draft, setDraft] = useState(q)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [clearing, setClearing] = useState(false)
  const [shown, setShown] = useState(SHOW)
  const [error, setError] = useState<string>()
  // Only a question the person just asked is saved; a filter change or a reopened link is not.
  const saveNext = useRef(false)

  // Filters and the question live in the URL, so a result list can be shared or reopened.
  const go = (text: string, f: SearchFilters, replace = false) => {
    const p = new URLSearchParams()
    if (text) p.set('q', text)
    if (f.type !== 'all') p.set('type', f.type.toLowerCase())
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
    if (f.strongOnly) p.set('strong', '1')
    if (query.get('preview')) p.set('preview', query.get('preview')!)
    navigate(`${path}${p.size ? `?${p}` : ''}`, { replace })
  }

  const { setHistory } = page
  useEffect(() => {
    if (!key || preview !== 'ready') return
    let cancelled = false
    const [text, f] = JSON.parse(key) as [string, SearchFilters]
    const save = saveNext.current
    saveNext.current = false
    searchRegisters(text, f, save, base).then((r) => {
      if (cancelled) return
      if ('error' in r) return setAnswer({ key, error: r.error })
      setAnswer({ key, hits: r.results, type: r.type })
      const saved = r.saved
      if (saved) setHistory((h) => [saved, ...h.filter((x) => x.id !== saved.id && !same(x, saved.q, saved))])
    })
    return () => {
      cancelled = true
    }
  }, [key, attempt, preview, setHistory, base])

  const run = (text: string, given: SearchFilters) => {
    const t = text.trim()
    // Same key order as the URL-derived filters, and no extra fields from a history item.
    const f: SearchFilters = { type: given.type, from: given.from, to: given.to, strongOnly: given.strongOnly }
    if (!t) {
      setError('Type a question, such as a name, a year, or a parent’s name.')
      return document.getElementById('sai-q')?.focus()
    }
    setError(undefined)
    setDraft(t)
    setShown(SHOW)
    saveNext.current = true
    // Asking the same thing again still searches (and moves it to the top of the history).
    if (JSON.stringify([t, f]) === key) setAttempt((n) => n + 1)
    go(t, f)
  }

  const setFilter = (patch: Partial<SearchFilters>) => {
    const next = { ...filters, ...patch }
    // A reversed range is almost always a slip; swap it rather than show nothing.
    if (next.from && next.to && next.from > next.to) [next.from, next.to] = [next.to, next.from]
    setShown(SHOW)
    go(q, next, true)
  }

  const current = answer?.key === key ? answer : null
  const searching = !!q && preview === 'ready' && !current
  const hits = current && 'hits' in current ? current.hits : []
  const failure = current && 'error' in current ? current.error : null
  const filtering = filterSummary(filters)
  const strongAt = page.data?.thresholds.strong ?? 0.75
  const index = page.data?.index
  const state = preview !== 'ready' ? preview : page.failed && !page.data ? 'error' : !page.data ? 'loading' : 'ready'
  const notSetUp = state === 'ready' && index && !index.ready
  const nothingIndexed = state === 'empty' || (state === 'ready' && index?.ready && index.indexed === 0)
  const history = state === 'empty' ? [] : (page.data?.history ?? [])
  const inferred = current && 'hits' in current && current.type && filters.type === 'all' ? current.type : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(draft, filters)
  }

  const removeOne = async (h: HistoryItem) => {
    setHistory((xs) => xs.filter((x) => x.id !== h.id))
    try {
      await forgetSearch(h.id, base)
    } catch {
      toast('That search could not be removed. Try again.')
      page.reload()
    }
  }

  return (
    <>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">AI Record Search</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        Ask in plain words. Results are ranked by how closely each register entry matches, with the score on every card.
      </p>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-8">
          <form role="search" onSubmit={submit} className={`${cardClass} px-5 py-5`}>
            <label htmlFor="sai-q" className="font-semibold text-stone-900">
              What are you looking for?
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-500" />
                <input
                  id="sai-q"
                  type="search"
                  value={draft}
                  maxLength={300}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setError(undefined)
                  }}
                  disabled={state === 'loading' || !!notSetUp}
                  placeholder="e.g. Baptism of a Dela Cruz around 1987"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'sai-q-error' : 'sai-q-hint'}
                  className={`${inputClass} py-3 pl-11 text-base disabled:bg-stone-50`}
                />
              </div>
              <button type="submit" disabled={searching || state === 'loading' || !!notSetUp} className={btnPrimary}>
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            {error ? (
              <p id="sai-q-error" className="mt-2 text-sm text-red-700">
                {error}
              </p>
            ) : (
              <p id="sai-q-hint" className="mt-2 text-sm text-stone-600">
                Names, years, parents, sponsors, and priests all work. Only the secretary and the priest can search the registers.
              </p>
            )}
            {index && index.ready && index.indexed < index.total && (
              <p className="mt-2 rounded-lg bg-gold-soft px-3 py-2 text-sm text-brown">
                {index.indexed} of {index.total} register entries are searchable so far. New and corrected entries are added in the background.
              </p>
            )}

            {/* Filters narrow the search; changing one does not add to the history. */}
            <fieldset className="mt-4 border-t border-stone-100 pt-4">
              <legend className="sr-only">Filters</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
                <select
                  aria-label="Register"
                  value={filters.type}
                  onChange={(e) => setFilter({ type: e.target.value as Sacrament | 'all' })}
                  className={inputClass}
                >
                  <option value="all">All registers</option>
                  {sacraments.map((s) => (
                    <option key={s} value={s}>
                      {s} register
                    </option>
                  ))}
                </select>
                <select aria-label="From year" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} className={inputClass}>
                  <option value="">From any year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      From {y}
                    </option>
                  ))}
                </select>
                <select aria-label="To year" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} className={inputClass}>
                  <option value="">To any year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      To {y}
                    </option>
                  ))}
                </select>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-medium whitespace-nowrap text-stone-800">
                  <input
                    type="checkbox"
                    checked={filters.strongOnly}
                    onChange={(e) => setFilter({ strongOnly: e.target.checked })}
                    className="size-4 accent-forest"
                  />
                  Strong matches only
                </label>
              </div>
              {filtering && (
                <button
                  type="button"
                  onClick={() => go(q, noFilters, true)}
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft"
                >
                  Clear filters
                </button>
              )}
            </fieldset>
          </form>

          <section aria-labelledby="sai-results">
            <h2 id="sai-results" className="sr-only">
              Results
            </h2>
            {state === 'loading' || searching ? (
              <p role="status" className={`${cardClass} flex items-center justify-center gap-3 px-5 py-10 text-stone-600`}>
                <span className="size-5 rounded-full border-2 border-forest/25 border-t-forest motion-safe:animate-spin" aria-hidden="true" />
                {state === 'loading' ? 'Loading…' : 'Searching the registers…'}
              </p>
            ) : state === 'error' ? (
              <div className={cardClass}>
                <ErrorState what="AI Record Search" help="If it keeps happening, tell the system administrator." onRetry={page.reload} />
              </div>
            ) : notSetUp ? (
              <div className={`${cardClass} px-5 py-10 text-center`}>
                <p className="font-semibold text-stone-800">AI search is not set up yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">The system administrator needs to add the Gemini API key on the server.</p>
              </div>
            ) : nothingIndexed ? (
              <div className={`${cardClass} px-5 py-10 text-center text-stone-600`}>
                Nothing is indexed yet, so there is nothing to search. Register entries become searchable a moment after they are added.
              </div>
            ) : failure ? (
              <div role="alert" className={`${cardClass} px-5 py-10 text-center`}>
                <p className="font-semibold text-stone-800">The search did not finish</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">{failure}</p>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${btnSecondary} mt-3`}>
                  Try again
                </button>
              </div>
            ) : !q ? (
              <div className={`${cardClass} px-5 py-6`}>
                <p className="font-semibold text-stone-800">Not sure how to ask? Try one of these.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => run(ex, noFilters)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 hover:border-forest/50 hover:text-forest"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm text-stone-600">
                  Results show scores of {(page.data?.thresholds.min ?? 0.45).toFixed(2)} and above; {strongAt.toFixed(2)} and above is a strong match. A name
                  or year you type counts for more than a loose resemblance.
                </p>
              </div>
            ) : hits.length === 0 ? (
              <div className={`${cardClass} px-5 py-10 text-center`}>
                <p className="font-semibold text-stone-800">
                  No register entries matched
                  {filtering ? ' with these filters' : ' closely enough'}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
                  {filtering
                    ? 'Widen the years, choose all registers, or include weaker matches.'
                    : 'Try fewer words, a different spelling of the surname, or a year instead of an exact date.'}
                </p>
                {filtering && (
                  <button type="button" onClick={() => go(q, noFilters, true)} className={`${btnSecondary} mt-3`}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <p aria-live="polite" className="mb-3 text-sm text-stone-600">
                  <span className="font-semibold text-stone-800">
                    {hits.length} {hits.length === 1 ? 'match' : 'matches'}
                  </span>{' '}
                  for “{q}”{filtering && <> ({filtering})</>}
                  {inferred && <> in the {inferred.toLowerCase()} register</>}, best first.
                </p>
                <ol className="space-y-3">
                  {hits.slice(0, shown).map((h, i) => (
                    <ResultCard key={h.entry.id} hit={h} rank={i + 1} strongAt={strongAt} href={entryHref(h.entry)} />
                  ))}
                </ol>
                {hits.length > shown && (
                  <button type="button" onClick={() => setShown((n) => n + SHOW)} className={`${btnSecondary} mt-4 w-full sm:w-auto`}>
                    Show {Math.min(SHOW, hits.length - shown)} more
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        <aside aria-labelledby="sai-history" className={`${cardClass} xl:sticky xl:top-6 xl:col-span-4`}>
          <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 id="sai-history" className="font-serif text-2xl font-semibold text-stone-900">
                Search history
              </h2>
              <p className="text-sm text-stone-600">Your recent searches. Only you can see them.</p>
            </div>
            {history.length > 0 && state === 'ready' && (
              <button
                type="button"
                onClick={() => setClearing(true)}
                className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                Clear all
              </button>
            )}
          </header>
          {state === 'loading' ? (
            <p className="px-5 py-8 text-center text-sm text-stone-600">Loading your history…</p>
          ) : state === 'error' ? (
            <p className="px-5 py-8 text-center text-sm text-stone-700">Your history could not be loaded.</p>
          ) : history.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-600">Searches you run appear here so you can run them again.</p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-stone-100 overflow-y-auto">
              {history.map((h) => {
                const active = same(h, q, filters)
                const summary = filterSummary(h)
                return (
                  <li key={h.id} className={`flex items-start gap-1 py-1 pr-2 pl-2 ${active ? 'bg-forest-soft' : ''}`}>
                    <button
                      type="button"
                      onClick={() => run(h.q, h)}
                      aria-current={active ? 'true' : undefined}
                      className="min-h-11 min-w-0 flex-1 rounded-lg px-3 py-2 text-left hover:bg-ivory"
                    >
                      <span className="block font-semibold break-words text-stone-900">{h.q}</span>
                      {summary && <span className="block text-xs text-stone-700">{summary}</span>}
                      <span className="block text-xs text-stone-600">
                        {when(h.at)} · {plural(h.count, 'result')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeOne(h)}
                      aria-label={`Remove “${h.q}” from history`}
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        title="Clear your search history?"
        confirmLabel="Clear history"
        tone="danger"
        onConfirm={async () => {
          setClearing(false)
          setHistory(() => [])
          try {
            await clearSearches(base)
          } catch {
            toast('The history could not be cleared. Try again.')
            page.reload()
          }
        }}
      >
        <p>All {history.length} saved searches are removed. Register entries are not affected.</p>
      </ConfirmDialog>
    </>
  )
}
