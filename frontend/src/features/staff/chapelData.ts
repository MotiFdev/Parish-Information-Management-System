import { sonas } from '../parishioner/sampleData'

// Placeholder chapel details for the design phase, shaped like the backend's
// chapels table plus each chapel's president from chapel_officers. Shared by
// Appointments & Events (president contact) and Chapels & Officers.

export interface ChapelInfo {
  id: string
  sonaId: string
  name: string
  patron: string
  /** Free text, as the specification allows: fiesta dates are often recurring descriptions. */
  fiesta: string
  contact: string
  fbAccount: string
  president: { name: string; contact: string; fb: string }
}

const details: Record<string, Omit<ChapelInfo, 'id' | 'sonaId' | 'name'>> = {
  c1: { patron: 'San Isidro Labrador', fiesta: 'May 15', contact: '0917 000 5101', fbAccount: 'San Isidro Labrador Chapel', president: { name: 'Ramon Aquino', contact: '0917 000 6101', fb: 'Ramon Aquino' } },
  c2: { patron: 'Our Lady of Fatima', fiesta: 'May 13', contact: '0917 000 5102', fbAccount: 'Fatima Chapel Sacred Heart', president: { name: 'Carmen Villareal', contact: '0917 000 6102', fb: 'Carmen Villareal' } },
  c3: { patron: 'Our Lady of Mount Carmel', fiesta: 'July 16', contact: '0917 000 5103', fbAccount: 'Mount Carmel Chapel', president: { name: 'Edgar Morales', contact: '0917 000 6103', fb: 'Edgar Morales' } },
  c4: { patron: 'San Ignacio de Loyola', fiesta: 'July 31', contact: '0917 000 5104', fbAccount: 'San Ignacio Chapel', president: { name: 'Teresa Navarro', contact: '0917 000 6104', fb: 'Teresa Navarro' } },
  c5: { patron: 'San Lorenzo Ruiz', fiesta: 'Last Sunday of September', contact: '0917 000 5105', fbAccount: 'San Lorenzo Ruiz Chapel', president: { name: 'Benjie Castillo', contact: '0917 000 6105', fb: 'Benjie Castillo' } },
  c6: { patron: 'San Antonio de Padua', fiesta: 'June 13', contact: '0917 000 5106', fbAccount: 'San Antonio de Padua Chapel', president: { name: 'Lorna Cruz', contact: '0917 000 6106', fb: 'Lorna Cruz' } },
  c7: { patron: 'Our Mother of Perpetual Help', fiesta: 'June 27', contact: '0917 000 5107', fbAccount: 'Perpetual Help Chapel', president: { name: 'Dennis Lopez', contact: '0917 000 6107', fb: 'Dennis Lopez' } },
}

export const chapels: ChapelInfo[] = sonas.flatMap((s) => s.chapels.map((c) => ({ id: c.id, sonaId: s.id, name: c.name, ...details[c.id] })))

export const chapelById = (id?: string) => chapels.find((c) => c.id === id)
