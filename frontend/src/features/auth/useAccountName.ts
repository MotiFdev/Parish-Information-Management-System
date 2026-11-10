import { useAuth } from './authContext'

/**
 * How the signed-in account is named across the staff, priest, and admin
 * portals. Priests are addressed as "Fr.". Accounts without a stored name
 * fall back to their username.
 */
export function useAccountName() {
  const { user } = useAuth()
  const first = user?.first_name?.trim() ?? ''
  const last = user?.last_name?.trim() ?? ''
  const username = user?.username ?? ''
  const title = user?.role.slug === 'priest' ? 'Fr. ' : ''
  const fullName = [first, last].filter(Boolean).join(' ')

  return {
    /** "Fr. Antonio Reyes", "Liza Mercado", or the username. */
    full: `${title}${fullName || username}`,
    /** For greetings: "Fr. Antonio", "Liza", or the username. */
    short: `${title}${first || username}`,
    initials: fullName ? `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() : username.slice(0, 2).toUpperCase(),
    role: user?.role.name ?? '',
  }
}
