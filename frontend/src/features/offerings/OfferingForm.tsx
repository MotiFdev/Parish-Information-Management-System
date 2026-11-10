import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { btnPrimary, btnSecondary, inputClass } from '../../components/ui/styles'
import { todayKey } from '../staff/reports/staffReports'
import { saveOffering, type Offering, type OfferingInput } from './offeringsApi'

interface Props {
  /** 'new', an entry to edit, or null when closed. */
  editing: Offering | 'new' | null
  categories: string[]
  onClose: () => void
  onSaved: (offering: Offering, isNew: boolean) => void
}

export function OfferingForm({ editing, categories, onClose, onSaved }: Props) {
  return (
    <Dialog open={editing !== null} onClose={onClose} labelledBy="offering-title">
      {editing && <Form key={editing === 'new' ? 'new' : editing.id} editing={editing} categories={categories} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

type Errors = Partial<Record<keyof OfferingInput, string>>

function Form({ editing, categories, onClose, onSaved }: Props & { editing: Offering | 'new' }) {
  const existing = editing === 'new' ? null : editing
  const [values, setValues] = useState<OfferingInput>({
    category: existing?.category ?? '',
    description: existing?.description ?? '',
    amount: existing ? existing.amount.toFixed(2) : '',
    received_on: existing?.received_on ?? todayKey(),
  })
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState<string>()
  const [busy, setBusy] = useState(false)

  const set = (k: keyof OfferingInput) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const check = (): Errors => {
    const amount = Number(values.amount.replace(/[,\s₱]/g, ''))
    return {
      category: values.category.trim() ? undefined : 'Say what the money is for, such as Sunday collection.',
      amount: !values.amount.trim()
        ? 'Enter the amount in pesos.'
        : !Number.isFinite(amount) || amount <= 0
          ? 'Enter an amount above zero, such as 1500 or 1500.50.'
          : undefined,
      received_on: !values.received_on ? 'Choose the day it was received.' : values.received_on > todayKey() ? 'Choose today or an earlier day.' : undefined,
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const found = check()
    const first = (Object.keys(found) as (keyof OfferingInput)[]).find((k) => found[k])
    if (first) {
      setErrors(found)
      return document.getElementById(`offering-${first}`)?.focus()
    }
    setBusy(true)
    setMessage(undefined)
    const result = await saveOffering(values, existing?.id)
    setBusy(false)
    if ('offering' in result) return onSaved(result.offering, !existing)
    if ('errors' in result) return setErrors(result.errors)
    setMessage(result.message)
  }

  const describedBy = (k: keyof OfferingInput, hint = false) => (errors[k] ? `offering-${k}-error` : hint ? `offering-${k}-hint` : undefined)

  return (
    <form noValidate onSubmit={submit}>
      <div className="space-y-4 px-6 pt-5 pb-4">
        <h2 id="offering-title" className="font-serif text-2xl font-semibold text-stone-900">
          {existing ? 'Edit offering' : 'Record an offering'}
        </h2>
        <Field label="Category" htmlFor="offering-category" required error={errors.category} hint="Pick one or type your own.">
          <input
            id="offering-category"
            list="offering-categories"
            value={values.category}
            onChange={(e) => set('category')(e.target.value)}
            maxLength={80}
            autoComplete="off"
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={describedBy('category', true)}
            className={inputClass}
          />
          <datalist id="offering-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₱)" htmlFor="offering-amount" required error={errors.amount}>
            <input
              id="offering-amount"
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => set('amount')(e.target.value)}
              placeholder="0.00"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={describedBy('amount')}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
          <Field label="Date received" htmlFor="offering-received_on" required error={errors.received_on}>
            <input
              id="offering-received_on"
              type="date"
              max={todayKey()}
              value={values.received_on}
              onChange={(e) => set('received_on')(e.target.value)}
              aria-invalid={errors.received_on ? true : undefined}
              aria-describedby={describedBy('received_on')}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Note" htmlFor="offering-description" error={errors.description} hint="Optional. For example: 9:00 AM Mass, or the family's name.">
          <input
            id="offering-description"
            value={values.description}
            onChange={(e) => set('description')(e.target.value)}
            maxLength={255}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy('description', true)}
            className={inputClass}
          />
        </Field>
        {message && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {message}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:cursor-wait`}>
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Record offering'}
        </button>
      </div>
    </form>
  )
}
