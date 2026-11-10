import type { StaffPrefKey } from './settings/settingsApi'

// The switches on the staff Settings page. Each event notifies through the
// header bell; "Email me as well" adds an email copy. Name, picture, and
// password are in Profile Settings.

export const prefOptions: Array<{
  key: StaffPrefKey
  label: string
  hint: string
}> = [
  {
    key: 'email',
    label: 'Email me as well',
    hint: 'Notifications always appear under the bell at the top of the page. Turn this on to get a copy by email too.',
  },
  {
    key: 'newRequests',
    label: 'New record requests',
    hint: 'When someone sends a certificate, registration, or correction request',
  },
  {
    key: 'resubmissions',
    label: 'Documents and details sent back to you',
    hint: 'When a requester uploads a document again or corrects their details. If you handle the request, only you are told.',
  },
  {
    key: 'priestDecisions',
    label: 'Priest decisions',
    hint: 'When the priest approves or rejects a request you sent',
  },
  {
    key: 'bookings',
    label: 'New appointment requests',
    hint: 'When someone books a Mass intention, blessing, or meeting',
  },
  {
    key: 'announcements',
    label: 'Scheduled announcements',
    hint: 'When an announcement you scheduled goes live (shown under the bell only, not by email)',
  },
]
