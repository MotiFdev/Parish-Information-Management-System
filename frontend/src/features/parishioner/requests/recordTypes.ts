import type { IconName } from '../../../components/ui/Icon'
import type { RecordType, RequestType } from '../sampleData'

export const recordTypes: Array<{ type: RecordType; slug: string; icon: IconName; blurb: string }> = [
  { type: 'Baptism', slug: 'baptism', icon: 'drop', blurb: 'Baptismal certificates, registration, or corrections' },
  { type: 'Confirmation', slug: 'confirmation', icon: 'flame', blurb: 'Confirmation certificates and register entries' },
  { type: 'Marriage', slug: 'marriage', icon: 'rings', blurb: 'Marriage certificates for church weddings' },
  { type: 'Burial', slug: 'burial', icon: 'cross', blurb: 'Funeral and burial records of the deceased' },
]

export const requestTypes: Array<{ type: RequestType; blurb: string }> = [
  {
    type: 'Certificate Request',
    blurb: 'Get a certificate from an entry already in the parish register.',
  },
  {
    type: 'New Registration',
    blurb: 'Record a sacrament that is not yet in the register. The secretary verifies it before an entry is created.',
  },
  {
    type: 'Record Correction',
    blurb: 'Flag an error in an existing entry. The secretary applies the change once the parish priest approves it.',
  },
]

export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'date' | 'email' | 'tel' | 'number' | 'select' | 'textarea'
  options?: string[]
  /** Required for every request type (the details staff need to find an existing entry). */
  key?: boolean
  /** Never required. */
  optional?: boolean
  wide?: boolean
  hint?: string
}

export interface FieldGroup {
  title: string
  fields: FieldDef[]
}

const sex = ['Male', 'Female']

