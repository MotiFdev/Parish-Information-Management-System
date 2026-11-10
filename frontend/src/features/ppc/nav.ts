import type { PortalNavGroup } from '../../layouts/portalTypes'

/** The PPC portal: approving what GKK and PYA-KKK Officers set up. */
export const ppcNav: PortalNavGroup[] = [
  {
    heading: 'Approvals',
    items: [
      { label: 'Events', href: '/ppc/events', icon: 'calendar' },
      { label: 'Chapels & Officers', href: '/ppc/chapels', icon: 'church' },
    ],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile Settings', href: '/ppc/profile', icon: 'user' }],
  },
]
