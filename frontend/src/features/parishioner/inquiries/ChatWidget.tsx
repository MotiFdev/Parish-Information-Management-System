import { useEffect, useRef, useState, type FormEvent } from 'react'
import logo from '../../../assets/parish-logo.jpg'
import { Icon } from '../../../components/ui/Icon'
import { suggestedQuestions } from './answers'
import { useInquiry } from './inquiryContext'
import { useOfficeHours } from '../officeHours'

export function ChatLauncher() {
  const { open, setOpen } = useInquiry()
  const ref = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(open)

  // Return focus to the launcher when the panel closes, so keyboard users are not dropped at the top of the page.
  useEffect(() => {
    if (wasOpen.current && !open) ref.current?.focus()
    wasOpen.current = open
  }, [open])

  if (open) return null

  return (
    <button
      ref={ref}
      type="button"
      aria-controls="parish-chat"
      aria-expanded={false}
      onClick={() => setOpen(true)}
      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-forest px-5 font-semibold text-white shadow-lg transition-colors hover:bg-forest-dark"
    >
      <Icon name="message" />
      Ask the parish
    </button>
  )
}

export function ChatPanel() {
  const officeHours = useOfficeHours()
  const { open, setOpen, messages, typing, ask } = useInquiry()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    // Full-screen on phones, so the page behind should not scroll.
    const phone = window.matchMedia('(max-width: 639px)').matches
    if (phone) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      if (phone) document.body.style.overflow = ''
    }
  }, [open, setOpen])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, typing, open])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || typing) return
    ask(draft)
    setDraft('')
  }

  const bubbleFromParish = (key: number | string, text: string) => (
    <div key={key} className="flex max-w-[88%] items-end gap-2">
      <img src={logo} alt="" className="size-7 shrink-0 rounded-full bg-white object-cover ring-1 ring-gold/50" />
      <p className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-stone-800 ring-1 ring-stone-200">
        {text}
      </p>
    </div>
  )

  return (
    // Shadow marks the one surface that floats above the page.
    <section
      id="parish-chat"
      role="dialog"
      aria-labelledby="parish-chat-title"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-[25rem] sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-2xl"
    >
      <header className="flex items-center gap-3 bg-forest py-2 pr-2 pl-4 text-white">
        <img src={logo} alt="" className="size-9 shrink-0 rounded-full bg-white object-cover" />
        <div className="min-w-0 flex-1">
          <h2 id="parish-chat-title" className="font-serif text-xl leading-tight font-semibold">
            Parish Inquiries
          </h2>
          <p className="truncate text-sm text-white/85">Schedules, requirements, and office hours</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Parish Inquiries"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10"
        >
          <Icon name="close" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-ivory/50 px-4 py-4" aria-live="polite">
        {bubbleFromParish('greeting', 'Hello! Ask me about Mass schedules, certificate requirements, appointments, or parish office hours.')}
        {messages.map((m) =>
          m.from === 'parish' ? (
            bubbleFromParish(m.id, m.text)
          ) : (
            <p key={m.id} className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-forest px-3.5 py-2.5 text-[15px] leading-relaxed text-white">
              {m.text}
            </p>
          ),
        )}
        {typing && (
          <div className="flex items-end gap-2">
            <img src={logo} alt="" className="size-7 shrink-0 rounded-full bg-white object-cover ring-1 ring-gold/50" />
            {/* Bounces only while a reply is pending, so the user knows one is coming. */}
            <span
              role="status"
              aria-label="The parish assistant is typing"
              className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 ring-1 ring-stone-200"
            >
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-2 rounded-full bg-stone-400 motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </span>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-stone-100 px-4 py-3">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-forest/30 bg-white px-4 text-sm font-medium text-forest hover:bg-forest-soft"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-stone-200 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <label htmlFor="inquiry" className="sr-only">
          Your question
        </label>
        <input
          ref={inputRef}
          id="inquiry"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your question…"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-[15px] focus:border-forest focus:ring-2 focus:ring-forest/35 focus:outline-none focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || typing}
          aria-label="Send"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest text-white hover:bg-forest-dark disabled:opacity-40"
        >
          <Icon name="send" className="size-5" />
        </button>
      </form>
      <p className="bg-white px-4 pb-3 text-sm text-stone-600">Need a person? Visit the parish office, {officeHours}.</p>
    </section>
  )
}
