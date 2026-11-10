import { createContext, useContext } from 'react'

/** The public site has no sign-in; this only carries the confirmation toast its pages share. */
export interface PortalContextValue {
  toast: (message: string) => void
}

export const PortalContext = createContext<PortalContextValue | null>(null)

export function usePortal() {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortal must be used inside <PortalProvider>')
  return ctx
}
