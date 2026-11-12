import type { PortalNavGroup } from '../../layouts/portalTypes'

// Routes and labels from section 4.2 of the specification.
export const priestNav: PortalNavGroup[] = [
  {
    items: [
      {
        label: 'Dashboard & Analytics',
        href: '/priest/dashboard',
        icon: 'gauge',
      },
      {
        label: 'Certificate Approvals',
        href: '/priest/records/verify',
        icon: 'seal',
      },
      {
        label: 'Sacramental Review',
        href: '/priest/records/sacramental',
        icon: 'book',
      },
      { label: 'Event Approvals', href: '/priest/events', icon: 'calendar' },
      { label: 'Reports & Analytics', href: '/priest/reports', icon: 'chart' },
      { label: 'AI Record Search', href: '/priest/ai-search', icon: 'search' },
    ],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile Settings', href: '/priest/profile', icon: 'user' }],
  },
]

export const priestNavItems = priestNav.flatMap((g) => g.items)
