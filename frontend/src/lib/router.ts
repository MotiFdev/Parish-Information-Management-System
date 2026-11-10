import { useSyncExternalStore } from 'react'

// A minimal history-API router for the design phase. Swap for React Router
// (or the framework's router) when the real route guards are added.

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

const getHref = () => window.location.pathname + window.location.search

/**
 * Scrolls to the element a "#section" points at, once the page has rendered.
 * Returns false when there is no such element.
 */
export function scrollToHash(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  if (!id) return false
  requestAnimationFrame(() => {
    const el = document.getElementById(id)
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  })
  return true
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  listeners.forEach((l) => l())
  // "/home#history" goes to that section; other links start at the top of the page.
  const hash = new URL(to, window.location.origin).hash
  if (hash) scrollToHash(hash)
  else if (!replace) window.scrollTo({ top: 0 })
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, getHref)
  const url = new URL(href, window.location.origin)
  return { pathname: url.pathname, query: url.searchParams }
}
