import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  labelledBy: string
  /** Positioning and size of the panel; defaults to a centered modal. */
  className?: string
  children: ReactNode
}

// Built on the native <dialog>: showModal() gives the focus trap, Escape to
// close, inert page content, and focus return without extra code.
export function Dialog({
  open,
  onClose,
  labelledBy,
  className = 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl',
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // The panel content fills the dialog box, so a click that lands on the
      // dialog element itself came from the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`bg-white p-0 text-stone-800 shadow-xl backdrop:bg-stone-900/50 ${className}`}
    >
      {open && children}
    </dialog>
  )
}
