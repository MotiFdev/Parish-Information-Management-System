import { api, ApiError } from '../../../lib/api'
import type { RegisterEntry } from '../registerData'

// Register corrections staff file from Sacramental Records (backend Priest\RecordCorrectionController).

export type DecideResult = { entry: RegisterEntry } | { error: string; field?: boolean } | { stale: string }

/** Approves (the entry changes) or rejects with a reason staff see. */
export async function decideCorrection(correctionId: string, approve: boolean, reason?: string): Promise<DecideResult> {
  try {
    return await api<{ entry: RegisterEntry }>(`/api/priest/record-corrections/${correctionId}/${approve ? 'approve' : 'reject'}`, {
      method: 'POST',
      body: approve ? {} : { reason },
    })
  } catch (e) {
    if (!(e instanceof ApiError)) return { error: 'Could not save. Check the connection and try again.' }
    if (e.status === 409) return { stale: e.message }
    if (e.status === 422 && e.field('reason')) return { error: e.field('reason')!, field: true }
    return { error: e.message }
  }
}
