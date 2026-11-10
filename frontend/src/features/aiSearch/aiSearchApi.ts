import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api'
import type { SearchHit } from '../priest/aiSearch/search'
import type { Sacrament } from '../priest/sampleData'

// AI Record Search for staff and the priest (backend Api\AiSearchController):
// Gemini embeddings of the register entries, ranked in pgvector. Each portal
// calls its own path; history is kept per person.

export type AiSearchBase = '/api/secretary/ai-search' | '/api/priest/ai-search'
const STAFF: AiSearchBase = '/api/secretary/ai-search'

export interface SearchFilters {
  type: Sacrament | 'all'
  /** Empty means no limit. */
  from: string
  to: string
  strongOnly: boolean
}

export const noFilters: SearchFilters = { type: 'all', from: '', to: '', strongOnly: false }

export interface HistoryItem extends SearchFilters {
  id: string
  q: string
  /** How many entries matched when it was run. */
  count: number
  at: string
}

interface ApiHistoryItem extends Omit<HistoryItem, 'type'> {
  type: Sacrament | null
}

export interface SearchPageData {
  history: HistoryItem[]
  /** Years the registers cover, newest first. */
  years: string[]
  thresholds: { min: number; strong: number }
  /** ready: the Gemini key is set. indexed of total entries are searchable. */
  index: { ready: boolean; indexed: number; total: number }
}

const toItem = (h: ApiHistoryItem): HistoryItem => ({ ...h, type: h.type ?? 'all' })

/** History, year range, thresholds, and index status for the page. */
export function useSearchPage(base: AiSearchBase = STAFF) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; value: SearchPageData | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Omit<SearchPageData, 'history'> & { history: ApiHistoryItem[] }>(base)
      .then((d) => !cancelled && setResult({ attempt, value: { ...d, history: d.history.map(toItem) } }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt, base])

  /** Changes the history in place after a search, a removal, or Clear all. */
  const setHistory = useCallback((change: (h: HistoryItem[]) => HistoryItem[]) => {
    setResult((r) => (r && r.value !== 'error' ? { ...r, value: { ...r.value, history: change(r.value.history) } } : r))
  }, [])

  const value = result?.value
  return {
    data: value && value !== 'error' ? value : null,
    failed: result?.attempt === attempt && value === 'error',
    reload: useCallback(() => setAttempt((n) => n + 1), []),
    setHistory,
  }
}

export type SearchOutcome = { results: SearchHit[]; type: Sacrament | null; saved: HistoryItem | null } | { error: string }

/** Runs a search; `save` adds it to the person's history. */
export async function searchRegisters(q: string, f: SearchFilters, save: boolean, base: AiSearchBase = STAFF): Promise<SearchOutcome> {
  try {
    const r = await api<{ results: SearchHit[]; type: Sacrament | null; saved: ApiHistoryItem | null }>(base, {
      method: 'POST',
      body: {
        q,
        type: f.type === 'all' ? null : f.type,
        from: f.from ? Number(f.from) : null,
        to: f.to ? Number(f.to) : null,
        strong_only: f.strongOnly,
        save,
      },
    })
    return { ...r, saved: r.saved ? toItem(r.saved) : null }
  } catch (e) {
    if (e instanceof ApiError) return { error: e.status === 429 ? 'Too many searches in a minute. Wait a moment and try again.' : e.message }
    return { error: 'The search could not reach the server. Check the connection and try again.' }
  }
}

export async function forgetSearch(id: string, base: AiSearchBase = STAFF) {
  await api(`${base}/history/${id}`, { method: 'DELETE' })
}

export async function clearSearches(base: AiSearchBase = STAFF) {
  await api(`${base}/history`, { method: 'DELETE' })
}
