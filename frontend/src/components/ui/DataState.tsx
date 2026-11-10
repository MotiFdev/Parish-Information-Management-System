import { navigate } from '../../lib/router'
import { withPreview } from '../../lib/preview'
import { Icon } from './Icon'

export function LoadingState({ what }: { what: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-3 px-5 py-10 text-stone-600">
      <span className="size-5 rounded-full border-2 border-forest/25 border-t-forest motion-safe:animate-spin" aria-hidden="true" />
      Loading {what}…
    </p>
  )
}

export function ErrorState({
  what,
  help = 'If it keeps happening, the parish office can help.',
  onRetry,
}: {
  what: string
  help?: string
  /** Reloads the data. Without it, "Try again" leaves the design preview's error state. */
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <Icon name="alert" className="size-6 text-red-700" />
      <p className="max-w-sm text-stone-700">
        We couldn’t load {what}. Check your connection and try again. {help}
      </p>
      <button
        type="button"
        onClick={onRetry ?? (() => navigate(withPreview('ready'), { replace: true }))}
        className="inline-flex min-h-11 items-center rounded-xl border border-forest/25 bg-white px-4 font-semibold text-forest hover:bg-forest-soft"
      >
        Try again
      </button>
    </div>
  )
}
