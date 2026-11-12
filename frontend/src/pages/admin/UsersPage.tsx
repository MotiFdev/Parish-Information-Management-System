import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { Pagination } from '../../components/ui/Pagination'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { useToast } from '../../components/toast/toastContext'
import { roles, type Role, type UserAccount } from '../../features/admin/sampleData'
import { UserFormDialog } from '../../features/admin/UserFormDialog'
import { RowActions } from '../../features/admin/users/RowActions'
import { createUser, listUsers, roleSlugs, sendPasswordReset, setActive, updateUser, type UserPage } from '../../features/admin/users/usersApi'
import { AdminLayout } from '../../layouts/AdminLayout'
import { ApiError } from '../../lib/api'

const PAGE_SIZE = 10

type Pending =
  | { kind: 'add' }
  | { kind: 'edit' | 'reset' | 'deactivate'; user: UserAccount }
  | null

const fullName = (u: UserAccount) => `${u.firstName} ${u.lastName}`.trim()
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')

// Below xl each row becomes a block (two columns on phones, four on tablets), so cells carry their own label.
const cellLabel = 'block text-xs text-stone-500 xl:hidden'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        active ? 'bg-forest-soft text-forest' : 'bg-stone-200 text-stone-700'
      }`}
    >
      {active ? 'Active' : 'Deactivated'}
    </span>
  )
}

/** Waits until typing pauses before searching, so each keystroke is not a request. */
function useDebounced<T>(value: T, ms = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return settled
}

export default function UsersPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<Role | 'All'>('All')
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<UserPage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const search = useDebounced(query.trim())

  useEffect(() => {
    let cancelled = false
    listUsers({ search, role, page, perPage: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return
        // A deactivation or filter change can leave the current page empty; step back to the last one.
        const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1)
        if (page > lastPage) return setPage(lastPage)
        setLoadError(null)
        setData(result)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(messageOf(e))
      })
    return () => {
      cancelled = true
    }
  }, [search, role, page, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const rows = data?.rows ?? []
  const total = data?.summary.total ?? 0
  const deactivated = data?.summary.deactivated ?? 0
  const counts = data?.counts

  const clearFilters = () => {
    setQuery('')
    setRole('All')
    setPage(0)
  }

  /** Runs a row action with the dialog's button disabled, then refreshes the table. */
  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    try {
      toast(await action())
      setPending(null)
      reload()
    } catch (e) {
      toast(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = (u: UserAccount) => {
    if (u.active) return setPending({ kind: 'deactivate', user: u })
    void run(async () => {
      await setActive(u.id, true)
      return `${fullName(u)} can sign in again.`
    })
  }

  return (
    <AdminLayout activeHref="/admin/users">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-stone-900">User Management</h1>
          {data && (
            <p className="mt-1 text-stone-600">
              {total} {total === 1 ? 'account' : 'accounts'}
              {deactivated > 0 && ` · ${deactivated} deactivated`}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setPending({ kind: 'add' })} className={`${btnPrimary} shrink-0`}>
          <Icon name="userPlus" className="size-4.5" />
          Add user
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-md">
          <label htmlFor="user-search" className="sr-only">
            Search accounts
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
          <input
            id="user-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search by name, username, or email"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor="role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="role-filter"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | 'All')
              setPage(0)
            }}
            className={inputClass}
          >
            {/* Counts follow the search, so each option says what choosing it would show. */}
            {(['All', ...roles] as const).map((r) => (
              <option key={r} value={r}>
                {r === 'All' ? 'All roles' : r}
                {counts ? ` (${counts[r === 'All' ? 'all' : roleSlugs[r]]})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section aria-labelledby="accounts-title" className={`${cardClass} mt-4`}>
        <h2 id="accounts-title" className="sr-only">
          Accounts
        </h2>

        {loadError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <Icon name="alert" className="size-6 text-red-700" />
            <p className="max-w-sm text-stone-700">We couldn’t load the accounts. {loadError}</p>
            <button type="button" onClick={reload} className={btnSecondary}>
              Try again
            </button>
          </div>
        ) : !data ? (
          <LoadingState what="accounts" variant="table" />
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Icon name="users" className="size-7 text-forest" />
            <p className="font-semibold text-stone-800">No accounts yet</p>
            <p className="max-w-sm text-sm text-stone-600">
              Start with the parish priest and the secretary so they can sign in. Parishioners don’t need accounts: they send
              requests from the public site and track them by reference number.
            </p>
            <button type="button" onClick={() => setPending({ kind: 'add' })} className={`${btnSecondary} mt-1`}>
              <Icon name="userPlus" className="size-4.5" />
              Add the first user
            </button>
          </div>
        ) : data.total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="font-semibold text-stone-800">
              No accounts match
              {search && <> “{search}”</>}
              {role !== 'All' && <> among {role} accounts</>}
            </p>
            <p className="text-sm text-stone-600">Check the spelling, or search by username or email instead.</p>
            <button type="button" onClick={clearFilters} className={`${btnSecondary} mt-1`}>
              Clear search and filter
            </button>
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-600 max-xl:sr-only">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Last sign-in
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((u) => (
                  <tr key={u.id} className="max-xl:grid max-xl:grid-cols-2 sm:max-xl:grid-cols-4 max-xl:gap-x-4 max-xl:gap-y-2.5 max-xl:px-5 max-xl:py-4">
                    <td className="xl:px-5 xl:py-2.5 max-xl:col-span-2">
                      <span className="flex flex-wrap items-baseline gap-x-2 font-semibold text-stone-900">
                        {fullName(u)}
                        {u.current && <span className="text-xs font-semibold text-forest">(you)</span>}
                      </span>
                      <span className="block text-stone-600">@{u.username}</span>
                    </td>
                    <td className="break-all text-stone-700 xl:px-3 xl:py-2.5 max-xl:col-span-2">
                      <span className={cellLabel}>Email</span>
                      {u.email}
                    </td>
                    <td className="text-stone-700 xl:px-3 xl:py-2.5">
                      <span className={cellLabel}>Role</span>
                      {u.role}
                    </td>
                    <td className="xl:px-3 xl:py-2.5">
                      <span className={cellLabel}>Status</span>
                      <StatusBadge active={u.active} />
                    </td>
                    <td className="text-stone-700 xl:px-3 xl:py-2.5">
                      <span className={cellLabel}>Last sign-in</span>
                      {u.lastLogin ?? <span className="text-stone-500">Never</span>}
                    </td>
                    <td className="self-end xl:px-5 xl:py-1.5">
                      <div className="flex justify-end">
                        <RowActions
                          user={u}
                          onEdit={() => setPending({ kind: 'edit', user: u })}
                          onResetPassword={() => setPending({ kind: 'reset', user: u })}
                          onToggleActive={() => toggleActive(u)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} noun={['account', 'accounts']} />
          </>
        )}
      </section>

      <UserFormDialog
        open={pending?.kind === 'add' || pending?.kind === 'edit'}
        onClose={() => setPending(null)}
        user={pending?.kind === 'edit' ? pending.user : undefined}
        existing={rows}
        onSave={async (values) => {
          const name = `${values.firstName} ${values.lastName}`
          if (pending?.kind === 'edit') {
            await updateUser(pending.user.id, values)
            toast(`Saved changes to ${name}.`)
          } else {
            const { inviteSent } = await createUser(values)
            toast(
              inviteSent
                ? `Account created for ${name}. A link to set a password was sent to ${values.email}.`
                : `Account created for ${name}, but the email could not be sent. Use “Send password reset link” to try again.`,
            )
          }
          setPending(null)
          reload()
        }}
      />

      <ConfirmDialog
        open={pending?.kind === 'reset'}
        onClose={() => !busy && setPending(null)}
        title="Send a password reset link?"
        confirmLabel="Send reset link"
        busy={busy}
        busyLabel="Sending…"
        onConfirm={() => {
          if (pending?.kind !== 'reset') return
          const { user } = pending
          void run(async () => {
            await sendPasswordReset(user.id)
            return `Reset link sent to ${user.email}.`
          })
        }}
      >
        {pending?.kind === 'reset' && (
          <p>
            {fullName(pending.user)} gets an email at <span className="font-semibold break-all">{pending.user.email}</span> with a
            link to choose a new password. Their current password keeps working until they do.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'deactivate'}
        onClose={() => !busy && setPending(null)}
        title="Deactivate this account?"
        confirmLabel="Deactivate account"
        tone="danger"
        busy={busy}
        busyLabel="Deactivating…"
        onConfirm={() => {
          if (pending?.kind !== 'deactivate') return
          const { user } = pending
          void run(async () => {
            await setActive(user.id, false)
            return `${fullName(user)} can no longer sign in.`
          })
        }}
      >
        {pending?.kind === 'deactivate' && (
          <>
            <p>
              <span className="font-semibold">{fullName(pending.user)}</span> ({pending.user.role}) is signed out everywhere and
              will not be able to sign in until an administrator reactivates the account.
            </p>
            <p className="text-sm text-stone-600">Their records, requests, and history stay as they are.</p>
          </>
        )}
      </ConfirmDialog>
    </AdminLayout>
  )
}
