import { useState, type FormEvent, type ReactNode } from 'react'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { bornLabel, fullName, type DirectorySona, type Parishioner, type Sex } from './parishionerData'

export type ParishionerInput = Omit<Parishioner, 'id' | 'archived' | 'sacraments'>

const blank: ParishionerInput = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  sex: '',
  dateOfBirth: '',
  placeOfBirth: '',
  contact: '',
  email: '',
  street: '',
  barangay: '',
  city: '',
  sonaId: '',
  chapelId: '',
  fatherId: null,
  motherId: null,
}

type Key = keyof ParishionerInput
type Errors = Partial<Record<Key, string>>

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-stone-100 px-5 py-5 first:border-t-0">
      <legend className="sr-only">{title}</legend>
      <h3 aria-hidden="true" className="mb-3 font-semibold text-stone-900">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

/** Search the directory and pick one person; shows the choice with Change and Remove once picked. */
function PersonPicker({
  id,
  label,
  value,
  options,
  onChange,
  error,
  hint,
}: {
  id: string
  label: string
  value: string | null
  options: Parishioner[]
  onChange: (id: string | null) => void
  error?: string
  hint?: string
}) {
  const [q, setQ] = useState('')
  const chosen = options.find((o) => o.id === value)
  const query = q.trim().toLowerCase()
  const matches = query.length >= 2 ? options.filter((o) => fullName(o).toLowerCase().includes(query)).slice(0, 6) : []

  return (
    <Field label={label} htmlFor={id} error={error} hint={chosen ? undefined : hint}>
      {chosen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2">
          <span id={id} className="min-w-0 flex-1 text-[15px] text-stone-900">
            {fullName(chosen)} <span className="text-stone-600">· {bornLabel(chosen)}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Change ${label.toLowerCase()}`}
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-forest hover:bg-forest-soft"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type at least two letters of the name"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            className={inputClass}
          />
          {query.length >= 2 && (
            <ul aria-label={`Matches for ${label.toLowerCase()}`} className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white">
              {matches.length ? (
                matches.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.id)
                        setQ('')
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-forest-soft"
                    >
                      <span className="font-medium text-stone-900">{fullName(o)}</span>
                      <span className="text-stone-600">{bornLabel(o)}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2.5 text-sm text-stone-600">No one by that name. Add the parent first, then link them here.</li>
              )}
            </ul>
          )}
        </>
      )}
    </Field>
  )
}

interface Props {
  person?: Parishioner
  all: Parishioner[]
  sonas: DirectorySona[]
  /** Saves; resolves with the server's errors when it refuses. */
  onSave: (input: ParishionerInput) => Promise<Errors | void>
  onCancel: () => void
}

// Add and Edit share this form (section 4.3: personal details and family tree;
// the address includes Sona and Chapel).
export function ParishionerForm({ person, all, sonas, onSave, onCancel }: Props) {
  const [form, setForm] = useState<ParishionerInput>(person ? { ...person } : blank)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const sona = sonas.find((s) => s.id === form.sonaId)
  const others = all.filter((p) => p.id !== person?.id)

  const set = <K extends Key>(k: K, v: ParishionerInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  // A new record needs every required field. A person first written down from a register book may
  // lack some; editing them only requires what was already recorded (the server applies the same rule).
  const needed = (k: Key) => !person || Boolean(String(person[k] ?? '').trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const need = (k: Key, msg: string) => (!needed(k) || String(form[k] ?? '').trim() ? undefined : msg)
    const father = form.fatherId ? all.find((p) => p.id === form.fatherId) : undefined
    const mother = form.motherId ? all.find((p) => p.id === form.motherId) : undefined
    const olderThan = (parent?: Parishioner) => !parent || !form.dateOfBirth || !parent.dateOfBirth || parent.dateOfBirth < form.dateOfBirth
    const next: Errors = {
      firstName: need('firstName', 'Enter the first name.'),
      lastName: need('lastName', 'Enter the last name.'),
      sex: need('sex', 'Choose the sex as recorded.'),
      dateOfBirth: !form.dateOfBirth
        ? need('dateOfBirth', 'Enter the date of birth.')
        : form.dateOfBirth > today
          ? 'The date of birth can’t be in the future.'
          : undefined,
      placeOfBirth: need('placeOfBirth', 'Enter the place of birth.'),
      contact: form.contact && !/^[0-9 +()-]{7,20}$/.test(form.contact) ? 'Use digits, spaces, and + only.' : undefined,
      email: form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter an email address like name@example.com.' : undefined,
      street: need('street', 'Enter the street or purok.'),
      barangay: need('barangay', 'Enter the barangay.'),
      city: need('city', 'Enter the city or municipality.'),
      sonaId: need('sonaId', 'Choose the Sona.'),
      chapelId: need('chapelId', 'Choose the chapel.'),
      fatherId: olderThan(father) ? undefined : 'The father must be born before this parishioner.',
      motherId: olderThan(mother) ? undefined : 'The mother must be born before this parishioner.',
    }
    setErrors(next)
    const first = (Object.keys(next) as Key[]).find((k) => next[k])
    if (first) return document.getElementById(`pf-${first}`)?.focus()
    setSaving(true)
    const refused = await onSave(form).finally(() => setSaving(false))
    if (refused) {
      setErrors(refused)
      const bad = (Object.keys(refused) as Key[]).find((k) => refused[k])
      if (bad) document.getElementById(`pf-${bad}`)?.focus()
    }
  }

  const text = (k: Key, label: string, opts: { required?: boolean; type?: string; autoComplete?: string; hint?: string; className?: string } = {}) => (
    <Field label={label} htmlFor={`pf-${k}`} required={opts.required} error={errors[k]} hint={opts.hint} className={opts.className}>
      <input
        id={`pf-${k}`}
        type={opts.type ?? 'text'}
        autoComplete={opts.autoComplete ?? 'off'}
        value={String(form[k] ?? '')}
        max={opts.type === 'date' ? today : undefined}
        onChange={(e) => set(k, e.target.value as never)}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `pf-${k}-error` : opts.hint ? `pf-${k}-hint` : undefined}
        className={inputClass}
      />
    </Field>
  )

  return (
    <form noValidate onSubmit={submit} aria-labelledby="pf-title" className="flex h-full flex-col bg-white">
      <header className="flex items-start gap-3 border-b border-stone-200 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h2 id="pf-title" className="font-serif text-3xl font-semibold text-stone-900">
            {person ? `Edit ${fullName(person)}` : 'Add parishioner'}
          </h2>
          <p className="text-sm text-stone-600">Fields marked * are required.</p>
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
        <Group title="Name">
          {text('firstName', 'First name', { required: true, autoComplete: 'given-name' })}
          {text('middleName', 'Middle name', { autoComplete: 'additional-name' })}
          {text('lastName', 'Last name', { required: true, autoComplete: 'family-name' })}
          {text('suffix', 'Suffix', { hint: 'Jr., Sr., III' })}
        </Group>

        <Group title="Personal details">
          <fieldset aria-describedby={errors.sex ? 'pf-sex-error' : undefined}>
            <legend className="mb-1.5 text-sm font-medium text-stone-700">Sex{needed('sex') && <span className="text-red-600"> *</span>}</legend>
            <div className="flex gap-2">
              {(['Female', 'Male'] as Sex[]).map((s, i) => (
                <label
                  key={s}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 ${form.sex === s ? 'border-forest bg-forest-soft text-forest' : 'border-stone-300 bg-white text-stone-800'}`}
                >
                  <input
                    id={i === 0 ? 'pf-sex' : undefined}
                    type="radio"
                    name="pf-sex"
                    checked={form.sex === s}
                    onChange={() => set('sex', s)}
                    className="size-4 accent-forest"
                  />
                  {s}
                </label>
              ))}
            </div>
            {errors.sex && (
              <p id="pf-sex-error" className="mt-1.5 text-sm text-red-700">
                {errors.sex}
              </p>
            )}
          </fieldset>
          {text('dateOfBirth', 'Date of birth', { required: needed('dateOfBirth'), type: 'date' })}
          {text('placeOfBirth', 'Place of birth', { required: needed('placeOfBirth'), className: 'sm:col-span-2' })}
        </Group>

        <Group title="Contact">
          {text('contact', 'Contact number', { type: 'tel', autoComplete: 'tel' })}
          {text('email', 'Email', { type: 'email', autoComplete: 'email' })}
        </Group>

        <Group title="Address">
          {text('street', 'Street or purok', { required: needed('street'), autoComplete: 'address-line1', className: 'sm:col-span-2' })}
          {text('barangay', 'Barangay', { required: needed('barangay') })}
          {text('city', 'City or municipality', { required: needed('city'), autoComplete: 'address-level2' })}
          <Field label="Sona" htmlFor="pf-sonaId" required={needed('chapelId')} error={errors.sonaId}>
            <select
              id="pf-sonaId"
              value={form.sonaId}
              onChange={(e) => {
                set('sonaId', e.target.value)
                set('chapelId', sonas.find((s) => s.id === e.target.value)?.chapels.filter((c) => c.active)[0]?.id ?? '')
              }}
              aria-invalid={errors.sonaId ? true : undefined}
              className={inputClass}
            >
              <option value="">Choose a Sona</option>
              {sonas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chapel" htmlFor="pf-chapelId" required={needed('chapelId')} error={errors.chapelId} hint={sona ? undefined : 'Choose the Sona first.'}>
            <select
              id="pf-chapelId"
              value={form.chapelId}
              onChange={(e) => set('chapelId', e.target.value)}
              disabled={!sona}
              aria-invalid={errors.chapelId ? true : undefined}
              className={`${inputClass} disabled:bg-stone-50`}
            >
              <option value="">{sona ? 'Choose a chapel' : 'Choose the Sona first'}</option>
              {sona?.chapels
                .filter((c) => c.active || c.id === person?.chapelId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.active ? '' : ' (inactive)'}
                  </option>
                ))}
            </select>
          </Field>
        </Group>

        <Group title="Family tree">
          <PersonPicker
            id="pf-fatherId"
            label="Father"
            value={form.fatherId}
            options={others.filter((p) => p.sex === 'Male')}
            onChange={(v) => set('fatherId', v)}
            error={errors.fatherId}
            hint="Link a parishioner already in the directory."
          />
          <PersonPicker
            id="pf-motherId"
            label="Mother"
            value={form.motherId}
            options={others.filter((p) => p.sex === 'Female')}
            onChange={(v) => set('motherId', v)}
            error={errors.motherId}
            hint="Link a parishioner already in the directory."
          />
          <p className="text-sm text-stone-600 sm:col-span-2">Children are linked from their own records, by choosing this person as their father or mother.</p>
        </Group>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {saving ? 'Saving…' : person ? 'Save changes' : 'Add parishioner'}
        </button>
      </div>
    </form>
  )
}
