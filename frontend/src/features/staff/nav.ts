import type { PortalNavGroup } from '../../layouts/portalTypes'

// Routes and labels from section 4.3 of the specification, grouped so the
// items scan as short lists. Chapels & Officers moved to the GKK and
// PYA-KKK portal.
export const staffNav: PortalNavGroup[] = [
  {
    items: [{ label: 'Dashboard', href: '/secretary/dashboard', icon: 'gauge' }],
  },
  {
    heading: 'Records',
    items: [
      { label: 'Record Requests', href: '/secretary/requests', icon: 'file' },
      { label: 'Parishioners', href: '/secretary/parishioners', icon: 'users' },
      { label: 'Sacramental Records', href: '/secretary/sacraments', icon: 'book' },
      { label: 'Documents', href: '/secretary/documents', icon: 'paperclip' },
    ],
  },
  {
    heading: 'Parish life',
    items: [
      {
        label: 'Appointments & Events',
        href: '/secretary/appointments',
        icon: 'calendar',
      },
      { label: 'Announcements', href: '/secretary/announcements', icon: 'pin' },
      { label: 'Offerings', href: '/secretary/offerings', icon: 'wallet' },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { label: 'AI Record Search', href: '/secretary/ai-search', icon: 'search' },
      { label: 'Reports', href: '/secretary/reports', icon: 'chart' },
      { label: 'Settings', href: '/secretary/settings', icon: 'sliders' },
    ],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile Settings', href: '/secretary/profile', icon: 'user' }],
  },
]

export const staffNavItems = staffNav.flatMap((g) => g.items)
