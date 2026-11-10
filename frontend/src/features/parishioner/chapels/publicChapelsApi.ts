import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { Chapel, Officer, SonaOption } from '../../community/chapels/chapelsData'

/** GET /api/public/chapels (backend Public\ChapelController). */
interface ApiResponse {
  data: {
    term: number
    sonas: Array<{ sona_id: number; name: string }>
    chapels: Array<{
      chapel_id: number
      sona_id: number
      name: string
      patron: string | null
      fiesta: string | null
      contact_number: string | null
      fb_account: string | null
    }>
    officers: Array<{
      officer_id: string
      chapel_id: number
      name: string
      position: string
      ministry: string | null
      /** The president's only; null for everyone else. */
      contact_number: string | null
    }>
  }
}

export interface PublicDirectory {
  term: number
  sonas: SonaOption[]
  chapels: Chapel[]
  officers: Officer[]
}

function toDirectory({ data }: ApiResponse): PublicDirectory {
  return {
    term: data.term,
    sonas: data.sonas.map((s) => ({ id: String(s.sona_id), name: s.name })),
    chapels: data.chapels.map((c) => ({
      id: String(c.chapel_id),
      sonaId: String(c.sona_id),
      name: c.name,
      patron: c.patron ?? '',
      fiesta: c.fiesta ?? '',
      contact: c.contact_number ?? '',
      fbAccount: c.fb_account ?? '',
      active: true,
      status: 'Approved',
      reviewNote: '',
    })),
    officers: data.officers.map((o) => ({
      id: o.officer_id,
      chapelId: String(o.chapel_id),
      name: o.name,
      position: o.position,
      ministry: o.ministry ?? '',
      age: null,
      fb: '',
      contact: o.contact_number ?? '',
      term: data.term,
      status: 'Approved',
      reviewNote: '',
    })),
  }
}

/** The public chapel directory, with a retry for the error state. */
export function usePublicChapels() {
  const [state, setState] = useState<PublicDirectory | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<ApiResponse>('/api/public/chapels')
      .then((r) => !cancelled && setState(toDirectory(r)))
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState('loading')
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
