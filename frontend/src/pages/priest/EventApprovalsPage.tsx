import { EventReviewBoard, type EventReviewConfig } from '../../features/community/events/EventReviewBoard'
import { approveEvent } from '../../features/community/events/eventsApi'
import { PriestLayout } from '../../layouts/PriestLayout'

const config: EventReviewConfig = {
  portal: 'priest',
  layout: PriestLayout,
  activeHref: '/priest/events',
  path: '/api/priest/events',
  title: 'Event Approvals',
  intro:
    'GKK and PYA-KKK events the PPC pre-approved. Your approval is final and puts the event on the parish home page; a rejection goes back to the organizers with your reason.',
  tabs: [
    { status: 'Pre-Approved', label: 'Waiting for your approval' },
    { status: 'Pending', label: 'With the PPC' },
    { status: 'Approved', label: 'Approved' },
    { status: 'Rejected', label: 'Rejected' },
  ],
  approveLabel: 'Approve',
  approvingLabel: 'Approving…',
  approve: approveEvent,
  approvedToast: (name) => `${name} approved. It now shows on the parish home page.`,
  rejectDetail: 'The organizers and the PPC see your reason. The organizers can edit the event and send it again.',
  emptyTitle: 'Nothing is waiting for your approval',
  emptyHelp: 'Events show up here once the PPC pre-approves them.',
}

export default function PriestEventApprovalsPage() {
  return <EventReviewBoard config={config} />
}
