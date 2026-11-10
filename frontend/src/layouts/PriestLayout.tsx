import type { ReactNode } from 'react'
import { useAccountName } from '../features/auth/useAccountName'
import { priestNav } from '../features/priest/nav'
import { PortalShell } from './PortalShell'

export function PriestLayout({ activeHref, children }: { activeHref: string; children: ReactNode }) {
  // RequireRole guarantees a signed-in priest here.
  const account = useAccountName()
  const user = {
    name: account.full,
    initials: account.initials,
    role: account.role || 'Parish Priest',
  }

  return (
    <PortalShell
      portalName="Parish Priest"
      navLabel="Parish Priest"
      nav={priestNav}
      homeHref="/priest/dashboard"
      user={user}
      activeHref={activeHref}
    >
      {children}
    </PortalShell>
  )
}
