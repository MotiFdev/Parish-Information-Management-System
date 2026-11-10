import type { AppointmentStatus, DocumentStatus, RequestStatus } from '../sampleData'

type Status = RequestStatus | AppointmentStatus | DocumentStatus

const styles: Record<Status, string> = {
  Pending: 'bg-gold-soft text-brown',
  'Under Verification': 'bg-brown-soft text-brown',
  Approved: 'bg-forest-soft text-forest',
  Verified: 'bg-forest-soft text-forest',
  Rejected: 'bg-red-50 text-red-700',
  'Needs Resubmission': 'bg-red-50 text-red-700',
  'Ready for Collection': 'bg-forest text-white',
  Completed: 'bg-stone-100 text-stone-600',
  Cancelled: 'bg-stone-100 text-stone-600',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${styles[status]}`}>
      {status}
    </span>
  )
}
