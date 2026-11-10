import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../../../components/ui/Icon'
import type { UserAccount } from '../sampleData'

interface Props {
  user: UserAccount
  onEdit: () => void
  onResetPassword: () => void
  onToggleActive: () => void
}

interface Item {
  label: string
  icon: IconName
  danger?: boolean
  run: () => void
}

// Edit stays visible because it is the common action; the two that affect the
// person's ability to sign in sit one step away in the menu.
export function RowActions({ user, onEdit, onResetPassword, onToggleActive }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const name = `${user.firstName} ${user.lastName}`

  const items: Item[] = [
    { label: 'Send password reset link', icon: 'mail', run: onResetPassword },
    // Administrators can't lock themselves out from their own session.
    ...(user.current
      ? []
      : [
          user.active
            ? { label: 'Deactivate account', icon: 'userX' as const, danger: true, run: onToggleActive }
            : { label: 'Reactivate account', icon: 'userCheck' as const, run: onToggleActive },
        ]),
  ]

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const go = (n: number) => {
      e.preventDefault()
      buttons[(n + buttons.length) % buttons.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(buttons.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-forest-soft"
      >
        <Icon name="pencil" className="size-4" />
        Edit
      </button>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${name}`}
        onClick={() => setOpen((o) => !o)}
        className={`grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 ${open ? 'bg-stone-100 text-stone-900' : ''}`}
      >
        <Icon name="more" className="size-5" strokeWidth={2.5} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${name}`}
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-20 mt-1 w-60 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                // Focus the trigger first so the dialog this opens returns focus there.
                close()
                item.run()
              }}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium focus-visible:outline-offset-0 ${
                item.danger ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-stone-700 hover:bg-forest-soft focus:bg-forest-soft hover:text-forest'
              }`}
            >
              <Icon name={item.icon} className="size-4.5 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
