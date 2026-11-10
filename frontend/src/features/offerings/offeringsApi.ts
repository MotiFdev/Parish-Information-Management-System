import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api'

// The offerings ledger staff and the priest keep (backend Api\OfferingController).

export interface Offering {
  id: string
  category: string
  description: string | null
  amount: number
  /** 'YYYY-MM-DD', the parish day it was received. */
  received_on: string
  recorded_by: string | null
  recorded_at: string | null
}

export interface OfferingInput {
  category: string
  description: string
  /** As typed, e.g. "12500.50". */
  amount: string
  received_on: string
}

interface Ledger {
  data: Offering[]
  total: number
  categories: string[]
}

/** The ledger for a month range ('YYYY-MM'), newest first. */
export function useOfferings(from: string, to: string, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const key = enabled ? `${from}:${to}:${attempt}` : ''
  const [result, setResult] = useState<{ key: string; value: Ledger | 'error' } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    api<Ledger>(`/api/offerings?${new URLSearchParams({ from, to })}`)
      .then((r) => !cancelled && setResult({ key, value: r }))
      .catch(() => !cancelled && setResult({ key, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [key, from, to])

  const state: Ledger | 'loading' | 'error' = result?.key === key ? result.value : 'loading'
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, reload }
}

export type SaveOfferingResult = { offering: Offering } | { errors: Partial<Record<keyof OfferingInput, string>> } | { message: string }

/** Adds an entry, or edits the one with `id`. */
export async function saveOffering(input: OfferingInput, id?: string): Promise<SaveOfferingResult> {
  try {
    return await api<{ offering: Offering }>(id ? `/api/offerings/${id}` : '/api/offerings', {
      method: id ? 'PATCH' : 'POST',
      body: { ...input, amount: input.amount.replace(/[,\s₱]/g, '') },
    })
  } catch (e) {
    if (!(e instanceof ApiError)) return { message: 'Could not save. Check the connection and try again.' }
    if (e.status !== 422) return { message: e.message }
    return { errors: { category: e.field('category'), description: e.field('description'), amount: e.field('amount'), received_on: e.field('received_on') } }
  }
}

export async function deleteOffering(id: string): Promise<string | null> {
  try {
    await api(`/api/offerings/${id}`, { method: 'DELETE' })
    return null
  } catch (e) {
    return e instanceof ApiError ? e.message : 'Could not delete. Check the connection and try again.'
  }
}
