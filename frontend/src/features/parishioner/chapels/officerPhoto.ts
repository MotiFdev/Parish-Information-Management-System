import type { Officer } from '../../community/chapels/chapelsData'

// Placeholder portraits from randomuser.me until officers have real photos on
// file. The backend can later send `photo` on each officer; when it does, that
// URL wins and these stand-ins are no longer used.

const FEMALE = new Set([
  'rosario', 'marites', 'imelda', 'luzviminda', 'josefina', 'cecilia', 'gloria', 'analyn', 'rowena', 'nenita', 'jocelyn', 'maricar',
  'carmen', 'teresa', 'lorna', 'maria',
])

function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** Same officer, same face on every visit: the portrait is picked from the officer's id. */
export function placeholderPhoto(o: Pick<Officer, 'id' | 'name'>) {
  const firstName = o.name.split(' ')[0]?.toLowerCase() ?? ''
  const group = FEMALE.has(firstName) ? 'women' : 'men'
  return `https://randomuser.me/api/portraits/${group}/${hash(o.id) % 100}.jpg`
}

export const officerPhoto = (o: Officer) => o.photo || placeholderPhoto(o)

export const initials = (name: string) =>
  name
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
