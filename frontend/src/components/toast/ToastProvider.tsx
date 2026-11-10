import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { ToastContext } from './toastContext'

// One toast region per portal; a new message replaces the last one.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const toast = useCallback((message: string) => {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 4500)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toastMessage && (
          <p className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-forest-dark px-4 py-3 text-sm font-medium text-white shadow-lg">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-gold" strokeWidth={2.5} />
            {toastMessage}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}
