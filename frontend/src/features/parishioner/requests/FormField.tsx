import type { ChangeEvent } from 'react'
import { Field } from '../../../components/ui/Field'
import { inputClass } from '../../../components/ui/styles'
import type { FieldDef } from './recordTypes'

interface FormFieldProps {
  field: FieldDef
  value: string
  required: boolean
  error?: string
  onChange: (value: string) => void
}

/** One field of the record request form, used when sending a request and when correcting its details. */
export function FormField({ field: f, value, required, error, onChange }: FormFieldProps) {
  const common = {
    id: f.name,
    value,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${f.name}-error` : undefined,
    className: inputClass,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(e.target.value),
  }

  return (
    <Field label={f.label} htmlFor={f.name} required={required} error={error} hint={f.hint} className={f.wide ? 'sm:col-span-2' : ''}>
      {f.type === 'select' ? (
        <select {...common}>
          <option value="">Select…</option>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={f.type ?? 'text'} min={f.type === 'number' ? 0 : undefined} />
      )}
    </Field>
  )
}
