import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { Announcement, AnnouncementCategory } from '../sampleData'

// Published parish announcements for the home page (backend Public\AnnouncementController).

interface ApiAnnouncement {
  id: string
  title: string
  excerpt: string
  category: AnnouncementCategory
  published_at: string
  pinned: boolean
}

const postedOn = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' })

/** Pinned first, then newest; `reload` tries again after an error. */
export function usePublicAnnouncements() {
  const [attempt, setAttempt] = useState(0)
  // Tagged with the request it answers, so a retry shows loading without resetting state in the effect.
  const [result, setResult] = useState<{ attempt: number; value: Announcement[] | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiAnnouncement[] }>('/api/public/announcements')
      .then((r) => {
        if (cancelled) return
        const posts = r.data.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt,
          category: a.category,
          postedOn: postedOn.format(new Date(a.published_at)),
          pinned: a.pinned,
        }))
        setResult({ attempt, value: posts })
      })
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const state: Announcement[] | 'loading' | 'error' = result?.attempt === attempt ? result.value : 'loading'
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, reload }
}
