// Shared sacrament names and the approval-request shape. awaitingApproval is
// placeholder content from the design phase that the staff requests sample list
// still uses; nothing here reflects real parish records.

export type Sacrament = 'Baptism' | 'Confirmation' | 'Marriage' | 'Burial'
export const sacraments: Sacrament[] = ['Baptism', 'Confirmation', 'Marriage', 'Burial']
export const sacramentPlural: Record<Sacrament, string> = {
  Baptism: 'Baptisms',
  Confirmation: 'Confirmations',
  Marriage: 'Marriages',
  Burial: 'Burials',
}

/** New registrations also reach the priest: they are approved before staff write them in the register. */
export type RequestType = 'Certificate Request' | 'Record Correction' | 'New Registration'

export interface AwaitingRequest {
  /** request_id from the API; sample requests use their number. */
  id?: string
  number: string
  recordType: Sacrament
  requestType: RequestType
  /** Who the record is about (the baptized person, the couple, the deceased). */
  subject: string
  client: { name: string; relationship: string }
  purpose: string
  /** ISO timestamps with the parish's UTC+8 offset. */
  submittedAt: string
  verifiedAt: string
  verifiedBy: string
  /** Book, page, and line staff matched in the register. A New Registration has none until it is written in. */
  register?: { book: number | string; page: number | string; line: number | string }
  /** Every document here was marked Verified by staff before the request reached the priest. */
  documents: { label: string; file: string; note?: string; /** The stored file, for a signed link; sample data has none. */ documentId?: string }[]
  remarks: string
  /** The register entry as staff read it. */
  details: [label: string, value: string][]
  /** For corrections: each field staff propose to change. */
  corrections?: { field: string; from: string; to: string }[]
}

