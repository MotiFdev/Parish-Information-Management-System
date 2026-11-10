import { useState } from 'react'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../../components/ui/styles'
import type { AnnouncementCategory } from '../../parishioner/sampleData'
import { categories, dateLabel, fromManilaInputs, plainText, sanitizeHtml, toManilaInputs, whenLabel, type Notice } from './announcementsData'
import { RichTextEditor } from './RichTextEditor'

export type PublishMode = 'draft' | 'now' | 'schedule' | 'keep'

export interface NoticeInput {
  title: string
  category: AnnouncementCategory
  body: string
  pinned: boolean
  mode: PublishMode
  /** Set when mode is schedule. */
  publishAt?: string
}

interface Props {
  notice?: Notice
  /** The notice pinned now, if it is not this one; pinning this replaces it. */
  pinnedOther?: Notice
  onCancel: () => void
  /** Saves; resolves with the server's errors (title, body, when) when it refuses. */
  onSave: (input: NoticeInput) => Promise<Record<string, string | undefined> | void>
}

const modes: Array<{ value: PublishMode; label: string; help: string }> = [
  { value: 'draft', label: 'Save as draft', help: 'Only parish staff can see it.' },
  { value: 'now', label: 'Publish now', help: 'Parishioners see it on their home page right away.' },
  { value: 'schedule', label: 'Schedule', help: 'It goes live by itself at the date and time you set.' },
]