export const recordForms: Record<RecordType, FieldGroup[]> = {
  Baptism: [
    {
      title: 'Person baptized',
      fields: [
        { name: 'fullName', label: 'Full name', key: true, wide: true },
        { name: 'birthDate', label: 'Date of birth', type: 'date', key: true },
        { name: 'birthPlace', label: 'Place of birth' },
        { name: 'sex', label: 'Sex', type: 'select', options: sex },
      ],
    },
    {
      title: 'Baptism',
      fields: [
        { name: 'baptismDate', label: 'Date of baptism', key: true, hint: 'Exact or approximate, e.g. “April 1995”' },
        { name: 'baptismChurch', label: 'Place / church of baptism', key: true },
      ],
    },
    {
      title: 'Parents and godparents',
      fields: [
        { name: 'father', label: 'Father’s full name', key: true },
        { name: 'mother', label: 'Mother’s full name (with maiden name)', key: true },
        { name: 'godfather', label: 'Godfather' },
        { name: 'godmother', label: 'Godmother' },
      ],
    },
  ],
  Confirmation: [
    {
      title: 'Person confirmed',
      fields: [
        { name: 'fullName', label: 'Full name', key: true, wide: true },
        { name: 'birthDate', label: 'Date of birth', type: 'date', key: true },
        { name: 'birthPlace', label: 'Place of birth' },
        { name: 'father', label: 'Father’s full name' },
        { name: 'mother', label: 'Mother’s full name' },
      ],
    },
    {
      title: 'Confirmation',
      fields: [
        { name: 'confirmationDate', label: 'Date of confirmation', key: true, hint: 'Exact or approximate' },
        { name: 'confirmationPlace', label: 'Place of confirmation', key: true },
        { name: 'minister', label: 'Bishop or minister', optional: true, hint: 'If known' },
        { name: 'sponsor', label: 'Sponsor' },
      ],
    },
    {
      title: 'Baptism',
      fields: [
        { name: 'baptismParish', label: 'Baptismal parish' },
        { name: 'baptismDate', label: 'Date of baptism' },
      ],
    },
  ],
  Marriage: [
    {
      title: 'Groom',
      fields: [
        { name: 'groomName', label: 'Full name', key: true, wide: true },
        { name: 'groomBirthDate', label: 'Date of birth', type: 'date' },
        { name: 'groomBirthPlace', label: 'Place of birth' },
        { name: 'groomFather', label: 'Father’s full name' },
        { name: 'groomMother', label: 'Mother’s full name' },
        { name: 'groomBaptismParish', label: 'Baptismal parish', wide: true },
      ],
    },
    {
      title: 'Bride',
      fields: [
        { name: 'brideName', label: 'Full name (with maiden name)', key: true, wide: true },
        { name: 'brideBirthDate', label: 'Date of birth', type: 'date' },
        { name: 'brideBirthPlace', label: 'Place of birth' },
        { name: 'brideFather', label: 'Father’s full name' },
        { name: 'brideMother', label: 'Mother’s full name' },
        { name: 'brideBaptismParish', label: 'Baptismal parish', wide: true },
      ],
    },
    {
      title: 'Marriage',
      fields: [
        { name: 'marriageDate', label: 'Date of marriage', type: 'date', key: true },
        { name: 'marriagePlace', label: 'Church / place of marriage', key: true },
        { name: 'presidingPriest', label: 'Presiding priest' },
        { name: 'licenseNumber', label: 'Marriage license number' },
        { name: 'civilDetails', label: 'Civil marriage details', type: 'textarea', optional: true, wide: true },
        { name: 'witnesses', label: 'Witnesses or sponsors', type: 'textarea', wide: true },
      ],
    },
  ],
  Burial: [
    {
      title: 'Deceased',
      fields: [
        { name: 'deceasedName', label: 'Full name of deceased', key: true, wide: true },
        { name: 'birthDate', label: 'Date of birth', type: 'date', optional: true, hint: 'If known' },
        { name: 'deathDate', label: 'Date of death', type: 'date', key: true },
        { name: 'ageAtDeath', label: 'Age at death', type: 'number' },
        { name: 'sex', label: 'Sex', type: 'select', options: sex },
        { name: 'deathPlace', label: 'Place of death' },
        { name: 'causeOfDeath', label: 'Cause of death', optional: true, hint: 'Only if the parish requires it' },
        { name: 'civilStatus', label: 'Civil status', type: 'select', options: ['Single', 'Married', 'Widowed', 'Separated'] },
        { name: 'spouse', label: 'Spouse’s name', optional: true },
        { name: 'parents', label: 'Parents’ names', optional: true, hint: 'If known', wide: true },
      ],
    },
    {
      title: 'Funeral and burial',
      fields: [
        { name: 'funeralMassDate', label: 'Date of funeral Mass', type: 'date' },
        { name: 'burialDate', label: 'Date of burial', type: 'date', key: true },
        { name: 'burialPlace', label: 'Place of burial' },
        { name: 'funeralChurch', label: 'Church that conducted the funeral', key: true },
        { name: 'officiatingPriest', label: 'Officiating priest', wide: true },
      ],
    },
    {
      title: 'Informant',
      fields: [
        { name: 'informantName', label: 'Full name', key: true },
        { name: 'informantRelationship', label: 'Relationship to deceased', key: true },
        { name: 'informantContact', label: 'Contact number', type: 'tel', key: true },
        { name: 'informantAddress', label: 'Address', key: true },
      ],
    },
  ],
}

export const correctionGroup: FieldGroup = {
  title: 'Correction',
  fields: [
    { name: 'correctionField', label: 'Entry to correct', key: true, hint: 'e.g. “Mother’s maiden name”' },
    { name: 'currentValue', label: 'As currently recorded', key: true },
    { name: 'correctValue', label: 'Correct value', key: true },
    { name: 'correctionReason', label: 'Reason for the correction', type: 'textarea', optional: true, wide: true },
  ],
}

export interface DocumentDef {
  id: string
  label: string
  required?: boolean
}

export const recordDocuments: Record<RecordType, DocumentDef[]> = {
  Baptism: [
    { id: 'birthCert', label: 'PSA birth certificate', required: true },
    { id: 'requesterId', label: 'Valid ID of requester' },
  ],
  Confirmation: [
    { id: 'baptismalCert', label: 'Baptismal certificate', required: true },
    { id: 'requesterId', label: 'Valid ID of requester' },
  ],
  Marriage: [
    { id: 'spouseIds', label: 'Valid IDs of both spouses', required: true },
    { id: 'civilCert', label: 'PSA marriage certificate (if civilly married)' },
  ],
  Burial: [
    { id: 'deathCert', label: 'Death certificate', required: true },
    { id: 'burialPermit', label: 'Burial permit', required: true },
    { id: 'informantId', label: 'Valid ID of informant' },
  ],
}

export const correctionDocument: DocumentDef = {
  id: 'proof',
  label: 'Document showing the correct entry',
  required: true,
}
