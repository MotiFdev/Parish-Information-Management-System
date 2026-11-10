import { createContext, useContext } from 'react'

export type RoleSlug = 'admin' | 'priest' | 'secretary' | 'gkk' | 'pya-kkk' | 'ppc'

/** Shape of AuthUserResource on the backend. */
export interface AuthUser {
  user_id: string
  first_name: string | null
  last_name: string | null
  username: string
  email: string
  /** Profile picture, or null to show initials. */
  photo_url: string | null
  is_active: boolean
  last_login: string | null
  role: { role_id: number; name: string | null; slug: RoleSlug | null }
  dashboard_path: string | null
  /** Staff only: notification choices and where the office pages open (StaffPreferences on the backend). */
  preferences: StaffPreferences | null
}

export interface StaffPreferences {
  notify: Record<'email' | 'newRequests' | 'resubmissions' | 'priestDecisions' | 'bookings' | 'announcements', boolean>
  defaults: {
    register: 'Baptism' | 'Confirmation' | 'Marriage' | 'Burial'
    calendarView: 'month' | 'week' | 'day'
    reportPeriod: 'last12' | 'year'
    pageSize: '10' | '25' | '50'
  }
}

export interface AuthContextValue {
  /** 'loading' until the first /api/auth/me answer arrives. */
  status: 'loading' | 'signed-in' | 'signed-out'
  user: AuthUser | null
  login: (login: string, password: string, remember?: boolean) => Promise<AuthUser>
  logout: () => Promise<void>
  /** After the user changes their own profile, so the header picks it up. */
  setUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
