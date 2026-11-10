import type { ReactNode } from 'react'
import { useAccountName } from '../features/auth/useAccountName'
import { communityNav } from '../features/community/nav'
import { PortalShell } from './PortalShell'

/** The portal GKK and PYA-KKK Officers share. */
export function CommunityLayout({ activeHref, children }: { activeHref: string; children: ReactNode }) {
  // RequireRole guarantees a signed-in GKK or PYA-KKK Officer here.
  const account = useAccountName()

  return (
    <PortalShell
      portalName="GKK & PYA-KKK"
      navLabel="GKK and PYA-KKK"
      nav={communityNav}
      homeHref="/community/events"
      user={{ name: account.full, initials: account.initials, role: account.role }}
      activeHref={activeHref}
    >
      {children}
    </PortalShell>
  )
}
