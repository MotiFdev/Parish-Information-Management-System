import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api'
import type { NoticeInput } from './AnnouncementEditor'
import type { Notice } from './announcementsData'

// Staff Announcements (backend Staff\AnnouncementController).

interface ApiNotice {
  id: string
  title: string
  category: Notice['category']
  status: Notice['status']
  body: string
  pinned: boolean
  publish_at: string | null
  author: string
  updated_at: string
}

const toNotice = (n: ApiNotice): Notice => ({
  id: n.id,
  title: n.title,
  category: n.category,
  status: n.status,
  body: n.body,
  pinned: n.pinned,
  publishAt: n.publish_at,
  author: n.author,
  updatedAt: n.updated_at,
})

/** Every announcement; `put` swaps in a saved one, `remove` drops a deleted one. */
export function useNotices() {
  const [attempt, setAttempt] = useState(0)
  // Tagged with the request it answers, so a retry shows loading without resetting state in the effect.
  const [result, setResult] = useState<{ attempt: number; value: Notice[] | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiNotice[] }>('/api/secretary/announcements')
      .then((r) => !cancelled && setResult({ attempt, value: r.data.map(toNotice) }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const state: Notice[] | 'loading' | 'error' = result?.attempt === attempt ? result.value : 'loading'
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const put = useCallback((notice: Notice) => {
    setResult((r) => {
      if (!r || r.value === 'error') return r
      // A live post that took the pin takes it from the other live posts, as the server did.
      const others = r.value
        .filter((n) => n.id !== notice.id)
        .map((n) => (notice.pinned && notice.status === 'Published' && n.status !== 'Draft' ? { ...n, pinned: false } : n))
      return { ...r, value: [notice, ...others] }
    })
  }, [])
  const remove = useCallback((id: string) => setResult((r) => (r && r.value !== 'error' ? { ...r, value: r.value.filter((n) => n.id !== id) } : r)), [])

  return { state, reload, put, remove }
}

const failed = (e: unknown, fallback: string) => (e instanceof ApiError && e.status !== 500 ? e.message : fallback)

export type SaveResult = { notice: Notice } | { errors: Record<string, string | undefined> } | { message: string }

/** Writes a new announcement (no id) or saves an edit. */
export async function saveNotice(id: string | null, input: NoticeInput): Promise<SaveResult> {
  const body = { title: input.title, category: input.category, body: input.body, pinned: input.pinned, mode: input.mode, publish_at: input.publishAt ?? null }
  try {
    const r = await api<{ data: ApiNotice }>(id ? `/api/secretary/announcements/${id}` : '/api/secretary/announcements', { method: id ? 'PATCH' : 'POST', body })
    return { notice: toNotice(r.data) }
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) return { errors: { title: e.field('title'), body: e.field('body'), when: e.field('publish_at') } }
    return { message: failed(e, 'The announcement could not be saved. Try again.') }
  }
}

export type NoticeStep = 'publish' | 'unschedule' | 'archive' | 'to-draft' | 'pin'

/** Publish, unschedule, archive, move to drafts, or pin/unpin. */
export async function noticeStep(id: string, step: NoticeStep, pinned?: boolean): Promise<Notice | string> {
  try {
    const r = await api<{ data: ApiNotice }>(`/api/secretary/announcements/${id}/${step}`, { method: 'POST', body: step === 'pin' ? { pinned } : undefined })
    return toNotice(r.data)
  } catch (e) {
    return failed(e, 'That could not be saved. Try again.')
  }
}

/** Deletes a draft or archived announcement; resolves with a message when refused. */
export async function deleteNotice(id: string): Promise<string | void> {
  try {
    await api(`/api/secretary/announcements/${id}`, { method: 'DELETE' })
  } catch (e) {
    return failed(e, 'The announcement could not be deleted. Try again.')
  }
}
