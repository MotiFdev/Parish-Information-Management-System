import type { Sacrament } from './sampleData'

// A register entry as the API presents it (backend SacramentalRegister::present),
// shared by Sacramental Records, Sacramental Review, and AI Record Search.

export interface RegisterEntry {
  id: string
  type: Sacrament
  /** The person (or couple) the entry is about. */
  subject: string
  /** ISO date of the sacrament (burial date for burials). */
  date: string
  register: { book: number; page: number; line: number }
  /** Short line for the table's people column. */
  people: string
  details: [label: string, value: string][]
  /** Present when is_corrected is true: what changed, and when the priest approved it. */
  correction?: { field: string; from: string; to: string; approvedOn: string; request: string }
  /** Scanned pages of the physical register that hold this entry. */
  scans: { label: string; file: string; document_id?: string }[]
  /** From the API: the entry as form values, keyed by field slug (entryFields.ts fieldKey). */
  values?: Record<string, string>
  /** From the API: a correction staff sent that the priest has not decided yet. */
  pending_correction?: {
    correction_id: string
    changes: { field: string; from: string; to: string }[]
    requested_by: string | null
    requested_at: string | null
  } | null
}

/** The table's people column heading, per register. */
export const peopleHeading: Record<Sacrament, string> = {
  Baptism: 'Parents',
  Confirmation: 'Sponsor',
  Marriage: 'Presiding priest',
  Burial: 'Age',
}
