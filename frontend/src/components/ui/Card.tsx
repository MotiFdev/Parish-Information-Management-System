import type { ReactNode } from 'react'
import { Link } from '../Link'
import { cardClass } from './styles'

interface Props {
  title: string
  action?: { label: string; href: string }
  className?: string
  /** Heading level for the title; use h3 when the card sits under a section heading. */
  level?: 'h2' | 'h3'
  children: ReactNode
}

export function Card({ title, action, className = '', level: Heading = 'h2', children }: Props) {
  return (
    <section className={`overflow-hidden ${cardClass} ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <Heading className="font-serif text-xl font-semibold text-stone-900">{title}</Heading>
        {action && (
          <Link href={action.href} className="-my-2 inline-flex min-h-11 items-center px-1 text-sm font-semibold text-forest hover:underline">
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}
