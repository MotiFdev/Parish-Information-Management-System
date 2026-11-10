import type { Role } from './sampleData'

// Placeholder audit entries for the design phase, shaped like the backend's
// audit_logs table (user, action code, table, record id, IP, details, timestamp).
// Action codes follow the ones AuditLogger already writes (LOGIN, LOGIN_FAILED, ...).
// IP addresses use the RFC 5737 documentation ranges.

export type AuditCategory = 'requests' | 'documents' | 'certificates' | 'records' | 'signins' | 'accounts' | 'system'

export const categoryLabels: Record<AuditCategory, string> = {
  requests: 'Record requests',
  documents: 'Document verification',
  certificates: 'Certificate release',
  records: 'Register corrections',
  signins: 'Sign-ins',
  accounts: 'Accounts & permissions',
  system: 'Backups & exports',
}

export const actions: Record<string, { label: string; category: AuditCategory; alert?: boolean }> = {
  LOGIN: { label: 'Signed in', category: 'signins' },
  LOGOUT: { label: 'Signed out', category: 'signins' },
  LOGIN_FAILED: { label: 'Sign-in failed', category: 'signins', alert: true },
  LOGIN_BLOCKED_INACTIVE: { label: 'Sign-in blocked: account deactivated', category: 'signins', alert: true },
  REQUEST_SUBMITTED: { label: 'Request submitted', category: 'requests' },
  REQUEST_STATUS_CHANGED: { label: 'Request status changed', category: 'requests' },
  REQUEST_APPROVED: { label: 'Request approved and signed', category: 'requests' },
  REQUEST_REJECTED: { label: 'Request rejected', category: 'requests', alert: true },
  REQUEST_COMPLETED: { label: 'Request completed', category: 'requests' },
  DOCUMENT_VERIFIED: { label: 'Document checked', category: 'documents' },
  CERTIFICATE_RELEASED: { label: 'Certificate released', category: 'certificates' },
  RECORD_CORRECTED: { label: 'Register entry corrected', category: 'records' },
  USER_CREATED: { label: 'Account created', category: 'accounts' },
  USER_DEACTIVATED: { label: 'Account deactivated', category: 'accounts' },
  PASSWORD_RESET_SENT: { label: 'Password reset link sent', category: 'accounts' },
  BACKUP_COMPLETED: { label: 'Backup completed', category: 'system' },
  AUDIT_LOG_EXPORTED: { label: 'Audit log exported', category: 'system' },
}

export interface AuditEntry {
  id: string
  /** ISO timestamp with the parish's UTC+8 offset. */
  at: string
  /** null for actions the system takes on its own, or failed sign-ins for unknown accounts. */
  user: { name: string; role: Role } | null
  action: keyof typeof actions
  table: string
  recordId: string
  /** Human-readable name for the affected record. */
  record: string
  ip: string
  /** Changed fields: [before, after]. */
  changes?: Record<string, [before: string | null, after: string | null]>
  note?: string
}

const liza = { name: 'Liza Mercado', role: 'Secretary' as const }
const joel = { name: 'Joel Bautista', role: 'Secretary' as const }
const grace = { name: 'Grace Domingo', role: 'Secretary' as const }
const reyes = { name: 'Fr. Antonio Reyes', role: 'Parish Priest' as const }
const admin = { name: 'Rafael Santos', role: 'System Administrator' as const }

const office = '192.0.2.40'

