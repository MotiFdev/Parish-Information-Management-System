export type ReferenceKind = 'record-request' | 'appointment'

/** The characters references use: no 0, 1, I, or O. Matches App\Support\ReferenceNumber. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const kinds: Record<string, ReferenceKind> = { RR: 'record-request', AP: 'appointment' }

/**
 * Reads a reference the way people type it ("rr 7k3m 9qx2", "RR7K3M9QX2") and
 * returns it as the parish prints it ("RR-7K3M-9QX2"), or null when it can't be one.
 */
export function parseReference(input: string): { kind: ReferenceKind; reference: string } | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const prefix = compact.slice(0, 2)
  const rest = compact.slice(2)
  const kind = kinds[prefix]
  if (!kind || rest.length !== 8 || [...rest].some((c) => !ALPHABET.includes(c))) return null
  return { kind, reference: `${prefix}-${rest.slice(0, 4)}-${rest.slice(4)}` }
}

export const trackHref = (reference: string) => `/track/${reference}`
