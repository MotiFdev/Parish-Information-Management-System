import type { ReactNode } from 'react'
import { useAccountName } from '../features/auth/useAccountName'
import { staffNav } from '../features/staff/nav'
import { PortalShell } from './PortalShell'

export function StaffLayout({ activeHref, children }: { activeHref: string; children: ReactNode }) {
  // RequireRole guarantees a signed-in staff member here.
  const account = useAccountName()
  const user = {
    name: account.full,
    initials: account.initials,
    role: account.role || 'Secretary',
  }

  return (
    <PortalShell
      portalName="Parish Office"
      navLabel="Parish Office"
      nav={staffNav}
      homeHref="/secretary/dashboard"
      user={user}
      activeHref={activeHref}
    >
      {children}
    </PortalShell>
  )
}
