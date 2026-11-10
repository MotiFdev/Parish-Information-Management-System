import type { ReactNode } from 'react'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
}

// A modal panel on the right edge, full width on phones. Built on Dialog, so
// Escape, the backdrop, focus trapping, and focus return all come with it.
export function Drawer({ open, onClose, labelledBy, children }: Props) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy={labelledBy} className="m-0 ml-auto h-dvh max-h-none w-full max-w-2xl sm:w-[min(42rem,calc(100%-3rem))]">
      {children}
    </Dialog>
  )
}
