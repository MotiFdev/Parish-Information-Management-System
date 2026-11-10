import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Field } from '../../components/ui/Field'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/toast/toastContext'
import { ApiError } from '../../lib/api'
import { IndexPanel } from '../../features/admin/ai/IndexPanel'
import { ThresholdPreview } from '../../features/admin/ai/ThresholdPreview'
import {
  getAiSettings,
  reindexStep,
  saveAiSettings,
  startReindex,
  type AiSettings,
  type AiSettingsPage as PageData,
  type IndexStatus,
  type ReindexProgress,
} from '../../features/admin/aiData'
import { AdminLayout } from '../../layouts/AdminLayout'

const SLIDER_MIN = 0.2
const SLIDER_MAX = 0.99

function Slider({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold text-stone-800">
          {label}
        </label>
        <output htmlFor={id} className="text-lg font-semibold text-stone-900 tabular-nums">
          {value.toFixed(2)}
        </output>
      </div>
      <p id={`${id}-hint`} className="text-sm text-stone-600">
        {hint}
      </p>
      <input
        id={id}
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={`${id}-hint`}
        aria-valuetext={value.toFixed(2)}
        className="mt-1 block h-11 w-full cursor-pointer accent-forest"
      />
      <div className="flex justify-between text-xs text-stone-600" aria-hidden="true">
        <span>{SLIDER_MIN.toFixed(2)} · more results</span>
        <span>{SLIDER_MAX.toFixed(2)} · fewer, closer results</span>
      </div>
    </div>
  )
}

const same = (a: AiSettings, b: AiSettings) => a.model === b.model && a.minScore === b.minScore && a.strongScore === b.strongScore

