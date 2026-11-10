import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from '../../../components/Link'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, cardClass } from '../../../components/ui/styles'
import { trackHref } from './reference'

interface Props {
  title: string
  reference: string
  /** What happens next, in a sentence or two. */
  children: ReactNode
  /** Extra links shown after "Track it". */
  actions?: ReactNode
}

/**
 * Shown right after a request or booking is sent. Without an account, the
 * reference number is the only way back to it, so this screen is about keeping it.
 */
export function SubmittedConfirmation({ title, reference, children, actions }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked (e.g. a non-secure page): the number stays on screen to copy by hand.
    }
  }

  return (
    <div className={`mx-auto max-w-2xl scroll-mt-24 p-6 text-center sm:p-10 ${cardClass}`}>
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-forest-soft text-forest">
        <Icon name="check" className="size-7" strokeWidth={2.5} />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-5 font-serif text-3xl font-semibold text-stone-900 focus:outline-none">
        {title}
      </h2>
      <p className="mt-2 text-stone-600">Your reference number</p>
      <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 rounded-xl bg-ivory py-2 pr-2 pl-5">
        <span className="font-mono text-2xl font-semibold tracking-wide text-forest select-all sm:text-3xl">{reference}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-white"
        >
          {copied && <Icon name="check" className="size-4" strokeWidth={2.5} />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <p className="mx-auto mt-4 flex max-w-md gap-2.5 rounded-xl bg-gold-soft p-3.5 text-left text-sm text-stone-800">
        <Icon name="alert" className="mt-0.5 size-4.5 shrink-0 text-brown" />
        <span>Write it down or take a screenshot. You need it to check the status online, and the parish office asks for it when you follow up.</span>
      </p>
      <div className="mt-6 text-sm text-stone-600">{children}</div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={trackHref(reference)} className={btnPrimary}>
          <Icon name="search" className="size-4" />
          Track it
        </Link>
        {actions}
      </div>
    </div>
  )
}
