import type { Report } from '../../priest/reports/reportData'
import { useServerReport } from '../../priest/reports/useServerReport'
import type { Sacrament } from '../../priest/sampleData'

// The four staff reports from section 4.3 (backend Staff\ReportController and
// App\Services\StaffReports). The server builds each report from the audit log,
// the registers, record requests, and appointments.

export type StaffReportType = 'daily' | 'sacramental' | 'turnaround' | 'appointments'
export type TurnaroundGroup = 'recordType' | 'requestType' | 'month'

export const reportTypes: { value: StaffReportType; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily Log', hint: 'Everything the office did on one day: requests, documents, releases, register changes, and appointments.' },
  { value: 'sacramental', label: 'Sacramental Count Summary', hint: 'Baptisms, confirmations, marriages, and burials recorded per month.' },
  { value: 'turnaround', label: 'Request Turnaround Report', hint: 'How many days requests took from submission to ready for collection.' },
  { value: 'appointments', label: 'Appointments by Chapel', hint: 'Booking requests per chapel, the parish church, and homes.' },
]

export interface StaffReportConfig {
  type: StaffReportType
  /** Daily Log day, 'YYYY-MM-DD'. */
  date: string
  /** Audit category key, or 'all'. */
  activity: string
  staff: string
  /** Month range for the other three reports, 'YYYY-MM'. */
  from: string
  to: string
  sacraments: Sacrament[]
  groupBy: TurnaroundGroup
  eventType: string
}

/** Choices the options panel offers, from the server. */
export interface ReportOptions {
  people: string[]
  categories: Array<{ key: string; label: string }>
  event_types: string[]
}

const TZ = 'Asia/Manila'
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
export const todayKey = () => dayKey.format(new Date())
export const thisMonth = () => todayKey().slice(0, 7)

/** 'YYYY-MM' moved by n months. */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const query = (c: StaffReportConfig) => {
  const p = new URLSearchParams({ type: c.type })
  if (c.type === 'daily') {
    p.set('date', c.date)
    if (c.activity !== 'all') p.set('category', c.activity)
    if (c.staff) p.set('person', c.staff)
    return p
  }
  p.set('from', c.from)
  p.set('to', c.to)
  if (c.type === 'sacramental') c.sacraments.forEach((s) => p.append('sacraments[]', s))
  if (c.type === 'turnaround') p.set('group_by', c.groupBy)
  if (c.type === 'appointments' && c.eventType !== 'all') p.set('event_type', c.eventType)
  return p
}

type Loaded = { report: Report; options: ReportOptions }

/** The report for these options; the last report of the same type stays up while the next loads. */
export function useStaffReport(c: StaffReportConfig, enabled: boolean) {
  return useServerReport<Loaded>(enabled ? `/api/secretary/reports?${query(c)}` : null, c.type)
}
