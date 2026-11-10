import type { ReactNode } from 'react'
import { useAuth } from '../features/auth/authContext'
import { adminNav } from '../features/admin/nav'
import { PortalShell } from './PortalShell'

export function AdminLayout({ activeHref, children }: { activeHref: string; children: ReactNode }) {
  // RequireRole guarantees a signed-in administrator here. Older accounts
  // without a stored name show their username instead.
  const { user: account } = useAuth()
  const fullName = [account?.first_name, account?.last_name].filter(Boolean).join(' ')
  const name = fullName || account?.username || 'Administrator'
  const initials = fullName ? `${account?.first_name?.[0] ?? ''}${account?.last_name?.[0] ?? ''}`.toUpperCase() : name.slice(0, 2).toUpperCase()
  const user = {
    name,
    initials,
    role: account?.role.name ?? 'System Administrator',
  }

  return (
    <PortalShell
      portalName="System Administration"
      navLabel="Administration"
      nav={adminNav}
      homeHref="/admin/dashboard"
      user={user}
      activeHref={activeHref}
    >
      {children}
    </PortalShell>
  )
}
