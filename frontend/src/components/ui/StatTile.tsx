import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { cardClass } from './styles'

interface Props {
  icon: IconName
  label: string
  value: string
  note: ReactNode
  /** Optional extra (a sparkline, a breakdown, a link) pinned to the bottom so a row of tiles lines up. */
  children?: ReactNode
}

// One headline figure. Used in rows of four across the top of dashboard-style pages.
export function StatTile({ icon, label, value, note, children }: Props) {
  return (
    <div className={`${cardClass} flex flex-col px-5 py-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-forest-soft text-forest" aria-hidden="true">
          <Icon name={icon} className="size-4.5" />
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold break-words text-stone-900">{value}</p>
      <div className="mt-0.5 text-sm text-stone-600">{note}</div>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  )
}
