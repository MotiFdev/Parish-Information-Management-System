import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

/** GET /api/sonas */
export interface ApiSona {
  sona_id: number
  name: string
  chapels: Array<{ chapel_id: number; name: string }>
}

/** The parish's Sonas and active chapels; null until loaded. */
export function useSonas() {
  const [sonas, setSonas] = useState<ApiSona[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    api<{ data: ApiSona[] }>('/api/sonas')
      .then((r) => !cancelled && setSonas(r.data))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])
  return { sonas, failed }
}
