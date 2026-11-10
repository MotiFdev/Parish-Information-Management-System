import { useEffect, useState, type ReactNode } from 'react'
import logo from '../assets/parish-logo.jpg'
import { Link } from '../components/Link'
import { BackToTop } from '../components/BackToTop'
import { ChatLauncher, ChatPanel } from '../features/parishioner/inquiries/ChatWidget'
import { useInquiry } from '../features/parishioner/inquiries/inquiryContext'
import { Icon, type IconName } from '../components/ui/Icon'
import { parish } from '../features/parishioner/sampleData'
import { useOfficeHours } from '../features/parishioner/officeHours'

interface NavItem {
  label: string
  href: string
  icon: IconName
}

const primaryNav: NavItem[] = [
  { label: 'Home', href: '/home', icon: 'home' },
  { label: 'History', href: '/home#history', icon: 'book' },
  { label: 'Record Requests', href: '/parishioner/requests', icon: 'file' },
  { label: 'Book Appointment', href: '/parishioner/appointments', icon: 'calendar' },
  { label: 'Track Request', href: '/track', icon: 'search' },
  { label: 'Chapels', href: '/parishioner/chapels', icon: 'church' },
]

interface Props {
  activeHref: string
  /** Full-width content rendered directly under the nav bar, outside the page container. */
  hero?: ReactNode
  children: ReactNode
}

/** The public parish site. Nobody signs in here; staff, clergy, and admins use the footer link. */
export function ParishionerLayout({ activeHref, hero, children }: Props) {
  const officeHours = useOfficeHours()
  const { open: chatOpen, setOpen: setChatOpen } = useInquiry()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The only blurred surface: page content scrolls under this sticky bar. */}
      <header className="sticky top-0 z-30 border-b border-stone-300/50 bg-parchment/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href="/home" onClick={closeMenu} className="flex min-w-0 items-center gap-2.5 rounded-lg">
            <img src={logo} alt="" className="size-10 shrink-0 rounded-full bg-white object-cover ring-1 ring-gold/60" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-serif text-lg font-semibold text-forest">{parish.shortName}</span>
              <span className="block truncate text-xs text-stone-500">Parish services online</span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {primaryNav.map((item) => {
                const active = item.href === activeHref
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex min-h-11 items-center rounded-lg px-3 text-[15px] transition-colors ${
                        active ? 'font-semibold text-forest' : 'font-medium text-stone-600 hover:bg-white/70 hover:text-forest'
                      }`}
                    >
                      {item.label}
                      <span className={`absolute inset-x-3 -bottom-[11px] h-[3px] rounded-t-full ${active ? 'bg-gold-deep' : 'bg-transparent'}`} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-forest hover:bg-white/80 lg:hidden"
          >
            <Icon name={menuOpen ? 'close' : 'menu'} className="size-6" />
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-stone-300/50 bg-parchment px-4 pt-2 pb-4 shadow-lg sm:px-6 lg:hidden"
          >
            <ul className="space-y-0.5">
              {primaryNav.map((item) => {
                const active = item.href === activeHref
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMenu}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-lg px-3 ${
                        active
                          ? 'bg-white font-semibold text-forest shadow-[inset_3px_0_0_var(--color-gold-deep)]'
                          : 'font-medium text-stone-700 hover:bg-white/70'
                      }`}
                    >
                      <Icon name={item.icon} className={`size-5 ${active ? 'text-gold-deep' : 'text-stone-400'}`} />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu()
                    setChatOpen(true)
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 font-medium text-stone-700 hover:bg-white/70"
                >
                  <Icon name="message" className="size-5 text-stone-400" />
                  Ask the parish
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {hero}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>
      </main>

      {/* Bottom padding keeps the floating buttons from covering the footer text. */}
      <footer className="border-t border-stone-300/50 bg-parchment">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-6 pb-24 text-sm text-stone-500 sm:px-6 lg:px-8 lg:pb-6">
          <p className="font-serif text-base font-semibold text-forest">{parish.name}</p>
          <p className="flex items-center gap-2">
            <Icon name="clock" className="size-4 shrink-0 text-brown" />
            <span>
              Parish office: <span className="font-medium text-stone-700">{officeHours}</span>
            </span>
          </p>
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-stone-600 hover:text-forest hover:underline">
            Parish secretary, clergy, and admin sign in
          </Link>
        </div>
      </footer>

      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 [&>*]:pointer-events-auto">
        <BackToTop hidden={chatOpen} />
        <ChatLauncher />
      </div>
      <ChatPanel />
    </div>
  )
}
