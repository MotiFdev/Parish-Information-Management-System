import { useId } from 'react'
import { inputClass } from '../../../components/ui/styles'
import { sacraments, type Sacrament } from '../../priest/sampleData'
import { fileLabels, type LinkChoice, type LinkKind, type LinkTargets } from './documentsData'

interface Props {
  value: LinkChoice
  targets: LinkTargets
  onChange: (c: LinkChoice) => void
  /** Shown under the record choice when it is missing. */
  error?: string
}

/**
 * The record-linking dropdown from section 4.3: choose what the file belongs to,
 * then which one. Each step is a plain select so it works by keyboard and on phones.
 */
export function LinkPicker({ value, targets, onChange, error }: Props) {
  const uid = useId()
  const { kind } = value
  const errorId = `${uid}-error`
  const entries = targets.entries.filter((e) => e.type === value.type)

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label htmlFor={`${uid}-kind`} className="mb-1 block text-sm font-medium text-stone-700">
          Link to
        </label>
        <select id={`${uid}-kind`} value={kind} onChange={(e) => onChange({ ...value, kind: e.target.value as LinkKind, targetId: '' })} className={inputClass}>
          <option value="register">A sacramental record</option>
          <option value="request">A record request</option>
          <option value="parishioner">A parishioner</option>
          <option value="none">Nothing yet</option>
        </select>
      </div>

      {kind === 'register' && (
        <div>
          <label htmlFor={`${uid}-reg`} className="mb-1 block text-sm font-medium text-stone-700">
            Register
          </label>
          <select
            id={`${uid}-reg`}
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as Sacrament, targetId: '' })}
            className={inputClass}
          >
            {sacraments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {(kind === 'request' || kind === 'parishioner') && (
        <div>
          <label htmlFor={`${uid}-label`} className="mb-1 block text-sm font-medium text-stone-700">
            What it is
          </label>
          <select id={`${uid}-label`} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} className={inputClass}>
            {fileLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}

      {kind !== 'none' && (
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-target`} className="mb-1 block text-sm font-medium text-stone-700">
            {kind === 'register' ? 'Entry' : kind === 'request' ? 'Request' : 'Parishioner'}
            <span className="text-red-600"> *</span>
          </label>
          <select
            id={`${uid}-target`}
            value={value.targetId}
            onChange={(e) => onChange({ ...value, targetId: e.target.value })}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={inputClass}
          >
            <option value="">Choose one</option>
            {kind === 'register' &&
              entries.map((e) => (
                <option key={e.id} value={e.id}>
                  Book {e.register.book}, page {e.register.page}, line {e.register.line}: {e.subject}
                </option>
              ))}
            {kind === 'request' &&
              targets.requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}: {r.record_type.toLowerCase()} {r.request_type.toLowerCase()} for {r.subject}
                </option>
              ))}
            {kind === 'parishioner' &&
              targets.parishioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.born ? ` (born ${p.born})` : ''}
                </option>
              ))}
          </select>
          {error && (
            <p id={errorId} className="mt-1 text-sm text-red-700">
              {error}
            </p>
          )}
          {kind === 'register' && entries.length === 0 && (
            <p className="mt-1 text-xs text-stone-600">No {value.type.toLowerCase()} entries yet. Add the entry in Sacramental Records first.</p>
          )}
          {kind === 'request' && <p className="mt-1 text-xs text-stone-600">Only requests still being checked are listed.</p>}
        </div>
      )}
    </div>
  )
}
