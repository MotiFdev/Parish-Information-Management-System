import { useState, type FormEvent } from 'react'
import { inputClass } from '../../../components/ui/styles'
import { previewSearch, samplePreview, type PreviewResult } from '../aiData'

interface Props {
  minScore: number
  strongScore: number
}

// Answers "what would a search show with these numbers?", so the sliders have
// a visible effect before anything is saved. Starts on an example; trying a
// question runs a real search (without thresholds) on the parish's registers.
export function ThresholdPreview({ minScore, strongScore }: Props) {
  const [question, setQuestion] = useState('')
  const [preview, setPreview] = useState<{ query: string; results: PreviewResult[]; example: boolean }>({ ...samplePreview, example: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const results = preview.results
  const shown = results.filter((r) => r.score >= minScore).length
  const strong = results.filter((r) => r.score >= strongScore).length

  const run = async (e: FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (q.length < 3 || busy) return
    setBusy(true)
    setError(undefined)
    try {
      setPreview({ query: q, results: await previewSearch(q), example: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The search could not run. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <figure className="rounded-xl border border-stone-200 bg-ivory/40 p-4">
      <form onSubmit={run} className="flex gap-2" aria-label="Try a search">
        <label htmlFor="preview-q" className="sr-only">
          Try a question
        </label>
        <input
          id="preview-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Try a question, e.g. baptism of Maria Santos 1990"
          maxLength={300}
          autoComplete="off"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-forest/40 bg-white px-4 font-semibold text-forest hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <span className="size-4 rounded-full border-2 border-forest/25 border-t-forest motion-safe:animate-spin" aria-hidden="true" />}
          Try
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <figcaption className="mt-3">
        <span className="block text-sm text-stone-600">{preview.example ? 'Example search (made-up scores)' : 'Your search, on the parish registers'}</span>
        <span className="block font-semibold break-words text-stone-900">“{preview.query}”</span>
        <span aria-live="polite" className="mt-1 block text-sm text-stone-700">
          {results.length === 0 ? (
            'Nothing in the index came close. Check that records are indexed.'
          ) : (
            <>
              <span className="font-semibold tabular-nums">{shown}</span> of {results.length} results shown,{' '}
              <span className="font-semibold tabular-nums">{strong}</span> marked as strong matches.
            </>
          )}
        </span>
      </figcaption>

      <ul className="mt-3 space-y-2">
        {results.map((r, i) => {
          const tier = r.score >= strongScore ? 'strong' : r.score >= minScore ? 'shown' : 'hidden'
          return (
            <li key={`${i}-${r.label}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
              <span className={`truncate ${tier === 'hidden' ? 'text-stone-600' : 'font-medium text-stone-900'}`}>{r.label}</span>
              <span className="text-right text-xs font-semibold whitespace-nowrap">
                <span className="mr-1.5 text-stone-600 tabular-nums">{r.score.toFixed(2)}</span>
                <span className={tier === 'strong' ? 'text-forest' : tier === 'shown' ? 'text-stone-800' : 'text-stone-600'}>
                  {tier === 'strong' ? 'Strong match' : tier === 'shown' ? 'Shown' : 'Hidden'}
                </span>
              </span>
              <span className="relative col-span-2 h-1.5 rounded-full bg-stone-200" aria-hidden="true">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${tier === 'strong' ? 'bg-forest' : tier === 'shown' ? 'bg-forest/55' : 'bg-stone-300'}`}
                  style={{ width: `${r.score * 100}%` }}
                />
                <span className="absolute -inset-y-1 w-0.5 bg-stone-700" style={{ left: `${minScore * 100}%` }} />
                <span className="absolute -inset-y-1 w-0.5 bg-gold-deep" style={{ left: `${strongScore * 100}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-stone-700" /> Minimum score
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-gold-deep" /> Strong match score
        </span>
      </p>
    </figure>
  )
}
