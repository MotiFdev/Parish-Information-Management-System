import type { RegisterEntry } from '../registerData'

// One AI Record Search result, as the server ranks it (backend App\Services\RecordSearch).

export interface SearchHit {
  entry: RegisterEntry
  /** 0 to 1: Gemini's closeness blended with the names and years the entry contains. */
  score: number
  /** Words from the question the entry contains, for highlighting. */
  terms: string[]
  /** Up to three fields where a matched word appears. */
  highlights: [label: string, value: string][]
}

export const examples = ['Baptism of a Dela Cruz around 1987', 'Marriages presided by Fr. Miguel Torres', 'Burials in 2025', 'Confirmations around 2012']
