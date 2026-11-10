import { useSyncExternalStore } from 'react'
import { api } from '../../lib/api'
import { parish } from './sampleData'

// The office hours staff set in Settings (GET /api/public/parish). Loaded once
// per visit; until then, or if the server can't be reached, the usual hours show.

let current = parish.officeHours
let requested = false
const listeners = new Set<() => void>()

function load() {
  if (requested) return
  requested = true
  api<{ office_hours: string }>('/api/public/parish')
    .then((r) => r.office_hours && setOfficeHours(r.office_hours))
    .catch(() => {
      requested = false
    })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  load()
  return () => listeners.delete(listener)
}

/** The current office hours, for text built outside a component. */
export const officeHours = () => current

/** After staff save new hours, so every page shows them without a reload. */
export function setOfficeHours(hours: string) {
  current = hours
  listeners.forEach((l) => l())
}

export function useOfficeHours() {
  return useSyncExternalStore(subscribe, officeHours)
}
