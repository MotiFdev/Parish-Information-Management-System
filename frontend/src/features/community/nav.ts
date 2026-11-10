import type { PortalNavGroup } from '../../layouts/portalTypes'

/** The portal GKK and PYA-KKK Officers share. */
export const communityNav: PortalNavGroup[] = [
  {
    items: [
      { label: 'Events', href: '/community/events', icon: 'calendar' },
      {
        label: 'Chapels & Officers',
        href: '/community/chapels',
        icon: 'church',
      },
    ],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile Settings', href: '/community/profile', icon: 'user' }],
  },
]
