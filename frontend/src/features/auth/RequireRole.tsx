import { useEffect, type ReactNode } from 'react'
import { Link } from '../../components/Link'
import { LoadingState } from '../../components/ui/DataState'
import { btnPrimary } from '../../components/ui/styles'
import { navigate, useLocation } from '../../lib/router'
import { useAuth, type RoleSlug } from './authContext'

/**
 * Shows its children only to a signed-in user with one of `roles`. Visitors are
 * sent to the sign-in page and brought back afterwards. This only hides pages;
 * the API's role middleware is what actually protects the data.
 */
export function RequireRole({ roles, children }: { roles: RoleSlug[]; children: ReactNode }) {
  const { status, user } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    if (status !== 'signed-out') return
    const here = window.location.pathname + window.location.search
    navigate(`/login?next=${encodeURIComponent(here)}`, { replace: true })
  }, [status, pathname])

  if (status === 'loading' || status === 'signed-out')
    return (
      <div className="min-h-dvh bg-ivory">
        <LoadingState what="your account" variant="page" />
      </div>
    )

  if (!user?.role.slug || !roles.includes(user.role.slug))
    return (
      <main className="grid min-h-dvh place-items-center bg-ivory px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl font-semibold text-stone-900">You don’t have access to this page</h1>
          <p className="mt-2 text-stone-600">
            You are signed in as <span className="font-semibold text-stone-800">{user?.username}</span>
            {user?.role.name ? ` (${user.role.name})` : ''}. This part of the system is for other roles.
          </p>
          <Link href={user?.dashboard_path ?? '/home'} className={`${btnPrimary} mt-6`}>
            Go to your dashboard
          </Link>
        </div>
      </main>
    )

  return <>{children}</>
}
