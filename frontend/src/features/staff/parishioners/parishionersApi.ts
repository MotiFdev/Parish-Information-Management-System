import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api'
import type { ParishionerInput } from './ParishionerForm'
import type { DirectorySona, Parishioner, ParishionerSacrament } from './parishionerData'

// The staff Parishioners directory (backend Staff\ParishionerController).

interface ApiParishioner {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  sex: 'Female' | 'Male' | null
  date_of_birth: string | null
  place_of_birth: string | null
  contact_number: string | null
  email: string | null
  address_street: string | null
  address_barangay: string | null
  address_city: string | null
  chapel_id: string | null
  sona_id: string | null
  father_id: string | null
  mother_id: string | null
  is_archived: boolean
  sacraments: Array<{
    record_id: string
    type: ParishionerSacrament['type']
    date: string | null
    role: ParishionerSacrament['role']
    register: ParishionerSacrament['register']
  }>
}

export interface Directory {
  people: Parishioner[]
  sonas: DirectorySona[]
}

const toParishioner = (p: ApiParishioner): Parishioner => ({
  id: p.id,
  firstName: p.first_name,
  middleName: p.middle_name ?? '',
  lastName: p.last_name,
  suffix: p.suffix ?? '',
  sex: p.sex ?? '',
  dateOfBirth: p.date_of_birth ?? '',
  placeOfBirth: p.place_of_birth ?? '',
  contact: p.contact_number ?? '',
  email: p.email ?? '',
  street: p.address_street ?? '',
  barangay: p.address_barangay ?? '',
  city: p.address_city ?? '',
  sonaId: p.sona_id ?? '',
  chapelId: p.chapel_id ?? '',
  fatherId: p.father_id,
  motherId: p.mother_id,
  archived: p.is_archived,
  sacraments: p.sacraments.map((s) => ({ recordId: s.record_id, type: s.type, date: s.date, role: s.role, register: s.register })),
})

/** The whole directory; `put` swaps in a saved person without reloading. */
export function useDirectory() {
  const [attempt, setAttempt] = useState(0)
  // Tagged with the request it answers, so a retry shows loading without resetting state in the effect.
  const [result, setResult] = useState<{ attempt: number; value: Directory | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiParishioner[]; sonas: DirectorySona[] }>('/api/secretary/parishioners')
      .then((r) => !cancelled && setResult({ attempt, value: { people: r.data.map(toParishioner), sonas: r.sonas } }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const state: Directory | 'loading' | 'error' = result?.attempt === attempt ? result.value : 'loading'
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const put = useCallback((person: Parishioner) => {
    setResult((r) => {
      if (!r || r.value === 'error') return r
      const exists = r.value.people.some((p) => p.id === person.id)
      const people = exists ? r.value.people.map((p) => (p.id === person.id ? person : p)) : [...r.value.people, person]
      return { ...r, value: { ...r.value, people } }
    })
  }, [])

  return { state, reload, put }
}

/** Form field => API field, both ways. */
const fields: Array<[keyof ParishionerInput, string]> = [
  ['firstName', 'first_name'],
  ['middleName', 'middle_name'],
  ['lastName', 'last_name'],
  ['suffix', 'suffix'],
  ['sex', 'sex'],
  ['dateOfBirth', 'date_of_birth'],
  ['placeOfBirth', 'place_of_birth'],
  ['contact', 'contact_number'],
  ['email', 'email'],
  ['street', 'address_street'],
  ['barangay', 'address_barangay'],
  ['city', 'address_city'],
  ['chapelId', 'chapel_id'],
  ['fatherId', 'father_id'],
  ['motherId', 'mother_id'],
]

export type SaveResult = { person: Parishioner } | { errors: Partial<Record<keyof ParishionerInput, string>> } | { message: string }

/** Adds (no id) or edits a parishioner. */
export async function saveParishioner(id: string | null, input: ParishionerInput): Promise<SaveResult> {
  const body = Object.fromEntries(fields.map(([k, f]) => [f, typeof input[k] === 'string' ? (input[k] as string).trim() || null : input[k]]))
  try {
    const r = await api<{ data: ApiParishioner }>(id ? `/api/secretary/parishioners/${id}` : '/api/secretary/parishioners', { method: id ? 'PATCH' : 'POST', body })
    return { person: toParishioner(r.data) }
  } catch (e) {
    if (!(e instanceof ApiError)) return { message: 'Could not save. Try again.' }
    if (e.status !== 422) return { message: e.message }
    return { errors: Object.fromEntries(fields.map(([k, f]) => [k, e.field(f)])) }
  }
}

/** Archives or restores; resolves with the updated person, or a message to show. */
export async function setArchived(id: string, archived: boolean): Promise<{ person: Parishioner } | { message: string }> {
  try {
    const r = await api<{ data: ApiParishioner }>(`/api/secretary/parishioners/${id}/${archived ? 'archive' : 'restore'}`, { method: 'POST' })
    return { person: toParishioner(r.data) }
  } catch (e) {
    return { message: e instanceof ApiError && e.status !== 500 ? e.message : 'That could not be saved. Try again.' }
  }
}
