import { api } from '../../../lib/api'
import type { RoleSlug } from '../../auth/authContext'
import type { Role, UserAccount } from '../sampleData'
import type { UserFormValues } from '../UserFormDialog'

// Client for /api/admin/users. Rows are mapped to the UserAccount shape the
// table, form, and row menu were designed around.

export const roleSlugs: Record<Role, RoleSlug> = {
  'System Administrator': 'admin',
  'Parish Priest': 'priest',
  Secretary: 'secretary',
  'GKK Officer': 'gkk',
  'PYA-KKK Officer': 'pya-kkk',
  'PPC Officer': 'ppc',
}

/** AdminUserResource on the backend. */
interface ApiUser {
  user_id: string
  first_name: string | null
  last_name: string | null
  username: string
  email: string
  /** Never null here: User Management lists only accounts whose role still exists. */
  role: { name: Role; slug: RoleSlug }
  is_active: boolean
  last_login: string | null
  is_current_user: boolean
}

export interface UserPage {
  rows: UserAccount[]
  total: number
  perPage: number
  /** Matches per role for the current search, ignoring the role filter. */
  counts: Record<RoleSlug | 'all', number>
  summary: { total: number; deactivated: number }
}

const dateTime = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const timeOnly = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' })

function lastSignIn(iso: string | null) {
  if (!iso) return null
  const at = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (at.toDateString() === today.toDateString()) return `Today, ${timeOnly.format(at)}`
  if (at.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeOnly.format(at)}`
  return dateTime.format(at)
}

function toAccount(u: ApiUser): UserAccount {
  return {
    id: u.user_id,
    // Accounts made before names were stored fall back to the username.
    firstName: u.first_name ?? u.username,
    lastName: u.last_name ?? '',
    username: u.username,
    email: u.email,
    role: u.role.name,
    active: u.is_active,
    lastLogin: lastSignIn(u.last_login),
    current: u.is_current_user,
  }
}

function toBody(v: Partial<UserFormValues>) {
  return {
    first_name: v.firstName,
    last_name: v.lastName,
    username: v.username,
    email: v.email,
    role: v.role ? roleSlugs[v.role] : undefined,
  }
}

export async function listUsers({ search, role, page, perPage }: { search: string; role: Role | 'All'; page: number; perPage: number }): Promise<UserPage> {
  const params = new URLSearchParams({ page: String(page + 1), per_page: String(perPage) })
  if (search) params.set('search', search)
  if (role !== 'All') params.set('role', roleSlugs[role])

  const res = await api<{
    data: ApiUser[]
    meta: { total: number; per_page: number }
    counts: UserPage['counts']
    summary: UserPage['summary']
  }>(`/api/admin/users?${params}`)

  return { rows: res.data.map(toAccount), total: res.meta.total, perPage: res.meta.per_page, counts: res.counts, summary: res.summary }
}

export async function createUser(values: UserFormValues) {
  const res = await api<{ data: ApiUser; invite_sent: boolean }>('/api/admin/users', { method: 'POST', body: toBody(values) })
  return { user: toAccount(res.data), inviteSent: res.invite_sent }
}

export async function updateUser(id: string, values: Partial<UserFormValues>) {
  const res = await api<{ data: ApiUser }>(`/api/admin/users/${id}`, { method: 'PATCH', body: toBody(values) })
  return toAccount(res.data)
}

export const sendPasswordReset = (id: string) => api<{ message: string }>(`/api/admin/users/${id}/password-reset`, { method: 'POST' })

export async function setActive(id: string, active: boolean) {
  const res = await api<{ data: ApiUser }>(`/api/admin/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' })
  return toAccount(res.data)
}
