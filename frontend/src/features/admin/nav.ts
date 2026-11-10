import type { PortalNavGroup } from '../../layouts/portalTypes'

// Grouped the way the routes are: the three /admin/settings/* pages are
// system upkeep, the rest is day-to-day account work.
export const adminNav: PortalNavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: 'gauge' },
      { label: 'User Management', href: '/admin/users', icon: 'users' },
    ],
  },
  {
    heading: 'System settings',
    items: [
      { label: 'Audit Logs', href: '/admin/settings/logs', icon: 'list' },
      {
        label: 'Backup & Recovery',
        href: '/admin/settings/backup',
        icon: 'database',
      },
      {
        label: 'AI Engine Settings',
        href: '/admin/settings/ai-config',
        icon: 'sliders',
      },
    ],
  },
]

export const adminNavItems = adminNav.flatMap((g) => g.items)
