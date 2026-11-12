import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api'
import type { ChapelInput, OfficerInput } from './ChapelDialogs'
import type { ImportResult } from './ImportOfficers'
import type { ApprovalStatus, Chapel, Officer, SonaOption } from './chapelsData'

// Client for /api/community/chapels and /api/community/officers. Database ids
// become strings so the existing screens, built on string ids, keep working.

interface ApiChapel {
  chapel_id: number
  sona_id: number
  name: string
  patron: string | null
  fiesta_date: string | null
  contact_number: string | null
  fb_account_name: string | null
  is_active: boolean
  approval_status: ApprovalStatus
  review_note: string | null
}

interface ApiOfficer {
  officer_id: string
  chapel_id: number
  name: string
  position: string
  ministry: string | null
  age: number | null
  fb_account: string | null
  contact_number: string | null
  photo_url: string | null
  term_year: number
  approval_status: ApprovalStatus
  review_note: string | null
}

const toChapel = (c: ApiChapel): Chapel => ({
  id: String(c.chapel_id),
  sonaId: String(c.sona_id),
  name: c.name,
  patron: c.patron ?? '',
  fiesta: c.fiesta_date ?? '',
  contact: c.contact_number ?? '',
  fbAccount: c.fb_account_name ?? '',
  active: c.is_active,
  status: c.approval_status,
  reviewNote: c.review_note ?? '',
})

export const toOfficer = (o: ApiOfficer): Officer => ({
  id: o.officer_id,
  chapelId: String(o.chapel_id),
  name: o.name,
  position: o.position,
  ministry: o.ministry ?? '',
  age: o.age,
  fb: o.fb_account ?? '',
  contact: o.contact_number ?? '',
  photo: o.photo_url ?? undefined,
  term: o.term_year,
  status: o.approval_status,
  reviewNote: o.review_note ?? '',
})

const chapelBody = (c: ChapelInput) => ({
  sona_id: Number(c.sonaId),
  name: c.name,
  patron: c.patron,
  fiesta_date: c.fiesta,
  contact_number: c.contact,
  fb_account_name: c.fbAccount,
  is_active: c.active,
})

const officerFields = (o: Omit<OfficerInput, 'chapelId' | 'term'>) => ({
  name: o.name,
  position: o.position,
  ministry: o.ministry,
  age: o.age,
  fb_account: o.fb,
  contact_number: o.contact,
})

/** The whole directory: Sonas, chapels (active or not), and every officer. */
export function useChapelDirectory() {
  const [state, setState] = useState<{ sonas: SonaOption[]; chapels: Chapel[]; officers: Officer[] } | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ sonas: Array<{ sona_id: number; name: string }>; chapels: ApiChapel[]; officers: ApiOfficer[] }>('/api/community/chapels')
      .then((r) => {
        if (cancelled) return
        setState({ sonas: r.sonas.map((s) => ({ id: String(s.sona_id), name: s.name })), chapels: r.chapels.map(toChapel), officers: r.officers.map(toOfficer) })
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    setState('loading')
    setAttempt((n) => n + 1)
  }, [])
  return { state, reload, setState }
}

export async function saveChapel(input: ChapelInput, id?: string) {
  const r = await api<{ data: ApiChapel }>(id ? `/api/community/chapels/${id}` : '/api/community/chapels', { method: id ? 'PATCH' : 'POST', body: chapelBody(input) })
  return toChapel(r.data)
}

export async function saveOfficer(input: OfficerInput, id?: string) {
  const body = { chapel_id: Number(input.chapelId), term_year: input.term, ...officerFields(input) }
  const r = await api<{ data: ApiOfficer }>(id ? `/api/community/officers/${id}` : '/api/community/officers', { method: id ? 'PATCH' : 'POST', body })
  return toOfficer(r.data)
}

/** Only for a chapel the PPC hasn't approved. */
export async function deleteChapel(id: string) {
  await api(`/api/community/chapels/${id}`, { method: 'DELETE' })
}

export async function removeOfficer(id: string) {
  await api(`/api/community/officers/${id}`, { method: 'DELETE' })
}

/** What the server accepts for a picture (ProfileController::storeUploadedPhoto). */
export const PHOTO_MAX_MB = 2
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

/** Why a picture would be refused, checked before uploading; undefined when it looks fine. */
export function photoProblem(file: File) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return 'Choose a JPG, PNG, or WebP picture.'
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) return `The picture is too large. The limit is ${PHOTO_MAX_MB} MB.`
}

/** Uploads or replaces the officer's picture. */
export async function uploadOfficerPhoto(id: string, file: File) {
  const body = new FormData()
  body.append('photo', file)
  const r = await api<{ data: ApiOfficer }>(`/api/community/officers/${id}/photo`, { method: 'POST', body })
  return toOfficer(r.data)
}

export async function removeOfficerPhoto(id: string) {
  const r = await api<{ data: ApiOfficer }>(`/api/community/officers/${id}/photo`, { method: 'DELETE' })
  return toOfficer(r.data)
}

/** Returns the chapel's officers for that term after the import. */
export async function importOfficers(r: ImportResult) {
  const res = await api<{ data: ApiOfficer[] }>(`/api/community/chapels/${r.chapelId}/officers/import`, {
    method: 'POST',
    body: { term_year: r.term, replace: r.replace, officers: r.rows.map(officerFields) },
  })
  return res.data.map(toOfficer)
}

/** Field errors from a 422 in the form's field names; a general message otherwise. */
export function formErrors(e: unknown, fieldFor: Record<string, string>): Record<string, string> {
  if (e instanceof ApiError && e.status === 422 && Object.keys(e.errors).length) {
    const out: Record<string, string> = {}
    for (const [field, messages] of Object.entries(e.errors)) out[fieldFor[field] ?? field] ??= messages[0]
    return out
  }
  return { form: e instanceof ApiError && e.status === 0 ? e.message : 'It could not be saved. Please try again.' }
}
