import { parish } from '../../features/parishioner/sampleData'
import { useAccountName } from '../../features/auth/useAccountName'
import { ActivityCard } from '../../features/staff/dashboard/ActivityCard'
import { AiSearchCard } from '../../features/staff/dashboard/AiSearchCard'
import { useStaffDashboard } from '../../features/staff/dashboard/dashboardApi'
import { EventsCard } from '../../features/staff/dashboard/EventsCard'
import { RequestsCard } from '../../features/staff/dashboard/RequestsCard'
import { StaffKpis } from '../../features/staff/dashboard/StaffKpis'
import { StaffLayout } from '../../layouts/StaffLayout'
import { usePreviewState } from '../../lib/preview'

const today = new Intl.DateTimeFormat('en-PH', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila',
})

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// Standard dashboard order, as on the priest portal: headline figures, then the
// work queue in the wide column with a quick lookup beside it, then the week ahead
// and what colleagues have done, all from the API.
export default function StaffDashboard() {
  const name = useAccountName().short
  const preview = usePreviewState()
  const { data, failed, reload } = useStaffDashboard()
  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : failed && !data ? 'error' : !data ? 'loading' : 'ready'
  const empty = state === 'empty'

  return (
    <StaffLayout activeHref="/secretary/dashboard">
      <p className="text-sm font-medium text-stone-600">
        {today.format(new Date())} · {parish.name}
      </p>
      <h1 className="mt-1 font-serif text-4xl font-semibold text-stone-900">
        {greeting()}, {name}.
      </h1>

      <StaffKpis
        state={state}
        data={empty && data ? { ...data, requests: [], events: [], parishioners: 0, registers: { Baptism: 0, Confirmation: 0, Marriage: 0, Burial: 0 } } : data}
        className="mt-6"
      />

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <RequestsCard preview={state} requests={empty ? [] : (data?.requests ?? [])} onRetry={reload} className="min-w-0 xl:col-span-8" />
        <AiSearchCard state={state} ai={data?.ai ?? null} className="xl:col-span-4" />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <EventsCard preview={state} events={empty ? [] : (data?.events ?? [])} onRetry={reload} className="min-w-0 xl:col-span-8" />
        <ActivityCard preview={state} items={empty ? [] : (data?.activity ?? [])} onRetry={reload} className="xl:col-span-4" />
      </div>
    </StaffLayout>
  )
}
