import type { AnnouncementStatus } from './announcementsData'

// Scheduled shares the gold "waiting" tone used for pending items elsewhere;
// Published is forest because it is the live state parishioners can see.
const styles: Record<AnnouncementStatus, string> = {
  Draft: 'border border-stone-300 bg-white text-stone-700',
  Scheduled: 'bg-gold-soft text-brown',
  Published: 'bg-forest-soft text-forest',
  Archived: 'bg-stone-200 text-stone-700',
}

export function NoticeBadge({ status }: { status: AnnouncementStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${styles[status]}`}>{status}</span>
}
