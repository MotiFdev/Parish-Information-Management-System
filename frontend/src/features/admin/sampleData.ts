// Placeholder content for the design phase. Replace with API data once the
// monitoring, session, and audit endpoints exist; nothing here reflects the
// real server. IP addresses use the RFC 5737 documentation ranges.

export type Role = 'System Administrator' | 'Parish Priest' | 'Secretary' | 'GKK Officer' | 'PYA-KKK Officer' | 'PPC Officer'

export const roles: Role[] = ['System Administrator', 'Parish Priest', 'Secretary', 'GKK Officer', 'PYA-KKK Officer', 'PPC Officer']

export const adminUser = {
  firstName: 'Rafael',
  lastName: 'Santos',
  email: 'r.santos@example.com',
}

// TODO: placeholder limits. Confirm with whoever runs the server before the
// dashboard starts flagging readings as high.
export const healthLimits = {
  cpuPercent: 85,
  ramPercent: 90,
  latencyMs: 800,
}

export const health = {
  cpuPercent: 38,
  ramUsedGb: 5.1,
  ramTotalGb: 8,
  /** p95 API response time, one reading every 5 minutes, oldest first. */
  latencyMs: [212, 198, 240, 231, 205, 264, 310, 288, 246, 223, 219, 236],
}

export type AlertSeverity = 'high' | 'review'

export interface SecurityAlert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  ip: string
  time: string
}

export const securityAlerts: SecurityAlert[] = [
  {
    id: 'al1',
    severity: 'high',
    title: 'Secretary account locked after failed sign-ins',
    detail: 'Seven wrong passwords for office.secretary@example.com within 10 minutes. The account stays locked until it is reset.',
    ip: '203.0.113.48',
    time: 'Today, 9:58 AM',
  },
  {
    id: 'al2',
    severity: 'review',
    title: 'Priest account signed in from a new address',
    detail: 'First sign-in from this IP address in the last 30 days. Confirm with the parish priest that it was them.',
    ip: '198.51.100.17',
    time: 'Today, 7:12 AM',
  },
  {
    id: 'al3',
    severity: 'review',
    title: 'Audit log exported outside office hours',
    detail: 'A CSV export of the audit log was downloaded by a System Administrator account.',
    ip: '192.0.2.31',
    time: 'Yesterday, 11:47 PM',
  },
]

export interface ActiveSession {
  id: string
  name: string
  role: Role
  device: 'desktop' | 'phone'
  client: string
  ip: string
  signedIn: string
  lastActive: string
  current?: boolean
}

export const activeSessions: ActiveSession[] = [
  {
    id: 's1',
    name: `${adminUser.firstName} ${adminUser.lastName}`,
    role: 'System Administrator',
    device: 'desktop',
    client: 'Firefox on Windows',
    ip: '192.0.2.31',
    signedIn: '8:02 AM',
    lastActive: 'Now',
    current: true,
  },
  {
    id: 's2',
    name: 'Fr. Antonio Reyes',
    role: 'Parish Priest',
    device: 'phone',
    client: 'Safari on iPhone',
    ip: '198.51.100.17',
    signedIn: '7:12 AM',
    lastActive: '25 min ago',
  },
  {
    id: 's3',
    name: 'Liza Mercado',
    role: 'Secretary',
    device: 'desktop',
    client: 'Chrome on Windows',
    ip: '192.0.2.40',
    signedIn: '8:15 AM',
    lastActive: '2 min ago',
  },
  {
    id: 's4',
    name: 'Joel Bautista',
    role: 'Secretary',
    device: 'desktop',
    client: 'Edge on Windows',
    ip: '192.0.2.41',
    signedIn: '9:30 AM',
    lastActive: '11 min ago',
  },
]

export interface UserAccount {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  role: Role
  active: boolean
  /** null when the account has never signed in. */
  lastLogin: string | null
  current?: boolean
}

const account = (
  id: string,
  firstName: string,
  lastName: string,
  username: string,
  role: Role,
  lastLogin: string | null,
  active = true,
): UserAccount => ({ id, firstName, lastName, username, email: `${username}@example.com`, role, active, lastLogin })

export const userAccounts: UserAccount[] = [
  { ...account('u01', adminUser.firstName, adminUser.lastName, 'r.santos', 'System Administrator', 'Today, 8:02 AM'), email: adminUser.email, current: true },
  account('u02', 'Antonio', 'Reyes', 'fr.reyes', 'Parish Priest', 'Today, 7:12 AM'),
  account('u03', 'Miguel', 'Torres', 'fr.torres', 'Parish Priest', 'Oct 27, 2026'),
  account('u04', 'Liza', 'Mercado', 'l.mercado', 'Secretary', 'Today, 8:15 AM'),
  account('u05', 'Joel', 'Bautista', 'j.bautista', 'Secretary', 'Today, 9:30 AM'),
  account('u06', 'Grace', 'Domingo', 'g.domingo', 'Secretary', 'Yesterday, 4:48 PM'),
  account('u07', 'Ramon', 'Aquino', 'r.aquino', 'Secretary', 'Aug 3, 2026', false),
]
