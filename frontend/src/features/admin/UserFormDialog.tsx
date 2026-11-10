import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../components/ui/styles'
import { ApiError } from '../../lib/api'
import { roles, type Role, type UserAccount } from './sampleData'

export interface UserFormValues {
  firstName: string
  lastName: string
  username: string
  email: string
  role: Role
}

interface Props {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when adding. */
  user?: UserAccount
  /** Accounts to check for a username or email that is already taken. The server checks again on save. */
  existing?: UserAccount[]
  /**
   * Saves the account. Rejecting with a 422 ApiError puts the server's
   * messages under the matching fields; any other error shows above the buttons.
   */
  onSave: (values: UserFormValues) => Promise<void> | void
}

const serverField: Record<string, Key> = { first_name: 'firstName', last_name: 'lastName', username: 'username', email: 'email', role: 'role' }

type Key = keyof UserFormValues
type Errors = Partial<Record<Key, string>>

const empty = { firstName: '', lastName: '', username: '', email: '', role: '' as Role | '' }

// Used by the dashboard quick action and by User Management for both adding
// and editing. New accounts get an emailed link to set their own password.
export function UserFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} labelledBy="user-form-title">
      {/* Mounted per open so the fields start from the chosen account each time. */}
      <UserForm {...props} />
    </Dialog>
  )
}

function UserForm({ onClose, user, existing = [], onSave }: Props) {
  const [form, setForm] = useState<typeof empty>(
    user ? { firstName: user.firstName, lastName: user.lastName, username: user.username, email: user.email, role: user.role } : empty,
  )
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editingSelf = Boolean(user?.current)

  const taken = (key: 'username' | 'email') =>
    existing.some((u) => u.id !== user?.id && u[key].toLowerCase() === form[key].trim().toLowerCase())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setFormError(null)
    const username = form.username.trim()
    const next: Errors = {
      firstName: form.firstName.trim() ? undefined : 'Enter a first name.',
      lastName: form.lastName.trim() ? undefined : 'Enter a last name.',
      username: !username
        ? 'Enter a username.'
        : !/^[a-z0-9._-]{3,50}$/i.test(username)
          ? 'Use 3 to 50 letters, numbers, dots, dashes, or underscores.'
          : taken('username')
            ? 'Another account already uses this username.'
            : undefined,
      email: !/^\S+@\S+\.\S+$/.test(form.email.trim())
        ? 'Enter an email address like name@example.com.'
        : taken('email')
          ? 'Another account already uses this email.'
          : undefined,
      role: form.role ? undefined : 'Choose the role this person will sign in with.',
    }
    setErrors(next)
    const firstInvalid = (Object.keys(next) as Key[]).find((k) => next[k])
    if (firstInvalid) return document.getElementById(`user-${firstInvalid}`)?.focus()

    setSaving(true)
    try {
      await onSave({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username,
        email: form.email.trim(),
        role: form.role as Role,
      })
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError && err.status === 422 && Object.keys(err.errors).length) {
        const fromServer: Errors = {}
        for (const [field, messages] of Object.entries(err.errors)) {
          const key = serverField[field]
          if (key) fromServer[key] = messages[0]
        }
        setErrors(fromServer)
        const first = (Object.keys(fromServer) as Key[])[0]
        if (first) return document.getElementById(`user-${first}`)?.focus()
      }
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const field = (key: Exclude<Key, 'role'>, label: string, type = 'text', autoComplete = 'off', hint?: string) => (
    <Field label={label} htmlFor={`user-${key}`} required error={errors[key]} hint={hint}>
      <input
        id={`user-${key}`}
        type={type}
        autoComplete={autoComplete}
        spellCheck={false}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `user-${key}-error` : undefined}
        className={inputClass}
      />
    </Field>
  )

  return (
    <form noValidate onSubmit={submit}>
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 pt-5 pb-4">
        <div>
          <h2 id="user-form-title" className="font-serif text-2xl font-semibold text-stone-900">
            {user ? `Edit ${user.firstName} ${user.lastName}` : 'Add a user'}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {user
              ? 'The role decides which portal they land in after signing in.'
              : 'They get an email with a link to set their password. The role decides which portal they land in.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        {field('firstName', 'First name', 'text', 'given-name')}
        {field('lastName', 'Last name', 'text', 'family-name')}
        {field('username', 'Username', 'text', 'off', 'Used to sign in, along with the email.')}
        {field('email', 'Email', 'email', 'email')}
        <Field
          label="Role"
          htmlFor="user-role"
          required
          error={errors.role}
          hint={editingSelf ? 'You can’t change your own role. Another administrator can.' : undefined}
          className="sm:col-span-2"
        >
          <select
            id="user-role"
            value={form.role}
            disabled={editingSelf}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            aria-invalid={errors.role ? true : undefined}
            aria-describedby={errors.role ? 'user-role-error' : undefined}
            className={`${inputClass} disabled:bg-stone-50 disabled:text-stone-600`}
          >
            <option value="">Choose a role</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {formError && (
        <p role="alert" className="mx-6 mb-4 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          <Icon name={user ? 'check' : 'userPlus'} className="size-4.5" />
          {saving ? (user ? 'Saving…' : 'Creating…') : user ? 'Save changes' : 'Create account'}
        </button>
      </div>
    </form>
  )
}
