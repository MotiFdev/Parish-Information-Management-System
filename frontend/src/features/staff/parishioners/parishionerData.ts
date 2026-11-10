// The staff directory's types and helpers. The directory itself comes from
// the API (parishionersApi.ts); backend/database/seeders/ParishionerDirectorySeeder.php
// seeds sample families for local use.

export type Sex = 'Female' | 'Male'

export interface Parishioner {
  id: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  /** '' when not recorded (people first written down from a register book). */
  sex: Sex | ''
  /** 'YYYY-MM-DD', or '' when not recorded. */
  dateOfBirth: string
  placeOfBirth: string
  contact: string
  email: string
  street: string
  barangay: string
  city: string
  sonaId: string
  chapelId: string
  fatherId: string | null
  motherId: string | null
  archived: boolean
  /** Register entries naming this person, oldest first. */
  sacraments?: ParishionerSacrament[]
}

export interface ParishionerSacrament {
  recordId: string
  type: 'Baptism' | 'Confirmation' | 'Marriage' | 'Burial'
  date: string | null
  role: 'Recipient' | 'Groom' | 'Bride'
  register: { book: number; page: number; line: number }
}

/** A Sona with its approved chapels; inactive chapels stay listed for people already assigned to them. */
export interface DirectorySona {
  id: string
  name: string
  chapels: Array<{ id: string; name: string; active: boolean }>
}

export const fullName = (p: Pick<Parishioner, 'firstName' | 'middleName' | 'lastName' | 'suffix'>) =>
  [p.firstName, p.middleName ? `${p.middleName[0]}.` : '', p.lastName, p.suffix].filter(Boolean).join(' ')

export const ageOn = (dob: string, today = new Date()): number => {
  if (!dob) return NaN
  const d = new Date(`${dob}T00:00:00`)
  let age = today.getFullYear() - d.getFullYear()
  if (today < new Date(today.getFullYear(), d.getMonth(), d.getDate())) age--
  return age
}

/** "Male · 41 years old", leaving out what isn't recorded. */
export const summary = (p: Pick<Parishioner, 'sex' | 'dateOfBirth'>) => {
  const age = ageOn(p.dateOfBirth)
  return [p.sex, Number.isNaN(age) ? 'birth date not recorded' : `${age} years old`].filter(Boolean).join(' · ')
}
export const bornLabel = (p: Pick<Parishioner, 'dateOfBirth'>) => (p.dateOfBirth ? `born ${p.dateOfBirth.slice(0, 4)}` : 'birth date not recorded')

export const sonaName = (all: DirectorySona[], id: string) => all.find((s) => s.id === id)?.name ?? ''
export const chapelName = (all: DirectorySona[], sonaId: string, chapelId: string) =>
  all.find((s) => s.id === sonaId)?.chapels.find((c) => c.id === chapelId)?.name ?? ''
