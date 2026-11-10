import { useState, type FormEvent } from 'react'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, inputClass } from '../../../components/ui/styles'
import { navigate } from '../../../lib/router'
import { parseReference, trackHref } from './reference'

/** One box for both kinds of reference; the prefix (RR or AP) says which it is. */
export function TrackForm({ initial = '', id = 'track-reference' }: { initial?: string; id?: string }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string>()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseReference(value)
    if (!parsed) {
      setError(
        value.trim()
          ? 'That doesn’t look like a reference number. It starts with RR or AP, followed by eight letters and numbers.'
          : 'Enter your reference number.',
      )
      document.getElementById(id)?.focus()
      return
    }
    setError(undefined)
    navigate(trackHref(parsed.reference))
  }

  return (
    <form noValidate onSubmit={submit} role="search" aria-label="Track a request or appointment">
      <Field label="Reference number" htmlFor={id} error={error} hint="It was shown when you sent the request, e.g. RR-7K3M-9QX2 or AP-7K3M-9QX2.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(undefined)
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="RR-XXXX-XXXX"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`${inputClass} font-mono uppercase placeholder:normal-case sm:flex-1`}
          />
          <button type="submit" className={btnPrimary}>
            <Icon name="search" className="size-4" />
            Track
          </button>
        </div>
      </Field>
    </form>
  )
}
