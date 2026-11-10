import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { ministries, positions, type Chapel, type Officer, type SonaOption } from './chapelsData'

const TITLE = 'chd-title'

export function FormShell({ title, intro, label, busy, onClose, onSubmit, children }: { title: string; intro?: ReactNode; label: string; busy?: boolean; onClose: () => void; onSubmit: (e: FormEvent) => void; children: ReactNode }) {
  return (
    <form noValidate onSubmit={onSubmit}>
      <div className="px-6 pt-5 pb-4">
        <h2 id={TITLE} className="font-serif text-2xl font-semibold text-stone-900">
          {title}
        </h2>
        {intro && <div className="mt-1 text-stone-700">{intro}</div>}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </form>
  )
}

const errorProps = (id: string, error?: string, hint?: boolean) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
})

/* ---------- Add or edit a chapel ---------- */

export type ChapelInput = Omit<Chapel, 'id' | 'status' | 'reviewNote'>

/** onSave resolves with field errors from the server (empty when saved), so the form can show them. */
type SaveResult = Promise<Record<string, string>>

export function ChapelDialog({ sonas, chapel, onClose, onSave }: { sonas: SonaOption[]; chapel: Chapel | 'new' | null; onClose: () => void; onSave: (c: ChapelInput) => SaveResult }) {
  return (
    <Dialog open={chapel !== null} onClose={onClose} labelledBy={TITLE}>
      {chapel && <ChapelForm key={chapel === 'new' ? 'new' : chapel.id} sonas={sonas} chapel={chapel === 'new' ? undefined : chapel} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function ChapelForm({ sonas, chapel, onClose, onSave }: { sonas: SonaOption[]; chapel?: Chapel; onClose: () => void; onSave: (c: ChapelInput) => SaveResult }) {
  const [f, setF] = useState<ChapelInput>(
    chapel
      ? { sonaId: chapel.sonaId, name: chapel.name, patron: chapel.patron, fiesta: chapel.fiesta, contact: chapel.contact, fbAccount: chapel.fbAccount, active: chapel.active }
      : { sonaId: '', name: '', patron: '', fiesta: '', contact: '', fbAccount: '', active: true },
  )
  const [errors, setErrors] = useState<{ sonaId?: string; name?: string }>({})
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<ChapelInput>) => {
    setF((x) => ({ ...x, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }

  return (
    <FormShell
      title={chapel ? `Edit ${chapel.name}` : 'Add chapel'}
      intro={!chapel ? 'The PPC approves new chapels. Officers can be added once it is approved.' : chapel.status === 'Rejected' ? 'Saving sends this chapel back to the PPC.' : undefined}
      label={chapel ? (chapel.status === 'Rejected' ? 'Save and send to PPC' : 'Save changes') : 'Send to PPC'}
      busy={busy}
      onClose={onClose}
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const next = { sonaId: f.sonaId ? undefined : 'Choose the Sona this chapel belongs to.', name: f.name.trim() ? undefined : 'Enter the chapel name.' }
        setErrors(next)
        if (next.sonaId) return document.getElementById('chf-sona')?.focus()
        if (next.name) return document.getElementById('chf-name')?.focus()
        setBusy(true)
        const server = await onSave({ ...f, name: f.name.trim(), patron: f.patron.trim(), fiesta: f.fiesta.trim(), contact: f.contact.trim(), fbAccount: f.fbAccount.trim() })
        setBusy(false)
        setErrors(server)
        const firstBad = server.sonaId ? 'chf-sona' : server.name ? 'chf-name' : null
        if (firstBad) document.getElementById(firstBad)?.focus()
      }}
    >
      <Field label="Sona" htmlFor="chf-sona" required error={errors.sonaId}>
        <select {...errorProps('chf-sona', errors.sonaId)} value={f.sonaId} onChange={(e) => set({ sonaId: e.target.value })} className={inputClass}>
          <option value="">Choose a Sona</option>
          {sonas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Chapel name" htmlFor="chf-name" required error={errors.name}>
        <input {...errorProps('chf-name', errors.name)} value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Patron" htmlFor="chf-patron">
          <input id="chf-patron" value={f.patron} onChange={(e) => set({ patron: e.target.value })} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Fiesta" htmlFor="chf-fiesta" hint="A date or a rule, such as Last Sunday of September.">
          <input {...errorProps('chf-fiesta', undefined, true)} value={f.fiesta} onChange={(e) => set({ fiesta: e.target.value })} maxLength={50} className={inputClass} />
        </Field>
        <Field label="Contact number" htmlFor="chf-contact">
          <input id="chf-contact" type="tel" inputMode="tel" value={f.contact} onChange={(e) => set({ contact: e.target.value })} maxLength={20} className={inputClass} />
        </Field>
        <Field label="Facebook account name" htmlFor="chf-fb">
          <input id="chf-fb" value={f.fbAccount} onChange={(e) => set({ fbAccount: e.target.value })} maxLength={100} className={inputClass} />
        </Field>
      </div>
      {chapel && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 px-3 py-2.5">
          <input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} className="mt-1 size-4 accent-forest" />
          <span className="text-sm">
            <span className="block font-semibold text-stone-900">Active chapel</span>
            <span className="block text-stone-600">Clear this for a chapel that has closed. It stays in the directory with its officer history.</span>
          </span>
        </label>
      )}
    </FormShell>
  )
}

/* ---------- Add or edit an officer ---------- */

export type OfficerInput = Omit<Officer, 'id' | 'status' | 'reviewNote'>

export function OfficerDialog({
  sonas,
  officer,
  chapels,
  all,
  onClose,
  onSave,
}: {
  sonas: SonaOption[]
  /** An existing officer, or the chapel and term a new one starts in. */
  officer: Officer | { chapelId: string; term: number } | null
  chapels: Chapel[]
  all: Officer[]
  onClose: () => void
  onSave: (o: OfficerInput) => SaveResult
}) {
  return (
    <Dialog open={officer !== null} onClose={onClose} labelledBy={TITLE}>
      {officer && <OfficerForm key={'id' in officer ? officer.id : 'new'} sonas={sonas} officer={officer} chapels={chapels} all={all} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function OfficerForm({
  sonas,
  officer,
  chapels,
  all,
  onClose,
  onSave,
}: {
  sonas: SonaOption[]
  officer: Officer | { chapelId: string; term: number }
  chapels: Chapel[]
  all: Officer[]
  onClose: () => void
  onSave: (o: OfficerInput) => SaveResult
}) {
  const existing = 'id' in officer ? officer : undefined
  const [f, setF] = useState({
    chapelId: officer.chapelId,
    term: String(officer.term),
    name: existing?.name ?? '',
    position: existing?.position ?? '',
    ministry: existing?.ministry ?? '',
    age: existing?.age != null ? String(existing.age) : '',
    contact: existing?.contact ?? '',
    fb: existing?.fb ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }
  const chapel = chapels.find((c) => c.id === f.chapelId)
  // A second president in the same term is allowed but called out, since the spec does not forbid it.
  const otherPresident = f.position === 'President' && all.find((o) => o.position === 'President' && o.chapelId === f.chapelId && String(o.term) === f.term && o.id !== existing?.id)

  return (
    <FormShell
      title={existing ? `Edit ${existing.name}` : 'Add officer'}
      intro={
        <>
          {chapel && `${chapel.name}, ${f.term || 'no'} term. `}
          {!existing ? 'The PPC approves new officers before they can be assigned to events.' : existing.status === 'Rejected' ? 'Saving sends this officer back to the PPC.' : ''}
        </>
      }
      label={existing ? (existing.status === 'Rejected' ? 'Save and send to PPC' : 'Save changes') : 'Send to PPC'}
      busy={busy}
      onClose={onClose}
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const next: Record<string, string | undefined> = {
          chapelId: f.chapelId ? undefined : 'Choose a chapel.',
          name: f.name.trim() ? undefined : 'Enter the officer’s name.',
          position: f.position ? undefined : 'Choose a position.',
          term: /^\d{4}$/.test(f.term) ? undefined : 'Enter the term as a year, such as 2026.',
          age: !f.age || (/^\d{1,3}$/.test(f.age) && Number(f.age) >= 12) ? undefined : 'Enter the age in years, or leave it blank.',
        }
        setErrors(next)
        const firstBad = ['chapelId', 'name', 'position', 'term', 'age'].find((k) => next[k])
        if (firstBad) return document.getElementById(`of-${firstBad}`)?.focus()
        setBusy(true)
        const server = await onSave({ chapelId: f.chapelId, term: Number(f.term), name: f.name.trim(), position: f.position, ministry: f.ministry, age: f.age ? Number(f.age) : null, contact: f.contact.trim(), fb: f.fb.trim() })
        setBusy(false)
        setErrors(server)
        const firstServer = ['chapelId', 'name', 'position', 'term', 'age'].find((k) => server[k])
        if (firstServer) document.getElementById(`of-${firstServer}`)?.focus()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field label="Chapel" htmlFor="of-chapelId" required error={errors.chapelId}>
          <select {...errorProps('of-chapelId', errors.chapelId)} value={f.chapelId} onChange={(e) => set({ chapelId: e.target.value })} className={inputClass}>
            <option value="">Choose a chapel</option>
            {sonas.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {chapels
                  .filter((c) => c.sonaId === s.id && (c.status === 'Approved' || c.id === officer.chapelId))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Term" htmlFor="of-term" required error={errors.term}>
          <input {...errorProps('of-term', errors.term)} inputMode="numeric" maxLength={4} value={f.term} onChange={(e) => set({ term: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field label="Full name" htmlFor="of-name" required error={errors.name}>
        <input {...errorProps('of-name', errors.name)} value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={150} autoComplete="off" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field label="Position" htmlFor="of-position" required error={errors.position}>
            <select {...errorProps('of-position', errors.position)} value={f.position} onChange={(e) => set({ position: e.target.value })} className={inputClass}>
              <option value="">Choose a position</option>
              {/* Keeps a position that came in from an import even if it is not one of the usual ones. */}
              {[...positions, ...(f.position && !(positions as readonly string[]).includes(f.position) ? [f.position] : [])].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          {otherPresident && <p className="mt-1.5 text-sm font-semibold text-brown">{otherPresident.name} is already President for this term.</p>}
        </div>
        <Field label="Ministry" htmlFor="of-ministry">
          <select id="of-ministry" value={f.ministry} onChange={(e) => set({ ministry: e.target.value })} className={inputClass}>
            <option value="">No ministry</option>
            {[...ministries, ...(f.ministry && !(ministries as readonly string[]).includes(f.ministry) ? [f.ministry] : [])].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Age" htmlFor="of-age" error={errors.age}>
          <input {...errorProps('of-age', errors.age)} inputMode="numeric" maxLength={3} value={f.age} onChange={(e) => set({ age: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Contact number" htmlFor="of-contact">
          <input id="of-contact" type="tel" inputMode="tel" value={f.contact} onChange={(e) => set({ contact: e.target.value })} maxLength={20} className={inputClass} />
        </Field>
      </div>
      <Field label="Facebook account" htmlFor="of-fb">
        <input id="of-fb" value={f.fb} onChange={(e) => set({ fb: e.target.value })} maxLength={100} className={inputClass} />
      </Field>
    </FormShell>
  )
}
