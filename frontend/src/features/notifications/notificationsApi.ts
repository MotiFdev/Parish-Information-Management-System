import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'

// The header bell (backend NotificationController): the signed-in person's own
// notices. Checked when the page opens, every minute, and when the tab comes back.

export interface Notice {
  id: string
  /** newRequests | resubmissions | priestDecisions | bookings | announcements | approvals; null for older notices. */
  kind: string | null
  message: string
  /** Portal path the notice opens, or null. */
  link: string | null
  read: boolean
  created_at: string
}

interface Inbox {
  data: Notice[]
  unread: number
}

const EVERY = 60_000

export function useInbox() {
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    api<Inbox>('/api/notifications')
      .then((r) => {
        if (cancelled) return
        setInbox(r)
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [tick])

  useEffect(() => {
    const timer = window.setInterval(() => document.visibilityState === 'visible' && refresh(), EVERY)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  /** Marks one notice (or all) read here at once, then on the server. */
  const markRead = useCallback(
    (id: string | 'all') => {
      setInbox((box) => {
        if (!box) return box
        const data = box.data.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n))
        const wasUnread = id === 'all' ? box.unread : box.data.some((n) => n.id === id && !n.read) ? 1 : 0
        return { data, unread: Math.max(0, box.unread - wasUnread) }
      })
      const path = id === 'all' ? '/api/notifications/read-all' : `/api/notifications/${id}/read`
      api(path, { method: 'POST' }).catch(() => refresh())
    },
    [refresh],
  )

  return { inbox, failed, refresh, markRead }
}
