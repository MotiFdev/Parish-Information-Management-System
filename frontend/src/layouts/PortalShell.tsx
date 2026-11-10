import { useState, type ReactNode } from 'react'
import logo from '../assets/parish-logo.jpg'
import { Link } from '../components/Link'
import { PreviewBar } from '../components/PreviewBar'
import { Dialog } from '../components/ui/Dialog'
import { Icon } from '../components/ui/Icon'
import { Avatar } from '../features/account/Avatar'
import { useAuth } from '../features/auth/authContext'
import { NotificationBell } from '../features/notifications/NotificationBell'
import { parish } from '../features/parishioner/sampleData'
import { navigate } from '../lib/router'
import type { PortalNavGroup, PortalUser } from './portalTypes'

// Shared by the administrator, priest, and (later) staff portals: a forest
// sidebar on desktop, a drawer on phones, and a breadcrumb header.

interface Props {
  /** Shown under the parish name and as the breadcrumb root, e.g. "System Administration". */
  portalName: string
  /** Accessible name for the sidebar navigation. */
  navLabel: string
  nav: PortalNavGroup[]
  homeHref: string
  user: PortalUser
  /** The design-preview bar above the header; left out once a portal runs on live data. */
  previewNote?: string
  activeHref: string
  children: ReactNode
}

function SidebarNav({ nav, label, activeHref, onNavigate }: { nav: PortalNavGroup[]; label: string; activeHref: string; onNavigate?: () => void }) {
  return (
    <nav aria-label={label} className="flex-1 overflow-y-auto px-3 py-4">
      {nav.map((group, i) => (
        <div key={group.heading ?? i} className={i > 0 ? 'mt-6' : ''}>
          {group.heading && <h2 className="px-3 pb-2 text-sm font-semibold text-forest-soft/85">{group.heading}</h2>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === activeHref
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors focus-visible:outline-white ${
                      active ? 'bg-forest-dark font-semibold text-white' : 'font-medium text-forest-soft hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {/* Gold marks the current page only; it is the sidebar's one accent. */}
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-gold" aria-hidden="true" />}
                    <Icon name={item.icon} className={`size-5 shrink-0 ${active ? 'text-gold' : 'text-forest-soft/85 group-hover:text-white'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.soon && <span className="text-xs font-medium text-[#c9d8cc]">Soon</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand({ href, portalName }: { href: string; portalName: string }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-white">
      <img src={logo} alt="" className="size-10 shrink-0 rounded-full bg-white object-cover ring-1 ring-gold/70" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-serif text-lg font-semibold text-white">{parish.shortName}</span>
        <span className="block truncate text-xs text-forest-soft">{portalName}</span>
      </span>
    </Link>
  )
}

export function PortalShell({ portalName, navLabel, nav, homeHref, user, previewNote, activeHref, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const current = nav.flatMap((g) => g.items).find((i) => i.href === activeHref)

  const { logout, user: account } = useAuth()
  // Every portal's nav has a Profile Settings page; the header avatar opens it.
  const profileHref = nav.flatMap((g) => g.items).find((i) => i.href.endsWith('/profile'))?.href
  // Where the bell's "choose what you're notified about" link goes, in portals that have one.
  const settingsHref = nav.flatMap((g) => g.items).find((i) => i.href.endsWith('/settings'))?.href
  const photoUrl = account?.photo_url ?? null
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setDrawerOpen(false)
    // Leave even if the server could not be reached; the local session is cleared either way.
    await logout().catch(() => {})
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#portal-main"
        onClick={(e) => {
          // Focus explicitly: following the hash alone leaves focus on <body> in Chromium.
          e.preventDefault()
          document.getElementById('portal-main')?.focus()
        }}
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-semibold text-forest shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col bg-forest lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Brand href={homeHref} portalName={portalName} />
        </div>
        <SidebarNav nav={nav} label={navLabel} activeHref={activeHref} />
      </aside>

      <div className="flex min-w-0 flex-col">
        {previewNote && <PreviewBar className="" note={previewNote} />}

        <header className="sticky top-0 z-30 border-b border-stone-300/60 bg-ivory">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="-ml-1 grid size-11 place-items-center rounded-lg text-forest hover:bg-white lg:hidden"
            >
              <Icon name="menu" className="size-6" />
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden text-stone-500 sm:block">{portalName}</li>
                <li aria-hidden="true" className="hidden text-stone-400 sm:block">
                  /
                </li>
                <li aria-current="page" className="truncate font-semibold text-stone-800">
                  {current?.label ?? 'Page not found'}
                </li>
              </ol>
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
              <NotificationBell settingsHref={settingsHref} />
              {(() => {
                const who = (
                  <>
                    <Avatar photoUrl={photoUrl} initials={user.initials} />
                    <span className="hidden leading-tight md:block">
                      <span className="block text-sm font-semibold text-stone-800">{user.name}</span>
                      <span className="block text-xs text-stone-500">{user.role}</span>
                    </span>
                  </>
                )
                return profileHref ? (
                  <Link
                    href={profileHref}
                    aria-label={`${user.name}: profile settings`}
                    className="flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 hover:bg-white"
                  >
                    {who}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5">{who}</div>
                )
              })()}
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="hidden min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-white sm:inline-flex"
              >
                <Icon name="logout" className="size-4" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </header>

        <main id="portal-main" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        labelledBy="portal-drawer-title"
        className="m-0 h-dvh max-h-none w-[min(18rem,calc(100%-3rem))] max-w-none bg-forest lg:hidden"
      >
        <div className="flex h-full flex-col bg-forest">
          <h2 id="portal-drawer-title" className="sr-only">
            Navigation
          </h2>
          <div className="flex items-center gap-2 border-b border-white/10 py-4 pr-2 pl-5">
            <Brand href={homeHref} portalName={portalName} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="ml-auto grid size-11 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-white"
            >
              <Icon name="close" className="size-6" />
            </button>
          </div>
          <SidebarNav nav={nav} label={navLabel} activeHref={activeHref} onNavigate={() => setDrawerOpen(false)} />
          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 font-medium text-forest-soft hover:bg-white/10 hover:text-white focus-visible:outline-white"
            >
              <Icon name="logout" className="size-5" />
              Sign out
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
