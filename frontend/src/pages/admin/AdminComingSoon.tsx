import { Link } from '../../components/Link'
import { btnSecondary, cardClass } from '../../components/ui/styles'
import { adminNavItems } from '../../features/admin/nav'
import { AdminLayout } from '../../layouts/AdminLayout'

// What each page will hold, from section 4.1 of the specification.
const plans: Record<string, string> = {
}

export default function AdminComingSoon({ href }: { href: string }) {
  const item = adminNavItems.find((i) => i.href === href)
  const plan = plans[href]

  return (
    <AdminLayout activeHref={item ? href : ''}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">{item?.label ?? 'Page not found'}</h1>
      <div className={`${cardClass} mt-6 max-w-2xl px-6 py-6`}>
        {plan ? (
          <>
            <p className="font-semibold text-stone-800">This page has not been designed yet.</p>
            <p className="mt-2 leading-relaxed text-stone-700">It will hold {plan.charAt(0).toLowerCase() + plan.slice(1)}</p>
          </>
        ) : (
          <p className="text-stone-700">There is no administration page at this address.</p>
        )}
        <Link href="/admin/dashboard" className={`${btnSecondary} mt-5`}>
          Back to Dashboard
        </Link>
      </div>
    </AdminLayout>
  )
}
