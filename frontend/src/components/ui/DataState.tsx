import type { CSSProperties } from 'react'
import { navigate } from '../../lib/router'
import { withPreview } from '../../lib/preview'
import { Icon } from './Icon'

/** The shape of the content that is loading, so the placeholder matches what replaces it. */
export type SkeletonVariant = 'list' | 'events' | 'table' | 'chart' | 'form' | 'grid' | 'calendar' | 'detail' | 'page'

/** A grey placeholder bar. Widths repeat in a fixed pattern so rows don't look identical. */
export function Bone({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={`block rounded-md bg-stone-200/80 ${className}`} style={style} />
}

const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/12', 'w-7/12']
const w = (i: number) => widths[i % widths.length]
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function Shape({ variant, rows }: { variant: SkeletonVariant; rows?: number }) {
  switch (variant) {
    case 'events':
      return (
        <div className="divide-y divide-stone-100">
          {range(rows ?? 3).map((i) => (
            <div key={i} className="flex gap-4 px-5 py-4">
              <Bone className="size-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                <Bone className={`h-4 ${w(i)}`} />
                <Bone className="h-3 w-1/2" />
                <Bone className={`h-3 ${w(i + 2)}`} />
              </div>
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <div>
          <div className="flex gap-4 border-b border-stone-100 bg-ivory/60 px-5 py-3">
            <Bone className="h-3 w-1/4" />
            <Bone className="h-3 w-1/6" />
            <Bone className="hidden h-3 w-1/6 sm:block" />
            <Bone className="ml-auto hidden h-3 w-1/12 sm:block" />
          </div>
          <div className="divide-y divide-stone-100">
            {range(rows ?? 6).map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1 space-y-2 sm:flex-none sm:basis-1/4">
                  <Bone className={`h-3.5 ${w(i)}`} />
                  <Bone className="h-3 w-1/3 sm:hidden" />
                </div>
                <Bone className="hidden h-3.5 basis-1/6 sm:block" />
                <Bone className="hidden h-3.5 basis-1/6 sm:block" />
                <Bone className="ml-auto h-6 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )
    case 'chart':
      return (
        <div className="px-5 py-6">
          <div className="flex h-48 items-end gap-2 border-b border-l border-stone-200 pb-px pl-px sm:gap-3">
            {[45, 70, 35, 85, 60, 50, 75, 40, 65, 55, 80, 30].map((h, i) => (
              <Bone key={i} className={`flex-1 rounded-t-md rounded-b-none ${i > 5 ? 'hidden sm:block' : ''}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {range(4).map((i) => (
              <Bone key={i} className="h-3 w-20" />
            ))}
          </div>
        </div>
      )
    case 'form':
      return (
        <div className="space-y-5 px-5 py-6">
          {range(rows ?? 4).map((i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-3 w-28" />
              <Bone className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Bone className="h-11 w-36 rounded-xl" />
        </div>
      )
    case 'grid':
      return (
        <div className="grid grid-cols-2 gap-2 px-5 py-5 sm:grid-cols-3 lg:grid-cols-4">
          {range(rows ?? 8).map((i) => (
            <Bone key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      )
    case 'calendar':
      return (
        <div className="px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            <Bone className="h-5 w-40" />
            <Bone className="h-9 w-24 rounded-lg" />
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {range(35).map((i) => (
              <Bone key={i} className="aspect-square rounded-lg sm:aspect-[4/3]" />
            ))}
          </div>
        </div>
      )
    case 'detail':
      return (
        <div className="space-y-5 px-5 py-6">
          <div className="flex items-center gap-3">
            <Bone className="h-6 w-1/2" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {range(rows ?? 4).map((i) => (
              <div key={i} className="space-y-2">
                <Bone className="h-3 w-24" />
                <Bone className={`h-4 ${w(i)}`} />
              </div>
            ))}
          </div>
          <Bone className="h-20 w-full rounded-xl" />
        </div>
      )
    case 'page':
      return (
        <div className="flex min-h-dvh w-full">
          <div className="hidden w-64 shrink-0 space-y-3 border-r border-stone-200 bg-white p-5 lg:block">
            <Bone className="mb-6 h-8 w-36" />
            {range(6).map((i) => (
              <Bone key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-8">
            <Bone className="h-9 w-64 max-w-full" />
            <Bone className="h-4 w-96 max-w-full" />
            <div className="grid gap-4 sm:grid-cols-3">
              {range(3).map((i) => (
                <Bone key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Bone className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      )
    case 'list':
      return (
        <div className="divide-y divide-stone-100">
          {range(rows ?? 4).map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <Bone className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bone className={`h-3.5 ${w(i)}`} />
                <Bone className={`h-3 ${w(i + 3)}`} />
              </div>
            </div>
          ))}
        </div>
      )
  }
}

/**
 * Placeholder shapes while data loads. Screen readers hear "Loading {what}…";
 * the pulse is skipped for people who ask for reduced motion.
 */
export function LoadingState({ what, variant = 'list', rows }: { what: string; variant?: SkeletonVariant; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="motion-safe:animate-pulse">
      <span className="sr-only">Loading {what}…</span>
      <div aria-hidden="true">
        <Shape variant={variant} rows={rows} />
      </div>
    </div>
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
