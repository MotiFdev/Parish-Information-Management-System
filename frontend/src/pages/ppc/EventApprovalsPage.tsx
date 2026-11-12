import { EventReviewBoard, type EventReviewConfig } from '../../features/community/events/EventReviewBoard'
import { preApproveEvent } from '../../features/community/events/eventsApi'
import { PpcLayout } from '../../layouts/PpcLayout'

const config: EventReviewConfig = {
  portal: 'ppc',
  layout: PpcLayout,
  activeHref: '/ppc/events',
  path: '/api/ppc/events',
  title: 'Event Approvals',
  intro:
    'Events the GKK and PYA-KKK set up. Pre-approve them to send them to the parish priest for the final approval, or reject them with a reason the organizers can act on. An edited event comes back here.',
  tabs: [
    { status: 'Pending', label: 'Waiting for pre-approval' },
    { status: 'Pre-Approved', label: 'With the priest' },
    { status: 'Approved', label: 'Approved' },
    { status: 'Rejected', label: 'Rejected' },
  ],
  approveLabel: 'Pre-approve',
  approvingLabel: 'Sending…',
  approve: preApproveEvent,
  approvedToast: (name) => `${name} pre-approved and sent to the parish priest.`,
  rejectDetail: 'The organizers see your reason and can edit the event and send it again.',
  emptyTitle: 'Nothing is waiting for pre-approval',
  emptyHelp: 'New and edited events from the GKK and PYA-KKK show up here.',
}

export default function EventApprovalsPage() {
  return <EventReviewBoard config={config} />
}
