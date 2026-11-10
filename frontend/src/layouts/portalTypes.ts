import type { IconName } from '../components/ui/Icon'

export interface PortalNavItem {
  label: string
  href: string
  icon: IconName
  /** Not designed yet: the route opens a placeholder page and the nav says so. */
  soon?: boolean
}

export interface PortalNavGroup {
  heading?: string
  items: PortalNavItem[]
}

export interface PortalUser {
  name: string
  initials: string
  role: string
}
