import type { ApprovalStatus } from './chapels/chapelsData'

/** Marks a chapel or officer the PPC hasn't approved. Approved ones show nothing. */
export function ApprovalTag({ status }: { status: ApprovalStatus }) {
  if (status === 'Approved') return null
  return status === 'Pending' ? (
    <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-brown">Waiting for PPC</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-red-700">Rejected by PPC</span>
  )
}

/** The PPC's reason, under a rejected chapel or officer. */
export function RejectionNote({ status, note }: { status: ApprovalStatus; note: string }) {
  if (status !== 'Rejected' || !note) return null
  return (
    <span className="mt-1 block rounded-md bg-red-50 px-2 py-1 text-xs text-red-900">
      <span className="font-semibold">PPC: </span>
      {note} Edit it to send it again.
    </span>
  )
}
