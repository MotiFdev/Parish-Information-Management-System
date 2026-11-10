import type { Sacrament } from '../sampleData'

// Report shapes shared by the priest's Reports & Analytics and the staff Reports
// page. The server builds every report (backend App\Services\ParishReports and
// StaffReports); the page only draws it.

export type ReportType = 'Demographic' | 'Sacramental' | 'Financial'
export type DemographicGroup = 'sona' | 'age' | 'sex'

export interface ReportConfig {
  type: ReportType
  /** Inclusive month range as 'YYYY-MM'; ignored by the demographic snapshot. */
  from: string
  to: string
  groupBy: DemographicGroup
  sacraments: Sacrament[]
}

export interface Report {
  title: string
  period: string
  note?: string
  columns: string[]
  /** Numeric cells are formatted by the preview and written raw to CSV. */
  rows: (string | number)[][]
  total?: (string | number)[]
  /** Which numeric columns hold money. */
  money?: number[]
  /** Columns after the first that hold text, so they read left-aligned like the first. */
  textColumns?: number[]
  /** How many months the report covers; absent for the demographic snapshot. */
  months?: number
  chart: { title: string; kind: 'bars' | 'columns'; items: { label: string; value: number }[]; money?: boolean }
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function reportCsv(r: Report) {
  return [r.columns, ...r.rows, ...(r.total ? [r.total] : [])].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
