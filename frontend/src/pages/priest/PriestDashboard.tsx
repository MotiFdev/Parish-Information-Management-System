import { useApprovalQueue } from '../../features/priest/approvals/approvalsApi'
import { ApprovalQueueCard } from '../../features/priest/dashboard/ApprovalQueueCard'
import { usePriestDashboard } from '../../features/priest/dashboard/dashboardApi'
import { KpiTiles } from '../../features/priest/dashboard/KpiTiles'
import { SacramentTrends } from '../../features/priest/dashboard/SacramentTrends'
import { parish } from '../../features/parishioner/sampleData'
import { useAccountName } from '../../features/auth/useAccountName'
import { PriestLayout } from '../../layouts/PriestLayout'
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

// Standard dashboard order: headline figures across the top, the main chart in
// the wide column, and the to-do list beside it. Figures and trends come from
// /api/priest/dashboard; the to-do list is the Certificate Approvals queue.
export default function PriestDashboard() {
  const name = useAccountName().short
  const preview = usePreviewState()
  const { data, failed, reload } = usePriestDashboard()
  const queue = useApprovalQueue()

  // The design preview switch (?preview=) still overrides what the server returned.
  const state = preview !== 'ready' ? preview : failed && !data ? 'error' : !data ? 'loading' : 'ready'
  const queueState = preview !== 'ready' ? preview : queue.failed && !queue.items ? 'error' : !queue.items ? 'loading' : 'ready'
  const empty = preview === 'empty'
  const requests = empty ? [] : queue.items

  const shown =
    empty && data
      ? {
          ...data,
          parishioners: 0,
          trend: { Baptism: [], Confirmation: [], Marriage: [], Burial: [] },
          this_year: { Baptism: 0, Confirmation: 0, Marriage: 0, Burial: 0 },
          mass_bookings: data.mass_bookings.map(() => 0),
          corrections_waiting: { Baptism: 0, Confirmation: 0, Marriage: 0, Burial: 0 },
        }
      : data

  return (
    <PriestLayout activeHref="/priest/dashboard">
      <p className="text-sm font-medium text-stone-600">
        {today.format(new Date())} · {parish.name}
      </p>
      <h1 className="mt-1 font-serif text-4xl font-semibold text-stone-900">
        {greeting()}, {name}.
      </h1>

      <KpiTiles state={state} data={shown} requests={requests} className="mt-6" />

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <SacramentTrends state={state} months={shown?.months ?? []} trend={shown?.trend ?? null} onRetry={reload} />
        </div>
        {/* Below xl the columns stack; the to-do list moves above the charts so it is not buried. */}
        <ApprovalQueueCard preview={queueState} requests={requests ?? []} onRetry={queue.reload} className="max-xl:-order-1 xl:col-span-4" />
      </div>
    </PriestLayout>
  )
}
