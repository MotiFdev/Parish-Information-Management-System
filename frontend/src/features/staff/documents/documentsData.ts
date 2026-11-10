import type { Sacrament } from '../../priest/sampleData'

// Types and helpers for the staff Documents page (backend Staff\DocumentController).

export type FileType = 'PDF' | 'JPG' | 'PNG'

export type LinkKind = 'register' | 'request' | 'parishioner' | 'none'

/** Where a file is filed, as the server describes it. */
export interface DocLink {
  kind: LinkKind
  targetId: string | null
  /** What the file is: "Register scan", "Valid ID", and so on. */
  label: string | null
  /** The register of a register scan. */
  type?: Sacrament
  title: string
  detail: string | null
}

/** What staff choose in the link picker. */
export interface LinkChoice {
  kind: LinkKind
  /** Register to pick the entry from. */
  type: Sacrament
  targetId: string
  label: string
}

export type Folder = 'all' | LinkKind

export interface DocFile {
  id: string
  name: string
  fileType: FileType
  sizeKb: number
  uploadedBy: string
  uploadedAt: string
  link: DocLink
  /** False for a requester's upload, which stays with its request. */
  movable: boolean
}

/** The records a file can be linked to. */
export interface LinkTargets {
  entries: Array<{ id: string; type: Sacrament; register: { book: number; page: number; line: number }; subject: string }>
  /** Requests still being checked by the office. */
  requests: Array<{ id: string; number: string; record_type: string; request_type: string; subject: string }>
  parishioners: Array<{ id: string; name: string; born: string | null }>
}

/** What a file can be, from the DocumentLabel enum. Register scans are labelled by the server. */
export const fileLabels = ['Valid ID', 'Birth Certificate', 'Baptismal Certificate', 'Death Certificate', 'Burial Permit', 'Other'] as const

export const ACCEPT = '.pdf,.jpg,.jpeg,.png'
/** Matches DOCUMENTS_MAX_UPLOAD_KB on the backend. */
export const MAX_KB = 10 * 1024

export const folderLabels: Record<Folder, string> = {
  all: 'All files',
  register: 'Register scans',
  request: 'Request uploads',
  parishioner: 'Parishioner files',
  none: 'Not linked yet',
}

export const emptyChoice: LinkChoice = { kind: 'none', type: 'Baptism', targetId: '', label: 'Valid ID' }

/** The picker's starting point for a file already filed somewhere. */
export const choiceFrom = (l: DocLink): LinkChoice =>
  l.kind === 'none' ? { ...emptyChoice, kind: 'register' } : { kind: l.kind, type: l.type ?? 'Baptism', targetId: l.targetId ?? '', label: l.label ?? 'Other' }

/** A link is complete when the record it points at has been chosen. */
export const linkComplete = (c: LinkChoice) => c.kind === 'none' || Boolean(c.targetId)

export function formatSize(kb: number) {
  if (kb < 1024) return `${kb} KB`
  const mb = kb / 1024
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
}
