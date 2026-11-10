import type { ReactNode } from 'react'
import { useAccountName } from '../features/auth/useAccountName'
import { ppcNav } from '../features/ppc/nav'
import { PortalShell } from './PortalShell'

/** The PPC portal. */
export function PpcLayout({ activeHref, children }: { activeHref: string; children: ReactNode }) {
  // RequireRole guarantees a signed-in PPC Officer here.
  const account = useAccountName()

  return (
    <PortalShell
      portalName="PPC"
      navLabel="PPC"
      nav={ppcNav}
      homeHref="/ppc/events"
      user={{ name: account.full, initials: account.initials, role: account.role }}
      activeHref={activeHref}
    >
      {children}
    </PortalShell>
  )
}