export const auditEntries: AuditEntry[] = [
  { id: 'lg31', at: '2026-10-31T09:58:40+08:00', user: null, action: 'LOGIN_FAILED', table: 'users', recordId: 'unknown', record: 'office.secretary@example.com', ip: '203.0.113.48', note: 'Seventh wrong password in 10 minutes. Account locked.' },
  { id: 'lg30', at: '2026-10-31T09:47:03+08:00', user: liza, action: 'CERTIFICATE_RELEASED', table: 'record_requests', recordId: 'REQ-2026-0131', record: 'REQ-2026-0131 · Baptism certificate', ip: office, changes: { status: ['Approved', 'Ready for Collection'] } },
  { id: 'lg29', at: '2026-10-31T09:41:27+08:00', user: reyes, action: 'REQUEST_APPROVED', table: 'record_requests', recordId: 'REQ-2026-0131', record: 'REQ-2026-0131 · Baptism certificate', ip: '198.51.100.17', changes: { status: ['Under Verification', 'Approved'], approved_by_priest_id: [null, 'Fr. Antonio Reyes'] }, note: 'Signed digitally.' },
  { id: 'lg28', at: '2026-10-31T09:30:20+08:00', user: joel, action: 'LOGIN', table: 'users', recordId: 'u05', record: 'Joel Bautista', ip: '192.0.2.41' },
  { id: 'lg27', at: '2026-10-31T09:22:51+08:00', user: liza, action: 'DOCUMENT_VERIFIED', table: 'request_documents', recordId: 'RD-5531', record: 'Birth Certificate · REQ-2026-0142', ip: office, changes: { verification_status: ['Pending', 'Verified'] } },
  { id: 'lg26', at: '2026-10-31T09:20:09+08:00', user: liza, action: 'DOCUMENT_VERIFIED', table: 'request_documents', recordId: 'RD-5530', record: 'Valid ID · REQ-2026-0142', ip: office, changes: { verification_status: ['Pending', 'Needs Resubmission'] }, note: 'The ID photo is too blurry to read.' },
  { id: 'lg25', at: '2026-10-31T09:18:44+08:00', user: liza, action: 'REQUEST_STATUS_CHANGED', table: 'record_requests', recordId: 'REQ-2026-0142', record: 'REQ-2026-0142 · Baptism certificate', ip: office, changes: { status: ['Pending', 'Under Verification'] } },
  { id: 'lg24', at: '2026-10-31T08:40:15+08:00', user: liza, action: 'RECORD_CORRECTED', table: 'sacramental_records', recordId: 'SR-B-12-48-3', record: 'Baptism register · Book 12, Page 48, Line 3', ip: office, changes: { mother_name: ['Maria Santos', 'Maria Santos Dela Cruz'], is_corrected: ['false', 'true'] }, note: 'Correction approved under REQ-2026-0127.' },
  { id: 'lg23', at: '2026-10-31T08:31:02+08:00', user: reyes, action: 'REQUEST_APPROVED', table: 'record_requests', recordId: 'REQ-2026-0127', record: 'REQ-2026-0127 · Baptism record correction', ip: '198.51.100.17', changes: { status: ['Under Verification', 'Approved'] }, note: 'Signed digitally.' },
  { id: 'lg22', at: '2026-10-31T08:15:33+08:00', user: liza, action: 'LOGIN', table: 'users', recordId: 'u04', record: 'Liza Mercado', ip: office },
  { id: 'lg21', at: '2026-10-31T08:02:10+08:00', user: admin, action: 'LOGIN', table: 'users', recordId: 'u01', record: 'Rafael Santos', ip: '192.0.2.31' },
  { id: 'lg20', at: '2026-10-31T07:12:48+08:00', user: reyes, action: 'LOGIN', table: 'users', recordId: 'u02', record: 'Fr. Antonio Reyes', ip: '198.51.100.17', note: 'First sign-in from this address in 30 days.' },
  { id: 'lg19', at: '2026-10-31T02:04:31+08:00', user: null, action: 'BACKUP_COMPLETED', table: 'backups', recordId: 'BK-2026-10-31-V', record: 'Vector database', ip: '127.0.0.1' },
  { id: 'lg18', at: '2026-10-31T02:00:12+08:00', user: null, action: 'BACKUP_COMPLETED', table: 'backups', recordId: 'BK-2026-10-31-R', record: 'Relational database', ip: '127.0.0.1' },
  { id: 'lg17', at: '2026-10-30T23:47:05+08:00', user: admin, action: 'AUDIT_LOG_EXPORTED', table: 'audit_logs', recordId: 'export', record: 'Audit log, all entries', ip: '192.0.2.31', note: 'Format: CSV.' },
  { id: 'lg16', at: '2026-10-30T17:05:40+08:00', user: grace, action: 'LOGOUT', table: 'users', recordId: 'u06', record: 'Grace Domingo', ip: '192.0.2.42' },
  { id: 'lg15', at: '2026-10-30T16:48:19+08:00', user: reyes, action: 'REQUEST_REJECTED', table: 'record_requests', recordId: 'REQ-2026-0129', record: 'REQ-2026-0129 · Confirmation certificate', ip: '198.51.100.17', changes: { status: ['Under Verification', 'Rejected'] }, note: 'Reason: no confirmation entry found for that date in this parish.' },
  { id: 'lg14', at: '2026-10-30T16:20:57+08:00', user: grace, action: 'REQUEST_STATUS_CHANGED', table: 'record_requests', recordId: 'REQ-2026-0129', record: 'REQ-2026-0129 · Confirmation certificate', ip: '192.0.2.42', changes: { status: ['Pending', 'Under Verification'] } },
  { id: 'lg13', at: '2026-10-30T15:10:33+08:00', user: admin, action: 'USER_CREATED', table: 'users', recordId: 'u19', record: 'Lorna Cruz', ip: '192.0.2.31', changes: { role: [null, 'Parishioner'], email: [null, 'l.cruz@example.com'] } },
  { id: 'lg11', at: '2026-10-30T11:30:08+08:00', user: admin, action: 'USER_DEACTIVATED', table: 'users', recordId: 'u07', record: 'Ramon Aquino', ip: '192.0.2.31', changes: { is_active: ['true', 'false'] } },
  { id: 'lg10', at: '2026-10-30T10:12:44+08:00', user: grace, action: 'DOCUMENT_VERIFIED', table: 'request_documents', recordId: 'RD-5502', record: 'Death Certificate · REQ-2026-0133', ip: '192.0.2.42', changes: { verification_status: ['Pending', 'Verified'] } },
  { id: 'lg09', at: '2026-10-30T10:05:18+08:00', user: grace, action: 'REQUEST_STATUS_CHANGED', table: 'record_requests', recordId: 'REQ-2026-0133', record: 'REQ-2026-0133 · Burial certificate', ip: '192.0.2.42', changes: { status: ['Pending', 'Under Verification'] } },
  { id: 'lg08', at: '2026-10-30T09:00:51+08:00', user: grace, action: 'LOGIN', table: 'users', recordId: 'u06', record: 'Grace Domingo', ip: '192.0.2.42' },
  { id: 'lg07', at: '2026-10-30T02:04:20+08:00', user: null, action: 'BACKUP_COMPLETED', table: 'backups', recordId: 'BK-2026-10-30-V', record: 'Vector database', ip: '127.0.0.1' },
  { id: 'lg06', at: '2026-10-30T02:00:09+08:00', user: null, action: 'BACKUP_COMPLETED', table: 'backups', recordId: 'BK-2026-10-30-R', record: 'Relational database', ip: '127.0.0.1' },
  { id: 'lg05', at: '2026-10-29T16:30:02+08:00', user: joel, action: 'REQUEST_COMPLETED', table: 'record_requests', recordId: 'REQ-2026-0118', record: 'REQ-2026-0118 · Marriage certificate', ip: '192.0.2.41', changes: { status: ['Ready for Collection', 'Completed'] }, note: 'Collected at the parish office.' },
  { id: 'lg03', at: '2026-10-29T11:00:45+08:00', user: admin, action: 'PASSWORD_RESET_SENT', table: 'users', recordId: 'u09', record: 'Teresa Navarro', ip: '192.0.2.31' },
  { id: 'lg02', at: '2026-10-29T10:20:14+08:00', user: null, action: 'REQUEST_SUBMITTED', table: 'record_requests', recordId: 'REQ-2026-0142', record: 'REQ-2026-0142 · Baptism certificate', ip: '203.0.113.12', changes: { status: [null, 'Pending'], privacy_consent: [null, 'true'] } },
  { id: 'lg01', at: '2026-10-29T08:55:03+08:00', user: joel, action: 'LOGIN', table: 'users', recordId: 'u05', record: 'Joel Bautista', ip: '192.0.2.41' },
]
