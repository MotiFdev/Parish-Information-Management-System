import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api'
import type { Report } from './reportData'

/**
 * Fetches `url` (null while the options are invalid). While a new report loads,
 * the last one of the same `kind` stays on screen, so the page doesn't flash on
 * every change and the headline figures always match the report type.
 */
export function useServerReport<T extends { report: Report }>(url: string | null, kind: string) {
  const [attempt, setAttempt] = useState(0)
  const key = url ? `${url}#${attempt}` : ''
  const [result, setResult] = useState<{ key: string; value: T | { error: string } } | null>(null)
  const [last, setLast] = useState<(T & { kind: string }) | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    api<T>(url)
      .then((r) => {
        if (cancelled) return
        setResult({ key, value: r })
        setLast({ ...r, kind })
      })
      .catch((e) => !cancelled && setResult({ key, value: { error: e instanceof ApiError && e.status === 422 ? e.message : 'error' } }))
    return () => {
      cancelled = true
    }
  }, [url, key, kind])

  const current = result?.key === key ? result.value : null
  return {
    data: current && 'report' in current ? current : last?.kind === kind ? last : null,
    loading: Boolean(key) && current === null,
    error: current && 'error' in current ? current.error : null,
    /** Asks again, e.g. after the offerings ledger changed. */
    reload: useCallback(() => setAttempt((n) => n + 1), []),
  }
}
