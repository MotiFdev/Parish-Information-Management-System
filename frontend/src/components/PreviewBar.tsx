import type { ReactNode } from 'react'
import { navigate } from '../lib/router'
import { previewStates, usePreviewState, withPreview, type PreviewState } from '../lib/preview'

const labels: Record<PreviewState, string> = {
  ready: 'Sample data',
  loading: 'Loading',
  empty: 'Empty',
  error: 'Error',
}

// Visible on every page during the design phase so no sample record is
// mistaken for a real one. Remove once the API supplies real data.
export function PreviewBar({
  note = 'Names, requests, Mass times, office hours, and announcements are sample data.',
  className = 'max-w-7xl',
  extra,
}: {
  note?: string
  /** Another design-preview control shown before the data switch, such as the signed-out view. */
  extra?: ReactNode
  /** Width of the inner row; the admin shell spans its whole content column. */
  className?: string
}) {
  const state = usePreviewState()

  return (
    <div className="bg-forest-dark text-sm text-white">
      <div className={`mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1 sm:px-6 lg:px-8 ${className}`}>
        <p className="py-2 text-white/85">
          <span className="font-semibold text-white">Design preview.</span> {note}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
        {extra}
        <label className="flex items-center gap-2">
          <span className="text-white/85">Show</span>
          <select
            value={state}
            onChange={(e) => navigate(withPreview(e.target.value as PreviewState), { replace: true })}
            className="min-h-11 rounded-lg border border-white/30 bg-forest-dark px-2 font-medium text-white"
          >
            {previewStates.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </label>
        </div>
      </div>
    </div>
  )
}