export default function AiSettingsPage() {
  const [data, setData] = useState<PageData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getAiSettings()
      .then((d) => {
        if (cancelled) return
        setData(d)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Request failed.')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <AdminLayout activeHref="/admin/settings/ai-config">
      <h1 className="font-serif text-4xl font-semibold text-stone-900">AI Engine Settings</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        How AI record search matches a question to records. These settings apply to secretary and priest searches; the public site
        never searches records.
      </p>

      {data ? (
        <AiSettingsView initial={data} />
      ) : (
        <div className={`${cardClass} mt-6`}>
          {loadError ? (
            <ErrorState what="AI search settings" help={`${loadError} If it keeps happening, check the server and API logs.`} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : (
            <LoadingState what="AI search settings" />
          )}
        </div>
      )}
    </AdminLayout>
  )
}

function AiSettingsView({ initial }: { initial: PageData }) {
  const { toast } = useToast()
  const [saved, setSaved] = useState<AiSettings>(initial.settings)
  const [draft, setDraft] = useState<AiSettings>(initial.settings)
  const [index, setIndex] = useState<IndexStatus>(initial.index)
  const [progress, setProgress] = useState<ReindexProgress | null>(initial.reindex)
  const [working, setWorking] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modelError, setModelError] = useState<string>()
  const [confirm, setConfirm] = useState<'model' | 'reindex' | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const dirty = !same(draft, saved)
  const modelChanged = draft.model !== saved.model

  // The two scores stay ordered: moving one past the other pushes the other along.
  const setMin = (v: number) => setDraft((d) => ({ ...d, minScore: v, strongScore: Math.max(d.strongScore, v) }))
  const setStrong = (v: number) => setDraft((d) => ({ ...d, strongScore: v, minScore: Math.min(d.minScore, v) }))

  /** Sends re-index steps one after another until the server says it's done, the page closes, or a step fails. */
  const runSteps = useCallback(async () => {
    setWorking(true)
    setStepError(null)
    try {
      for (;;) {
        if (!alive.current) return
        const step = await reindexStep()
        if (!alive.current) return
        setIndex(step.index)
        setProgress(step.reindex)
        if (!step.reindex) {
          toast(`Re-index finished: ${step.index.indexed} register entries are searchable with ${step.index.model}.`)
          return
        }
      }
    } catch (e) {
      if (alive.current) setStepError(`${e instanceof Error ? e.message : 'The re-index stopped.'} Nothing is lost; continue when ready.`)
    } finally {
      if (alive.current) setWorking(false)
    }
  }, [toast])

  const reindex = async () => {
    try {
      setProgress(await startReindex())
      void runSteps()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The re-index could not start.')
    }
  }

  const save = async (thenReindex: boolean) => {
    setSaving(true)
    setModelError(undefined)
    try {
      const r = await saveAiSettings(draft)
      setSaved(r.settings)
      setDraft(r.settings)
      setIndex(r.index)
      setProgress(r.reindex)
      toast('AI search settings saved.')
      if (thenReindex) void reindex()
    } catch (e) {
      if (e instanceof ApiError && e.field('model')) setModelError(e.field('model'))
      toast(e instanceof ApiError ? (e.field('model') ?? e.field('strong_score') ?? e.message) : 'The settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-12">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (modelChanged) setConfirm('model')
            else void save(false)
          }}
          aria-label="AI search settings"
          className={`${cardClass} lg:col-span-7`}
        >
          <section aria-labelledby="matching-title" className="space-y-6 px-5 py-5">
            <div>
              <h2 id="matching-title" className="font-serif text-xl font-semibold text-stone-900">
                Similarity thresholds
              </h2>
              <p className="mt-0.5 text-sm text-stone-600">
                Each result gets a score from 0 to 1 for how closely it matches the question, counting the names and years it
                contains. Higher means closer.
              </p>
            </div>
            <Slider id="min-score" label="Minimum score" hint="Results scoring below this are left out." value={draft.minScore} onChange={setMin} />
            <Slider
              id="strong-score"
              label="Strong match score"
              hint="Results at or above this are labelled as strong matches. Never lower than the minimum."
              value={draft.strongScore}
              onChange={setStrong}
            />
            <ThresholdPreview minScore={draft.minScore} strongScore={draft.strongScore} />
          </section>

          <section aria-labelledby="model-title" className="border-t border-stone-100 px-5 py-5">
            <h2 id="model-title" className="font-serif text-xl font-semibold text-stone-900">
              Embedding model
            </h2>
            <p className="mt-0.5 mb-4 text-sm text-stone-600">
              The Gemini model that turns record text into the numbers search compares. Changing it means re-indexing every record.
            </p>
            <Field
              label="Model"
              htmlFor="embedding-model"
              error={modelError}
              hint={`The search index stores ${initial.dimensions}-dimension vectors; a new model is checked with Gemini before it is saved.`}
            >
              <select
                id="embedding-model"
                value={draft.model}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, model: e.target.value }))
                  setModelError(undefined)
                }}
                disabled={working}
                aria-invalid={modelError ? true : undefined}
                className={`${inputClass} disabled:bg-stone-50`}
              >
                {initial.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                    {m === saved.model ? ' (in use)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            {dirty && <p className="text-sm text-stone-600 sm:mr-auto">You have unsaved changes.</p>}
            <button
              type="button"
              onClick={() => {
                setDraft(saved)
                setModelError(undefined)
              }}
              disabled={!dirty || saving}
              className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Discard
            </button>
            <button type="submit" disabled={!dirty || working || saving} className={btnPrimary}>
              {saving && <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>

        <IndexPanel
          index={index}
          progress={progress}
          working={working}
          stepError={stepError}
          configured={initial.configured}
          onReindex={() => setConfirm('reindex')}
          onResume={() => void runSteps()}
          className="lg:sticky lg:top-24 lg:col-span-5"
        />
      </div>

      <ConfirmDialog
        open={confirm === 'model'}
        onClose={() => setConfirm(null)}
        title="Change the embedding model?"
        confirmLabel="Save and re-index"
        onConfirm={() => {
          setConfirm(null)
          void save(true)
        }}
      >
        <p>
          Switching from <span className="font-semibold">{saved.model}</span> to <span className="font-semibold">{draft.model}</span>{' '}
          means every record has to be indexed again.
        </p>
        <p className="text-sm text-stone-600">Until re-indexing finishes, AI search only finds the records already re-indexed.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'reindex'}
        onClose={() => setConfirm(null)}
        title="Re-index all records?"
        confirmLabel="Start re-indexing"
        onConfirm={() => {
          setConfirm(null)
          void reindex()
        }}
      >
        <p>
          Rebuilds the search index for all {index.records} register entries using <span className="font-semibold">{saved.model}</span>.
          Search keeps working while it runs.
        </p>
        <p className="text-sm text-stone-600">Each entry is sent to Gemini, which uses API quota.</p>
      </ConfirmDialog>
    </>
  )
}