export const awaitingApproval: AwaitingRequest[] = [
  {
    number: 'REQ-2026-0130',
    recordType: 'Burial',
    requestType: 'Certificate Request',
    subject: 'Ernesto Villanueva',
    client: { name: 'Ramon Villanueva', relationship: 'Child' },
    purpose: 'Legal purpose',
    submittedAt: '2026-10-24T11:12:00+08:00',
    verifiedAt: '2026-10-27T15:20:00+08:00',
    verifiedBy: 'Grace Domingo',
    register: { book: 4, page: 88, line: 2 },
    documents: [
      { label: 'Valid ID', file: 'ramon-villanueva-id.jpg' },
      { label: 'Death Certificate', file: 'death-certificate-e-villanueva.pdf' },
    ],
    remarks: 'Entry matches the death certificate. Requested for an estate settlement.',
    details: [
      ['Deceased', 'Ernesto Villanueva'],
      ['Date of death', 'August 14, 2019'],
      ['Age at death', '78'],
      ['Funeral Mass', 'August 17, 2019'],
      ['Place of burial', 'Municipal Cemetery'],
      ['Officiating priest', 'Fr. Miguel Torres'],
    ],
  },
  {
    number: 'REQ-2026-0136',
    recordType: 'Baptism',
    requestType: 'Record Correction',
    subject: 'Andrea Lim',
    client: { name: 'Andrea Lim', relationship: 'Self' },
    purpose: 'Marriage requirement',
    submittedAt: '2026-10-26T09:30:00+08:00',
    verifiedAt: '2026-10-29T10:05:00+08:00',
    verifiedBy: 'Liza Mercado',
    register: { book: 14, page: 9, line: 4 },
    documents: [
      { label: 'Valid ID', file: 'andrea-lim-id.jpg' },
      { label: 'Birth Certificate', file: 'psa-birth-certificate-a-lim.pdf', note: "Shows the mother's maiden name as Gonzaga." },
    ],
    remarks: "The register spells the mother's maiden name Gonzales; the PSA birth certificate says Gonzaga.",
    details: [
      ['Baptized', 'Andrea Lim'],
      ['Date of birth', 'February 3, 1996'],
      ['Date of baptism', 'March 10, 1996'],
      ['Father', 'Roberto Lim'],
      ['Mother', 'Elena Lim (née Gonzales)'],
      ['Godparents', 'Victor Tan, Maria Uy'],
    ],
    corrections: [{ field: "Mother's maiden name", from: 'Gonzales', to: 'Gonzaga' }],
  },
  {
    number: 'REQ-2026-0139',
    recordType: 'Marriage',
    requestType: 'Certificate Request',
    subject: 'Paolo & Teresa Garcia',
    client: { name: 'Teresa Garcia', relationship: 'Spouse' },
    purpose: 'Legal purpose',
    submittedAt: '2026-10-28T16:45:00+08:00',
    verifiedAt: '2026-10-30T14:40:00+08:00',
    verifiedBy: 'Joel Bautista',
    register: { book: 7, page: 23, line: 5 },
    documents: [
      { label: 'Valid ID', file: 'paolo-garcia-id.jpg' },
      { label: 'Valid ID', file: 'teresa-garcia-id.jpg' },
      { label: 'Other', file: 'psa-marriage-contract.pdf', note: 'PSA marriage contract' },
    ],
    remarks: 'Names and date match the PSA marriage contract.',
    details: [
      ['Groom', 'Paolo Garcia'],
      ['Bride', 'Teresa Garcia (née Navarro)'],
      ['Date of marriage', 'June 12, 2015'],
      ['Presiding priest', 'Fr. Antonio Reyes'],
      ['Marriage license no.', '2015-0612-118'],
      ['Witnesses', 'Dennis Lopez, Jocelyn Pascual'],
    ],
  },
  {
    number: 'REQ-2026-0141',
    recordType: 'Confirmation',
    requestType: 'Certificate Request',
    subject: 'Miguel Santos',
    client: { name: 'Miguel Santos', relationship: 'Self' },
    purpose: 'Marriage requirement',
    submittedAt: '2026-10-29T13:05:00+08:00',
    verifiedAt: '2026-10-31T08:55:00+08:00',
    verifiedBy: 'Liza Mercado',
    register: { book: 3, page: 140, line: 9 },
    documents: [{ label: 'Baptismal Certificate', file: 'baptismal-certificate-m-santos.pdf' }],
    remarks: 'Entry found under the 2008 confirmation batch.',
    details: [
      ['Confirmed', 'Miguel Santos'],
      ['Date of birth', 'April 2, 1995'],
      ['Date of confirmation', 'May 24, 2008'],
      ['Sponsor', 'Carlos Mendoza'],
      ['Baptismal parish', 'Sacred Heart of Jesus Parish'],
    ],
  },
  {
    number: 'REQ-2026-0144',
    recordType: 'Baptism',
    requestType: 'Certificate Request',
    subject: 'Jose Navarro',
    client: { name: 'Teresa Navarro', relationship: 'Parent' },
    purpose: 'Other: school enrollment',
    submittedAt: '2026-10-30T08:20:00+08:00',
    verifiedAt: '2026-10-31T09:40:00+08:00',
    verifiedBy: 'Liza Mercado',
    register: { book: 12, page: 51, line: 7 },
    documents: [
      { label: 'Valid ID', file: 'teresa-navarro-id.jpg' },
      { label: 'Birth Certificate', file: 'psa-birth-certificate-j-navarro.pdf' },
    ],
    remarks: 'Entry matches the birth certificate.',
    details: [
      ['Baptized', 'Jose Navarro'],
      ['Date of birth', 'January 9, 2019'],
      ['Date of baptism', 'March 3, 2019'],
      ['Father', 'Dennis Navarro'],
      ['Mother', 'Teresa Navarro (née Cruz)'],
      ['Godparents', 'Paolo Garcia, Lorna Cruz'],
    ],
  },
]


// More of the queue, so search and paging have something to work on. Same shape,
// fewer bespoke details.
const supportingDoc: Record<Sacrament, string> = {
  Baptism: 'Birth Certificate',
  Confirmation: 'Baptismal Certificate',
  Marriage: 'Valid ID',
  Burial: 'Death Certificate',
}

function certificate(
  number: string,
  recordType: Sacrament,
  subject: string,
  client: AwaitingRequest['client'],
  purpose: string,
  [submittedAt, verifiedAt]: [string, string],
  verifiedBy: string,
  [book, page, line]: [number, number, number],
  details: AwaitingRequest['details'],
): AwaitingRequest {
  const slug = subject.toLowerCase().replace(/[^a-z]+/g, '-')
  return {
    number,
    recordType,
    requestType: 'Certificate Request',
    subject,
    client,
    purpose,
    submittedAt,
    verifiedAt,
    verifiedBy,
    register: { book, page, line },
    documents: [
      { label: 'Valid ID', file: `${client.name.toLowerCase().replace(/[^a-z]+/g, '-')}-id.jpg` },
      { label: supportingDoc[recordType], file: `${supportingDoc[recordType].toLowerCase().replace(/ /g, '-')}-${slug}.pdf` },
    ],
    remarks: `Entry found in the ${recordType.toLowerCase()} register and matches the supporting document.`,
    details,
  }
}

