import { useState, type FormEvent, type ReactNode } from 'react'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import type { RegisterEntry } from '../../priest/registerData'
import type { Sacrament } from '../../priest/sampleData'
import { entryFields, valuesFrom, type FieldValues } from './entryFields'

export interface EntryInput {
  values: FieldValues
  register: { book: number; page: number; line: number }
}

interface Props {
  type: Sacrament
  entry?: RegisterEntry
  /** Values to start a new entry with, e.g. from a New Registration request. */
  initial?: FieldValues
  /** Shown above the form, e.g. where the values came from. */
  notice?: ReactNode
  /** Returns an error message when book, page, and line are already taken. */
  checkRef: (ref: EntryInput['register']) => string | undefined
  /** Saves; resolves with the server's errors (keyed by field label, or "register") when it refuses. */
  onSave: (input: EntryInput) => Promise<Record<string, string | undefined> | void>
  onCancel: () => void
}

const id = (label: string) => `ef-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

export function EntryForm({ type, entry, initial, notice, checkRef, onSave, onCancel }: Props) {
  const fields = entryFields[type]
  const [values, setValues] = useState<FieldValues>(() => ({ ...valuesFrom(type, entry), ...initial }))
  const [ref, setRef] = useState({
    book: entry ? String(entry.register.book) : '',
    page: entry ? String(entry.register.page) : '',
    line: entry ? String(entry.register.line) : '',
  })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const groups = [...new Set(fields.map((f) => f.group))]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const next: Record<string, string | undefined> = {}
    // A new entry needs every required field. A correction only can't blank a field
    // the entry already had; older entries missing a field shouldn't block the fix.
    const had = (label: string) => Boolean(entry?.details.some(([k, v]) => k === label && v.trim()))
    for (const f of fields) {
      const v = values[f.label]?.trim() ?? ''
      if (f.required && !v && (!entry || had(f.label))) next[f.label] = `Enter the ${f.label.toLowerCase()}.`
      else if (f.type === 'date' && v > today) next[f.label] = 'This date can’t be in the future.'
      else if (f.type === 'number' && v && !/^\d{1,3}$/.test(v)) next[f.label] = 'Enter a whole number.'
    }
    const nums = { book: Number(ref.book), page: Number(ref.page), line: Number(ref.line) }
    const refOk = [nums.book, nums.page, nums.line].every((n) => Number.isInteger(n) && n > 0)
    next.register = !refOk ? 'Enter the book, page, and line as whole numbers.' : checkRef(nums)
    setErrors(next)
    const first = fields.find((f) => next[f.label])
    if (first) return document.getElementById(id(first.label))?.focus()
    if (next.register) return document.getElementById('ef-book')?.focus()
    setSaving(true)
    const refused = await onSave({ values, register: nums }).finally(() => setSaving(false))
    if (refused) {
      setErrors(refused)
      const bad = fields.find((f) => refused[f.label])
      if (bad) document.getElementById(id(bad.label))?.focus()
      else if (refused.register) document.getElementById('ef-book')?.focus()
    }
  }

  return (
    <form noValidate onSubmit={submit} aria-labelledby="ef-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h2 id="ef-title" className="font-serif text-3xl font-semibold text-stone-900">
            {entry ? `Edit ${entry.subject}` : `Add ${type.toLowerCase()} entry`}
          </h2>
          <p className="text-sm text-stone-600">
            {entry
              ? 'Changes go to the priest as a record correction; the register changes once it is approved.'
              : 'Copy the entry exactly as written in the register book. Fields marked * are required.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close form"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {notice}
        <fieldset className="px-5 py-5" aria-describedby={errors.register ? 'ef-register-error' : undefined}>
          <legend className="sr-only">Place in the register</legend>
          <h3 aria-hidden="true" className="mb-3 font-semibold text-stone-900">
            Place in the register<span className="text-red-600"> *</span>
          </h3>
          <div className="flex flex-wrap gap-3">
            {(['book', 'page', 'line'] as const).map((k) => (
              <div key={k}>
                <label htmlFor={`ef-${k}`} className="mb-1 block text-sm font-medium text-stone-700 capitalize">
                  {k}
                </label>
                <input
                  id={`ef-${k}`}
                  inputMode="numeric"
                  value={ref[k]}
                  disabled={Boolean(entry)}
                  onChange={(e) => {
                    setRef((r) => ({ ...r, [k]: e.target.value.replace(/\D/g, '') }))
                    setErrors((x) => ({ ...x, register: undefined }))
                  }}
                  aria-invalid={errors.register ? true : undefined}
                  className={`${inputClass} w-24 tabular-nums disabled:bg-stone-50 disabled:text-stone-600`}
                />
              </div>
            ))}
          </div>
          {errors.register ? (
            <p id="ef-register-error" className="mt-1.5 text-sm text-red-700">
              {errors.register}
            </p>
          ) : (
            entry && <p className="mt-1.5 text-sm text-stone-600">An entry’s place in the book can’t change.</p>
          )}
        </fieldset>

        {groups.map((g) => (
          <fieldset key={g} className="border-t border-stone-100 px-5 py-5">
            <legend className="sr-only">{g}</legend>
            <h3 aria-hidden="true" className="mb-3 font-semibold text-stone-900">
              {g}
              {g === 'Informant' && <span className="ml-2 text-sm font-normal text-stone-600">Kept separately from the deceased’s record</span>}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields
                .filter((f) => f.group === g)
                .map((f) => {
                  const fid = id(f.label)
                  const err = errors[f.label]
                  const common = {
                    id: fid,
                    value: values[f.label] ?? '',
                    'aria-invalid': err ? true : undefined,
                    'aria-describedby': err ? `${fid}-error` : f.hint ? `${fid}-hint` : undefined,
                    className: inputClass,
                  }
                  const change = (v: string) => {
                    setValues((x) => ({ ...x, [f.label]: v }))
                    setErrors((x) => ({ ...x, [f.label]: undefined }))
                  }
                  return (
                    <Field
                      key={f.label}
                      label={f.label}
                      htmlFor={fid}
                      required={f.required}
                      error={err}
                      hint={f.hint}
                      className={f.type === 'text' && (f.hint?.length ?? 0) > 30 ? 'sm:col-span-2' : ''}
                    >
                      {f.type === 'select' ? (
                        <select {...common} onChange={(e) => change(e.target.value)}>
                          <option value="">Choose</option>
                          {f.options?.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          {...common}
                          type={f.type === 'number' ? 'text' : f.type}
                          inputMode={f.type === 'number' ? 'numeric' : undefined}
                          max={f.type === 'date' ? today : undefined}
                          onChange={(e) => change(e.target.value)}
                        />
                      )}
                    </Field>
                  )
                })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : entry ? 'Send correction for approval' : 'Add entry'}
        </button>
      </div>
    </form>
  )
}
