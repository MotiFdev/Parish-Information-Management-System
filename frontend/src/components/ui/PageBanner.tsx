import type { ReactNode } from 'react'
import { Link } from '../Link'
import { Icon } from './Icon'

interface Props {
  title: string
  description?: ReactNode
  back?: { href: string; label: string }
  actions?: ReactNode
}

// Continues the parchment of the nav bar so inner pages read as one surface
// with the header, the same way the Home hero does.
export function PageBanner({ title, description, back, actions }: Props) {
  return (
    <section className="border-b border-stone-300/50 bg-parchment">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="min-w-0">
          {back && (
            <Link href={back.href} className="mb-1 -ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-semibold text-forest hover:underline">
              <Icon name="arrowLeft" className="size-4" />
              {back.label}
            </Link>
          )}
          <h1 className="font-serif text-4xl leading-tight font-semibold text-forest sm:text-[2.75rem]">{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-stone-600">{description}</div>}
        </div>
        {actions}
      </div>
    </section>
  )
}