awaitingApproval.push(
  certificate('REQ-2026-0125', 'Baptism', 'Carlo Mendoza', { name: 'Arnel Mendoza', relationship: 'Parent' }, 'Personal copy',
    ['2026-10-23T10:00:00+08:00', '2026-10-26T09:15:00+08:00'], 'Joel Bautista', [11, 77, 3],
    [['Baptized', 'Carlo Mendoza'], ['Date of birth', 'July 2, 2014'], ['Date of baptism', 'August 10, 2014'], ['Father', 'Arnel Mendoza'], ['Mother', 'Rosa Mendoza (née Ramos)']]),
  certificate('REQ-2026-0132', 'Marriage', 'Dennis & Jocelyn Lopez', { name: 'Dennis Lopez', relationship: 'Spouse' }, 'Legal purpose',
    ['2026-10-25T14:30:00+08:00', '2026-10-28T11:40:00+08:00'], 'Grace Domingo', [6, 102, 1],
    [['Groom', 'Dennis Lopez'], ['Bride', 'Jocelyn Lopez (née Pascual)'], ['Date of marriage', 'December 8, 2011'], ['Presiding priest', 'Fr. Miguel Torres']]),
  certificate('REQ-2026-0134', 'Confirmation', 'Nina Soriano', { name: 'Nina Soriano', relationship: 'Self' }, 'Marriage requirement',
    ['2026-10-26T08:50:00+08:00', '2026-10-28T15:05:00+08:00'], 'Liza Mercado', [3, 151, 6],
    [['Confirmed', 'Nina Soriano'], ['Date of birth', 'March 30, 1998'], ['Date of confirmation', 'May 26, 2012'], ['Sponsor', 'Lorna Cruz']]),
  certificate('REQ-2026-0137', 'Burial', 'Felisa Cruz', { name: 'Lorna Cruz', relationship: 'Child' }, 'Legal purpose',
    ['2026-10-27T09:20:00+08:00', '2026-10-29T16:30:00+08:00'], 'Joel Bautista', [4, 91, 5],
    [['Deceased', 'Felisa Cruz'], ['Date of death', 'January 21, 2023'], ['Age at death', '84'], ['Place of burial', 'Municipal Cemetery']]),
  certificate('REQ-2026-0138', 'Baptism', 'Maria Clara Pascual', { name: 'Jocelyn Pascual', relationship: 'Parent' }, 'Other: school enrollment',
    ['2026-10-28T13:10:00+08:00', '2026-10-30T10:25:00+08:00'], 'Grace Domingo', [12, 33, 2],
    [['Baptized', 'Maria Clara Pascual'], ['Date of birth', 'May 5, 2018'], ['Date of baptism', 'June 24, 2018'], ['Father', 'Edgar Pascual'], ['Mother', 'Jocelyn Pascual (née Morales)']]),
  certificate('REQ-2026-0126', 'Baptism', 'Joshua Castillo', { name: 'Benjie Castillo', relationship: 'Parent' }, 'Other: school enrollment',
    ['2026-10-29T10:05:00+08:00', '2026-10-31T09:25:00+08:00'], 'Liza Mercado', [12, 141, 2],
    [['Baptized', 'Joshua Castillo'], ['Date of birth', 'April 9, 2017'], ['Date of baptism', 'May 21, 2017'], ['Father', 'Benjie Castillo']]),
  certificate('REQ-2026-0143', 'Burial', 'Ricardo Valdez Sr.', { name: 'Ricardo Valdez', relationship: 'Child' }, 'Legal purpose',
    ['2026-10-30T11:45:00+08:00', '2026-10-31T10:05:00+08:00'], 'Joel Bautista', [5, 12, 8],
    [['Deceased', 'Ricardo Valdez Sr.'], ['Date of death', 'September 3, 2026'], ['Age at death', '71'], ['Officiating priest', 'Fr. Antonio Reyes']]),
)
