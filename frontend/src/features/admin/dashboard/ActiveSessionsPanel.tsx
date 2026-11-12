import { ErrorState, LoadingState } from '../../../components/ui/DataState'
import { Icon } from '../../../components/ui/Icon'
import { cardClass } from '../../../components/ui/styles'
import type { ActiveSession, Loaded } from './dashboardApi'
import { clockTime, relativeTime } from './time'

// Below md each row becomes a three-column block, so cells carry their own label.
const cellLabel = 'block text-xs text-stone-500 md:hidden'

export function ActiveSessionsPanel({ state, onRetry }: { state: Loaded<ActiveSession[]>; onRetry: () => void }) {
  const sessions = state.status === 'ready' ? state.data : []
  const people = new Set(sessions.map((s) => s.name)).size

  return (
    <section aria-labelledby="sessions-title" className={cardClass}>
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <h2 id="sessions-title" className="font-serif text-xl font-semibold text-stone-900">
          Active sessions
        </h2>
        {state.status === 'ready' && (
          <span className="text-sm font-semibold text-stone-600 tabular-nums">
            {people} signed in{sessions.length > people && ` · ${sessions.length} sessions`}
          </span>
        )}
      </header>

      {state.status === 'loading' ? (
        <LoadingState what="active sessions" variant="list" />
      ) : state.status === 'error' ? (
        <ErrorState what="active sessions" help="If it keeps happening, check the server and API logs." onRetry={onRetry} />
      ) : sessions.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-stone-600">
          Nobody is signed in right now. Secretary, clergy, and administrator sessions appear here while they are active.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-ivory/50 text-stone-600 max-md:sr-only">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Person
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Device
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                IP address
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Signed in
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Last active
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sessions.map((s) => (
              <tr key={s.id} className="max-md:grid max-md:grid-cols-3 max-md:gap-x-4 max-md:gap-y-2.5 max-md:px-5 max-md:py-4">
                <td className="md:px-5 md:py-3 max-md:col-span-3">
                  <span className="flex flex-wrap items-center gap-x-2 font-semibold text-stone-900">
                    {s.name}
                    {s.current && <span className="text-xs font-semibold text-forest">(you)</span>}
                  </span>
                  <span className="block text-stone-600">{s.role}</span>
                </td>
                <td className="md:px-3 md:py-3 max-md:col-span-3">
                  <span className={cellLabel}>Device</span>
                  <span className="flex items-center gap-2 text-stone-700">
                    <Icon name={s.device === 'phone' ? 'phone' : 'monitor'} className="size-4 shrink-0 text-stone-500" />
                    {s.client}
                  </span>
                </td>
                <td className="break-all text-stone-700 tabular-nums md:px-3 md:py-3">
                  <span className={cellLabel}>IP address</span>
                  {s.ip}
                </td>
                <td className="text-stone-700 md:px-3 md:py-3">
                  <span className={cellLabel}>Signed in</span>
                  {s.signedInAt ? clockTime(s.signedInAt) : <span className="text-stone-500">Unknown</span>}
                </td>
                <td className="text-stone-700 md:px-5 md:py-3">
                  <span className={cellLabel}>Last active</span>
                  {s.current ? 'Now' : relativeTime(s.lastActiveAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
