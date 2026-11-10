// Types and helpers for Chapels & Officers in the GKK and PYA-KKK portal and
// the public Chapels page, both of which load real data from the API.

/** Where a chapel or officer stands with the PPC. */
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

/** A Sona as the chapel screens list it: the database id as text, and the name. */
export interface SonaOption {
  id: string
  name: string
}

export interface Chapel {
  id: string
  sonaId: string
  name: string
  patron: string
  fiesta: string
  contact: string
  fbAccount: string
  active: boolean
  /** New chapels wait for PPC approval before officers can be added. */
  status: ApprovalStatus
  /** The PPC's reason, when rejected. */
  reviewNote: string
}

export interface Officer {
  id: string
  chapelId: string
  name: string
  position: string
  /** Empty when the officer has no ministry, as the column is nullable. */
  ministry: string
  age: number | null
  fb: string
  contact: string
  term: number
  /** Profile photo URL. Not stored yet; the parishioner page shows a placeholder portrait until it is. */
  photo?: string
  /** New officers wait for PPC approval before they can be assigned to events. */
  status: ApprovalStatus
  /** The PPC's reason, when rejected. */
  reviewNote: string
}

// The examples in section 7.10, in the order a chapel council is usually read.
export const positions = ['President', 'V-President', 'Secretary', 'Treasurer', 'Auditor', 'Coordinator', 'Member'] as const
export const ministries = ['Worship', 'Evangelization', 'Social Services', 'Temporalities', 'Organizing', 'Youth/Vocation'] as const

// TODO: the specification stores term_year as a year but does not say when a term starts; the calendar year is assumed.
export const CURRENT_TERM = 2026

export const positionRank = (p: string) => {
  const i = (positions as readonly string[]).indexOf(p)
  return i === -1 ? positions.length : i
}
export const byRank = (a: Officer, b: Officer) => positionRank(a.position) - positionRank(b.position) || a.ministry.localeCompare(b.ministry) || a.name.localeCompare(b.name)

export const sonaShortName = (sonas: SonaOption[], id: string) => sonas.find((s) => s.id === id)?.name.replace(/^Sona /, '') ?? 'No Sona'

/* ---------- Spreadsheet import ---------- */

export const TEMPLATE_HEADERS = ['Name', 'Position', 'Ministry', 'Age', 'Facebook account', 'Contact number']
export const templateCsv = `${TEMPLATE_HEADERS.join(',')}\nJuan Dela Cruz,President,,52,Juan Dela Cruz,0917 000 0000\nMaria Santos,Coordinator,Worship,41,,\n`

/** Splits CSV text into rows, keeping commas and line breaks inside quoted cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export interface ImportRow {
  line: number
  officer: Omit<Officer, 'id' | 'chapelId' | 'term' | 'status' | 'reviewNote'>
  /** Why the row is left out; such rows are listed but not imported. */
  error?: string
  /** Imported as written, but worth a second look. */
  warning?: string
}

const column = (headers: string[], ...names: string[]) => headers.findIndex((h) => names.some((n) => h.replace(/[^a-z]/g, '').startsWith(n)))

/** Reads an officer list. Column order does not matter; headings are matched by name. */
export function readOfficerSheet(text: string): { rows: ImportRow[]; problem?: string } {
  const [head, ...body] = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  if (!head) return { rows: [], problem: 'The file is empty.' }
  const h = head.map((x) => x.trim().toLowerCase())
  const col = { name: column(h, 'name', 'fullname'), position: column(h, 'position'), ministry: column(h, 'ministry'), age: column(h, 'age'), fb: column(h, 'facebook', 'fb'), contact: column(h, 'contact', 'mobile', 'phone') }
  if (col.name === -1 || col.position === -1) return { rows: [], problem: 'The first row needs column headings, including Name and Position. Download the template to see the layout.' }
  if (!body.length) return { rows: [], problem: 'The file has headings but no officers under them.' }

  return {
    rows: body.map((r, i) => {
      const get = (c: number) => (c === -1 ? '' : (r[c] ?? '').trim())
      const ageText = get(col.age)
      const position = positions.find((p) => p.toLowerCase() === get(col.position).toLowerCase()) ?? get(col.position)
      const ministry = ministries.find((m) => m.toLowerCase() === get(col.ministry).toLowerCase()) ?? get(col.ministry)
      const officer = { name: get(col.name), position, ministry, age: ageText && /^\d{1,3}$/.test(ageText) ? Number(ageText) : null, fb: get(col.fb), contact: get(col.contact) }
      const error = !officer.name ? 'No name' : !officer.position ? 'No position' : ageText && officer.age === null ? `Age "${ageText}" is not a number` : undefined
      const unknown = [
        !(positions as readonly string[]).includes(position) && `position "${position}"`,
        ministry && !(ministries as readonly string[]).includes(ministry) && `ministry "${ministry}"`,
      ].filter(Boolean)
      return { line: i + 2, officer, error, warning: !error && unknown.length ? `New ${unknown.join(' and ')}` : undefined }
    }),
  }
}
