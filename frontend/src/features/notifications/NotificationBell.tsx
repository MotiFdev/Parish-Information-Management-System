import { useEffect, useId, useRef, useState } from 'react'
import { Icon, type IconName } from '../../components/ui/Icon'
import { navigate } from '../../lib/router'
import { relativeTime } from '../admin/dashboard/time'
import { useInbox, type Notice } from './notificationsApi'

const kindIcon: Record<string, IconName> = {
  newRequests: 'file',
  resubmissions: 'paperclip',
  priestDecisions: 'seal',
  approvals: 'seal',
  bookings: 'calendar',
  announcements: 'pin',
}

/**
 * The bell in the portal header. The badge counts unread notices; the panel
 * lists the latest 30, and each opens the page it is about.
 */
export function NotificationBell({ settingsHref }: { settingsHref?: string }) {
  const { inbox, failed, refresh, markRead } = useInbox()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const unread = inbox?.unread ?? 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) refresh()
    setOpen((o) => !o)
  }

  const openNotice = (n: Notice) => {
    if (!n.read) markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const label = unread ? `Notifications, ${unread} unread` : 'Notifications'

  return (
    <div ref={wrap} className="sm:relative">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        className="relative grid size-11 place-items-center rounded-lg text-forest hover:bg-white"
      >
        <Icon name="bell" className="size-6" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-700 px-1 text-xs font-semibold text-white ring-2 ring-ivory"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          aria-label="Notifications"
          className="fixed inset-x-4 top-16 z-40 flex max-h-[min(32rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
        >
          <header className="flex items-center gap-2 border-b border-stone-100 py-2 pr-2 pl-4">
            <h2 className="font-semibold text-stone-900">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead('all')}
                className="ml-auto min-h-11 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft"
              >
                Mark all as read
              </button>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!inbox ? (
              <p role="status" className="px-4 py-8 text-center text-sm text-stone-600">
                {failed ? 'Couldn’t load notifications. Check your connection.' : 'Loading…'}
              </p>
            ) : inbox.data.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-600">Nothing new. Office updates for you will show up here.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {inbox.data.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotice(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-stone-50 ${n.read ? '' : 'bg-forest-soft/40'}`}
                    >
                      <span
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${n.read ? 'bg-stone-100 text-stone-500' : 'bg-forest text-white'}`}
                      >
                        <Icon name={kindIcon[n.kind ?? ''] ?? 'bell'} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read ? 'text-stone-600' : 'font-medium text-stone-900'}`}>{n.message}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                          {relativeTime(new Date(n.created_at))}
                          {!n.read && <span className="sr-only">, unread</span>}
                        </span>
                      </span>
                      {!n.read && <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-red-700" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {settingsHref && (
            <footer className="border-t border-stone-100 px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate(`${settingsHref}#notifications`)
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold text-forest hover:bg-forest-soft"
              >
                <Icon name="sliders" className="size-4" />
                Choose what you’re notified about
              </button>
            </footer>
          )}
        </section>
      )}
    </div>
  )
}