export function AnnouncementEditor({ notice, pinnedOther, onCancel, onSave }: Props) {
  const live = notice?.status === 'Published'
  const startWhen = notice?.status === 'Scheduled' && notice.publishAt ? toManilaInputs(notice.publishAt) : { date: '', time: '08:00' }
  const initial = {
    title: notice?.title ?? '',
    category: notice?.category ?? ('Parish' as AnnouncementCategory),
    body: notice?.body ?? '',
    pinned: notice?.pinned ?? false,
    mode: (live ? 'keep' : notice?.status === 'Scheduled' ? 'schedule' : 'draft') as PublishMode,
    ...startWhen,
  }
  const [f, setF] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [discarding, setDiscarding] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k === 'date' || k === 'time' ? 'when' : k, undefined])) }))
  }
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  const today = toManilaInputs(new Date().toISOString()).date
  const excerpt = plainText(f.body)

  const submit = async () => {
    if (saving) return
    const at = f.date && f.time ? fromManilaInputs(f.date, f.time) : ''
    const next: Record<string, string | undefined> = {
      title: f.title.trim() ? undefined : 'Give the announcement a title.',
      body: excerpt ? undefined : 'Write the announcement.',
      when:
        f.mode !== 'schedule'
          ? undefined
          : !at
            ? 'Choose the date and time it goes live.'
            : at <= new Date().toISOString()
              ? 'Choose a time later than now.'
              : undefined,
    }
    setErrors(next)
    if (next.title) return document.getElementById('an-title')?.focus()
    if (next.body) return document.getElementById('an-body')?.focus()
    if (next.when) return document.getElementById('an-date')?.focus()
    setSaving(true)
    const refused = await onSave({
      title: f.title.trim(),
      category: f.category,
      body: sanitizeHtml(f.body),
      pinned: f.pinned,
      mode: f.mode,
      publishAt: f.mode === 'schedule' ? at : undefined,
    }).finally(() => setSaving(false))
    if (refused) {
      setErrors(refused)
      if (refused.title) document.getElementById('an-title')?.focus()
      else if (refused.body) document.getElementById('an-body')?.focus()
      else if (refused.when) document.getElementById('an-date')?.focus()
    }
  }

  const primary = { draft: 'Save draft', now: 'Publish', schedule: 'Schedule', keep: 'Save changes' }[f.mode]

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      aria-labelledby="an-heading"
    >
      <button
        type="button"
        onClick={() => (dirty ? setDiscarding(true) : onCancel())}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-forest hover:bg-forest-soft"
      >
        <Icon name="arrowLeft" className="size-4" />
        All announcements
      </button>
      <h1 id="an-heading" className="mt-2 font-serif text-4xl font-semibold text-stone-900">
        {notice ? 'Edit announcement' : 'New announcement'}
      </h1>
      {live && <p className="mt-1 text-stone-600">Published {whenLabel(notice.publishAt!)}. Saved changes show to parishioners right away.</p>}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <div className={`${cardClass} min-w-0 space-y-5 p-5 xl:col-span-8`}>
          <Field label="Title" htmlFor="an-title" required error={errors.title}>
            <input
              id="an-title"
              value={f.title}
              onChange={(e) => set({ title: e.target.value })}
              maxLength={150}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'an-title-error' : undefined}
              className={`${inputClass} font-semibold`}
            />
          </Field>
          <div>
            <p id="an-body-label" className="mb-1.5 block text-sm font-medium text-stone-700">
              Announcement <span className="text-red-600">*</span>
            </p>
            <RichTextEditor
              id="an-body"
              labelledBy="an-body-label"
              describedBy={errors.body ? 'an-body-error' : 'an-body-hint'}
              initialHtml={initial.body}
              invalid={!!errors.body}
              onChange={(body) => set({ body })}
            />
            {errors.body ? (
              <p id="an-body-error" className="mt-1.5 text-sm text-red-700">
                {errors.body}
              </p>
            ) : (
              <p id="an-body-hint" className="mt-1.5 text-sm text-stone-500">
                Pasted text keeps its words but not its styling. The first lines show as the summary on the parishioner home page.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <section aria-labelledby="an-settings" className={`${cardClass} space-y-4 p-5`}>
            <h2 id="an-settings" className="font-semibold text-stone-900">
              Settings
            </h2>
            <Field label="Category" htmlFor="an-category" hint="Parishioners filter announcements by these.">
              <select
                id="an-category"
                aria-describedby="an-category-hint"
                value={f.category}
                onChange={(e) => set({ category: e.target.value as AnnouncementCategory })}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 px-3 py-2.5">
              <input type="checkbox" checked={f.pinned} onChange={(e) => set({ pinned: e.target.checked })} className="mt-1 size-4 accent-forest" />
              <span className="text-sm">
                <span className="block font-semibold text-stone-900">Pin to the top</span>
                <span className="block text-stone-600">
                  {f.pinned && pinnedOther ? `Replaces “${pinnedOther.title}” as the pinned announcement.` : 'One announcement is pinned at a time.'}
                </span>
              </span>
            </label>

            {!live && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-stone-700">Publishing</legend>
                {modes.map((m) => (
                  <label
                    key={m.value}
                    className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${f.mode === m.value ? 'border-forest bg-forest-soft' : 'border-stone-300 bg-white'}`}
                  >
                    <input
                      type="radio"
                      name="an-mode"
                      checked={f.mode === m.value}
                      onChange={() => set({ mode: m.value })}
                      className="mt-1 size-4 accent-forest"
                    />
                    <span className="text-sm">
                      <span className="block font-semibold text-stone-900">{m.label}</span>
                      <span className="block text-stone-600">{m.help}</span>
                    </span>
                  </label>
                ))}
                {f.mode === 'schedule' && (
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <Field label="Date" htmlFor="an-date" required error={errors.when} className="col-span-2 sm:col-span-1 xl:col-span-2 2xl:col-span-1">
                      <input
                        id="an-date"
                        type="date"
                        min={today}
                        value={f.date}
                        onChange={(e) => set({ date: e.target.value })}
                        aria-invalid={errors.when ? true : undefined}
                        aria-describedby={errors.when ? 'an-date-error' : 'an-when-hint'}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Time" htmlFor="an-time" required className="col-span-2 sm:col-span-1 xl:col-span-2 2xl:col-span-1">
                      <input
                        id="an-time"
                        type="time"
                        step={900}
                        value={f.time}
                        onChange={(e) => set({ time: e.target.value })}
                        aria-describedby="an-when-hint"
                        className={inputClass}
                      />
                    </Field>
                    <p id="an-when-hint" className="col-span-2 text-sm text-stone-500">
                      Philippine time.
                    </p>
                  </div>
                )}
              </fieldset>
            )}
          </section>

          {/* The same card the parishioner home page draws, so staff see the result before it goes out. */}
          <section aria-labelledby="an-preview">
            <h2 id="an-preview" className="mb-2 text-sm font-semibold text-stone-700">
              How parishioners see it
            </h2>
            <article className={f.pinned ? 'rounded-2xl bg-forest p-5 text-white' : `${cardClass} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${f.pinned ? 'bg-gold text-forest-dark' : 'bg-brown-soft text-brown'}`}>
                  {f.pinned ? 'Pinned · ' : ''}
                  {f.category}
                </span>
                <span className={`text-sm ${f.pinned ? 'text-white/80' : 'text-stone-600'}`}>
                  {f.mode === 'schedule' && f.date
                    ? dateLabel(fromManilaInputs(f.date, f.time || '00:00'))
                    : live
                      ? dateLabel(notice.publishAt!)
                      : dateLabel(new Date().toISOString())}
                </span>
              </div>
              <h3 className={`mt-3 font-serif text-xl leading-snug font-semibold break-words ${f.pinned ? '' : 'text-stone-900'}`}>
                {f.title.trim() || 'Your title'}
              </h3>
              <p className={`mt-2 line-clamp-4 text-[15px] leading-relaxed break-words ${f.pinned ? 'text-white/90' : 'text-stone-700'}`}>
                {excerpt || 'The first lines of the announcement appear here.'}
              </p>
            </article>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-6 flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory py-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => (dirty ? setDiscarding(true) : onCancel())} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {saving ? 'Saving…' : primary}
        </button>
      </div>

      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        title="Discard your changes?"
        confirmLabel="Discard"
        tone="danger"
        onConfirm={() => {
          setDiscarding(false)
          onCancel()
        }}
      >
        <p>What you typed since opening the editor is not kept.</p>
      </ConfirmDialog>
    </form>
  )
}
