import { parish } from '../../parishioner/sampleData'
import type { RegisterEntry } from '../../priest/registerData'
import type { Sacrament } from '../../priest/sampleData'

// Register entry fields per sacrament, from section 5 of the specification.
// Labels match the ones register entries already use, so an entry's details
// read the same in every portal and the form can be filled from them.

export interface FieldDef {
  label: string
  type: 'text' | 'date' | 'number' | 'select'
  group: string
  required?: boolean
  options?: string[]
  hint?: string
  default?: string
}

const church = parish.name

export const entryFields: Record<Sacrament, FieldDef[]> = {
  Baptism: [
    { label: 'Baptized', type: 'text', group: 'Baptized person', required: true, hint: 'Full name: first, middle, last.' },
    { label: 'Sex', type: 'select', group: 'Baptized person', required: true, options: ['Female', 'Male'] },
    { label: 'Date of birth', type: 'date', group: 'Baptized person', required: true },
    { label: 'Place of birth', type: 'text', group: 'Baptized person', required: true },
    { label: 'Date of baptism', type: 'date', group: 'Baptism', required: true },
    { label: 'Place of baptism', type: 'text', group: 'Baptism', required: true, default: church },
    { label: 'Minister', type: 'text', group: 'Baptism', required: true },
    { label: 'Father', type: 'text', group: 'Parents and godparents', required: true },
    { label: 'Mother', type: 'text', group: 'Parents and godparents', required: true, hint: 'Include her maiden name, e.g. Teresa Navarro (née Cruz).' },
    { label: 'Godparents', type: 'text', group: 'Parents and godparents', required: true, hint: 'Godfather and godmother, separated by a comma.' },
  ],
  Confirmation: [
    { label: 'Confirmed', type: 'text', group: 'Confirmed person', required: true, hint: 'Full name: first, middle, last.' },
    { label: 'Date of birth', type: 'date', group: 'Confirmed person', required: true },
    { label: 'Place of birth', type: 'text', group: 'Confirmed person', required: true },
    { label: 'Father', type: 'text', group: 'Confirmed person', required: true },
    { label: 'Mother', type: 'text', group: 'Confirmed person', required: true },
    { label: 'Date of confirmation', type: 'date', group: 'Confirmation', required: true },
    { label: 'Place of confirmation', type: 'text', group: 'Confirmation', required: true, default: church },
    { label: 'Minister', type: 'text', group: 'Confirmation', hint: 'Bishop or minister, if known.' },
    { label: 'Sponsor', type: 'text', group: 'Confirmation', required: true },
    { label: 'Baptismal parish', type: 'text', group: 'Baptism', required: true },
    { label: 'Date of baptism', type: 'date', group: 'Baptism' },
  ],
  Marriage: [
    { label: 'Groom', type: 'text', group: 'Groom', required: true },
    { label: "Groom's date of birth", type: 'date', group: 'Groom', required: true },
    { label: "Groom's place of birth", type: 'text', group: 'Groom', required: true },
    { label: "Groom's parents", type: 'text', group: 'Groom', required: true },
    { label: "Groom's baptismal parish", type: 'text', group: 'Groom', required: true },
    { label: 'Bride', type: 'text', group: 'Bride', required: true, hint: 'Include her maiden name, e.g. Teresa Garcia (née Navarro).' },
    { label: "Bride's date of birth", type: 'date', group: 'Bride', required: true },
    { label: "Bride's place of birth", type: 'text', group: 'Bride', required: true },
    { label: "Bride's parents", type: 'text', group: 'Bride', required: true },
    { label: "Bride's baptismal parish", type: 'text', group: 'Bride', required: true },
    { label: 'Date of marriage', type: 'date', group: 'Marriage', required: true },
    { label: 'Place of marriage', type: 'text', group: 'Marriage', required: true, default: church },
    { label: 'Presiding priest', type: 'text', group: 'Marriage', required: true },
    { label: 'Marriage license no.', type: 'text', group: 'Marriage', required: true },
    { label: 'Civil marriage date', type: 'date', group: 'Marriage' },
    { label: 'Civil marriage place', type: 'text', group: 'Marriage' },
    { label: 'Witnesses', type: 'text', group: 'Marriage', required: true, hint: 'Witnesses or sponsors, separated by commas.' },
  ],
  Burial: [
    { label: 'Deceased', type: 'text', group: 'Deceased', required: true },
    { label: 'Sex', type: 'select', group: 'Deceased', required: true, options: ['Female', 'Male'] },
    { label: 'Date of birth', type: 'date', group: 'Deceased', hint: 'If known.' },
    { label: 'Date of death', type: 'date', group: 'Deceased', required: true },
    { label: 'Age at death', type: 'number', group: 'Deceased', required: true },
    { label: 'Place of death', type: 'text', group: 'Deceased', required: true },
    { label: 'Cause of death', type: 'text', group: 'Deceased', hint: 'Only if the parish requires it.' },
    { label: 'Civil status', type: 'select', group: 'Deceased', required: true, options: ['Single', 'Married', 'Widowed', 'Separated'] },
    { label: 'Spouse', type: 'text', group: 'Deceased' },
    { label: 'Parents', type: 'text', group: 'Deceased', hint: 'If known.' },
    { label: 'Funeral Mass', type: 'date', group: 'Funeral and burial', required: true },
    { label: 'Date of burial', type: 'date', group: 'Funeral and burial', required: true },
    { label: 'Place of burial', type: 'text', group: 'Funeral and burial', required: true },
    { label: 'Church', type: 'text', group: 'Funeral and burial', required: true, default: church },
    { label: 'Officiating priest', type: 'text', group: 'Funeral and burial', required: true },
    // The specification asks for the informant to be stored apart from the deceased.
    { label: 'Informant', type: 'text', group: 'Informant', required: true },
    { label: 'Informant relationship', type: 'text', group: 'Informant', required: true },
    { label: 'Informant contact', type: 'text', group: 'Informant', required: true },
    { label: 'Informant address', type: 'text', group: 'Informant', required: true },
  ],
}

const toIso = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type FieldValues = Record<string, string>

/** How the API names a field: "Groom's date of birth" is groom_s_date_of_birth (SacramentalRegister::slug). */
export const fieldKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Form values (keyed by label) as the API takes them (keyed by fieldKey). */
export const toApiValues = (type: Sacrament, v: FieldValues) => Object.fromEntries(entryFields[type].map((f) => [fieldKey(f.label), v[f.label]?.trim() ?? '']))

/** Fill the form from an entry; dates come back as YYYY-MM-DD for the date inputs. */
export function valuesFrom(type: Sacrament, e?: RegisterEntry): FieldValues {
  const out: FieldValues = {}
  if (e?.values) {
    for (const f of entryFields[type]) out[f.label] = e.values[fieldKey(f.label)] ?? ''
    return out
  }
  for (const f of entryFields[type]) {
    const v = e?.details.find(([k]) => k === f.label)?.[1] ?? (e ? '' : (f.default ?? ''))
    out[f.label] = f.type === 'date' && v ? toIso(v) : v
  }
  if (e && type === 'Burial' && !out['Date of burial']) out['Date of burial'] = e.date
  return out
}
