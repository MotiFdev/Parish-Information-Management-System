import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/ui/Icon'
import { PortalContext, type PortalContextValue } from './portalContext'

export function PortalProvider({ children }: { children: ReactNode }) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const toast = useCallback((message: string) => {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 3500)
  }, [])

  const value = useMemo<PortalContextValue>(() => ({ toast }), [toast])

  return (
    <PortalContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toastMessage && (
          <p className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-forest-dark px-4 py-3 text-sm font-medium text-white shadow-lg">
            <Icon name="check" className="size-4 text-gold" strokeWidth={2.5} />
            {toastMessage}
          </p>
        )}
      </div>
    </PortalContext.Provider>
  )
}
