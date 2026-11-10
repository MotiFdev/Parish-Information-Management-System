import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api'
import type { RegisterEntry } from '../../priest/registerData'
import type { Sacrament } from '../../priest/sampleData'
import { entryFields, fieldKey, toApiValues, type FieldValues } from './entryFields'
import type { EntryInput } from './EntryForm'

// Sacramental Records in the staff portal (backend Staff\SacramentalRecordController).

/** An approved New Registration, as values for the create form (backend RegisterDraft). */
export interface EntryDraft {
  request_id: string
  request_number: string
  type: Sacrament
  /** Keyed by fieldKey. */
  values: Record<string, string>
  /** What the requester wrote that staff have to settle, e.g. an approximate date. */
  notes: string[]
}

/** The draft for ?from=<request id>, or null when there is no request. */
export function useEntryDraft(requestId: string | null) {
  const [result, setResult] = useState<{ key: string; value: EntryDraft | { error: string } } | null>(null)

  useEffect(() => {
    if (!requestId) return
    let cancelled = false
    api<EntryDraft>(`/api/secretary/record-requests/${requestId}/entry-draft`)
      .then((d) => !cancelled && setResult({ key: requestId, value: d }))
      .catch((e) => !cancelled && setResult({ key: requestId, value: { error: e instanceof ApiError ? e.message : 'The request could not be loaded.' } }))
    return () => {
      cancelled = true
    }
  }, [requestId])

  if (!requestId) return null
  return result?.key === requestId ? result.value : 'loading'
}

/** Draft values keyed by form label; blanks keep the form's defaults. */
export const draftValues = (type: Sacrament, d: EntryDraft): FieldValues =>
  Object.fromEntries(entryFields[type].flatMap((f) => (d.values[fieldKey(f.label)] ? [[f.label, d.values[fieldKey(f.label)]]] : [])))

export type RegisterCounts = Record<Sacrament, number>

interface ListResponse {
  data: RegisterEntry[]
  counts: RegisterCounts
  /** Corrections staff sent that the priest has not decided, per register. */
  waiting: RegisterCounts
}

/** One register, newest first, with every register's entry count. The priest portal reads the same list from its own endpoint. */
export function useRegister(type: Sacrament, endpoint = '/api/secretary/sacramental-records') {
  const [attempt, setAttempt] = useState(0)
  // Tagged with the request it answers, so switching registers shows loading without resetting state in the effect.
  const key = `${type}:${attempt}`
  const [result, setResult] = useState<{ key: string; value: ListResponse | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<ListResponse>(`${endpoint}?type=${type}`)
      .then((r) => !cancelled && setResult({ key, value: r }))
      .catch(() => !cancelled && setResult({ key, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [type, key, endpoint])

  const state: ListResponse | 'loading' | 'error' = result?.key === key ? result.value : 'loading'
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  /** Puts a saved entry in the list without reloading it. */
  const upsert = useCallback((entry: RegisterEntry, isNew: boolean) => {
    setResult((r) => {
      if (!r || typeof r.value !== 'object') return r
      const s = r.value
      const before = s.data.find((e) => e.id === entry.id)
      const data = isNew ? [entry, ...s.data].sort((a, b) => b.date.localeCompare(a.date)) : s.data.map((e) => (e.id === entry.id ? entry : e))
      const waitingChange = Number(Boolean(entry.pending_correction)) - Number(Boolean(before?.pending_correction))
      return {
        key: r.key,
        value: {
          data,
          counts: isNew ? { ...s.counts, [entry.type]: s.counts[entry.type] + 1 } : s.counts,
          waiting: { ...s.waiting, [entry.type]: Math.max(0, (s.waiting?.[entry.type] ?? 0) + waitingChange) },
        },
      }
    })
  }, [])

  return { state, reload, upsert }
}

/** Server errors keyed the way EntryForm shows them: by field label, or "register" for the book place. */
function formErrors(type: Sacrament, e: ApiError) {
  const out: Record<string, string | undefined> = {}
  for (const f of entryFields[type]) out[f.label] = e.field(`values.${fieldKey(f.label)}`)
  out.register = e.field('register') ?? e.field('book') ?? e.field('page') ?? e.field('line')
  return out
}

export type SaveResult = { entry: RegisterEntry } | { errors: Record<string, string | undefined> } | { message: string }

async function save(type: Sacrament, path: string, body: Record<string, unknown>): Promise<SaveResult> {
  try {
    return await api<{ entry: RegisterEntry }>(path, { method: 'POST', body })
  } catch (e) {
    if (!(e instanceof ApiError)) return { message: 'Could not save. Try again.' }
    if (e.status !== 422) return { message: e.message }
    // "Nothing changed" and a request that can't take an entry have no form field of their own.
    if (e.field('values')) return { message: e.field('values')! }
    if (e.field('request_id')) return { message: e.field('request_id')! }
    return { errors: formErrors(type, e) }
  }
}

export const addEntry = (type: Sacrament, { values, register }: EntryInput, requestId?: string) =>
  save(type, '/api/secretary/sacramental-records', {
    type,
    request_id: requestId,
    book: String(register.book),
    page: String(register.page),
    line: String(register.line),
    values: toApiValues(type, values),
  })

export const sendCorrection = (type: Sacrament, entryId: string, values: FieldValues) =>
  save(type, `/api/secretary/sacramental-records/${entryId}/corrections`, { values: toApiValues(type, values) })
