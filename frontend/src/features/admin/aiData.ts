import { api } from '../../lib/api'

// AI Engine Settings API (/api/admin/ai-settings). AI Record Search embeds
// register entries with a Gemini model and scores each result 0 to 1; these
// settings choose the model and where the score cut-offs sit.

export interface AiSettings {
  model: string
  /** Results scoring below this are hidden. */
  minScore: number
  /** Results at or above this are labelled as strong matches. */
  strongScore: number
}

// Source types match the EmbeddingSourceType enum in the backend.
export const sourceTypes = ['Sacramental Record', 'Parishioner Profile', 'Scanned Document'] as const

export interface IndexStatus {
  /** The saved model; counts are of vectors made with it. */
  model: string
  counts: Record<(typeof sourceTypes)[number], number>
  /** Register entries in the parish database. */
  records: number
  /** Register entries searchable with the saved model. */
  indexed: number
  /** Vectors from an earlier model, not searched until re-indexed. */
  otherModel: number
  lastReindexed: string | null
  lastIndexed: string | null
}

export interface ReindexProgress {
  startedAt: string
  done: number
  total: number
}

export interface AiSettingsPage {
  settings: AiSettings
  models: string[]
  dimensions: number
  /** False when the server has no Gemini API key. */
  configured: boolean
  index: IndexStatus
  /** Null when no re-index is running. */
  reindex: ReindexProgress | null
}

interface ApiIndex {
  model: string
  counts: IndexStatus['counts']
  records: number
  indexed: number
  other_model: number
  last_reindexed_at: string | null
  last_indexed_at: string | null
}
interface ApiProgress {
  started_at: string
  done: number
  total: number
}
interface ApiSettings {
  model: string
  min_score: number
  strong_score: number
}

const toSettings = (s: ApiSettings): AiSettings => ({ model: s.model, minScore: s.min_score, strongScore: s.strong_score })
const toIndex = (i: ApiIndex): IndexStatus => ({
  model: i.model,
  counts: i.counts,
  records: i.records,
  indexed: i.indexed,
  otherModel: i.other_model,
  lastReindexed: i.last_reindexed_at,
  lastIndexed: i.last_indexed_at,
})
const toProgress = (p: ApiProgress | null): ReindexProgress | null => (p ? { startedAt: p.started_at, done: p.done, total: p.total } : null)

export async function getAiSettings(): Promise<AiSettingsPage> {
  const r = await api<{ settings: ApiSettings; models: string[]; dimensions: number; configured: boolean; index: ApiIndex; reindex: ApiProgress | null }>(
    '/api/admin/ai-settings',
  )
  return { settings: toSettings(r.settings), models: r.models, dimensions: r.dimensions, configured: r.configured, index: toIndex(r.index), reindex: toProgress(r.reindex) }
}

export async function saveAiSettings(s: AiSettings) {
  const r = await api<{ settings: ApiSettings; index: ApiIndex; reindex: ApiProgress | null }>('/api/admin/ai-settings', {
    method: 'PUT',
    body: { model: s.model, min_score: s.minScore, strong_score: s.strongScore },
  })
  return { settings: toSettings(r.settings), index: toIndex(r.index), reindex: toProgress(r.reindex) }
}

export async function startReindex() {
  const r = await api<{ reindex: ApiProgress | null }>('/api/admin/ai-settings/reindex', { method: 'POST' })
  return toProgress(r.reindex)
}

/** Embeds the next batch. `reindex` is null once every entry is done. */
export async function reindexStep() {
  const r = await api<{ reindex: ApiProgress | null; index: ApiIndex }>('/api/admin/ai-settings/reindex/step', { method: 'POST' })
  return { reindex: toProgress(r.reindex), index: toIndex(r.index) }
}

export interface PreviewResult {
  label: string
  score: number
}

/** A real search with no thresholds applied, best first. */
export async function previewSearch(q: string) {
  const r = await api<{ results: PreviewResult[] }>('/api/admin/ai-settings/preview', { method: 'POST', body: { q } })
  return r.results
}

/** Shown until the administrator tries a question of their own. */
export const samplePreview = {
  query: 'Baptism of Juan dela Cruz, around 1987',
  results: [
    { label: 'Baptism · Juan Miguel Dela Cruz · March 1987', score: 0.93 },
    { label: 'Baptism · Juan Dela Cruz · January 1988', score: 0.89 },
    { label: 'Baptism · Juana Dela Cruz · 1987', score: 0.76 },
    { label: 'Confirmation · Juan Dela Cruz · 1999', score: 0.62 },
    { label: 'Baptism · Juan Cruz · 1979', score: 0.48 },
    { label: 'Marriage · Pedro Dela Cruz · 1986', score: 0.31 },
  ] as PreviewResult[],
}
