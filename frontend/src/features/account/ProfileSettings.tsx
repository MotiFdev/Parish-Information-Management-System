import { useRef, useState, type ComponentType, type FormEvent, type ReactNode } from 'react'
import { useToast } from '../../components/toast/toastContext'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../components/ui/styles'
import { api, ApiError } from '../../lib/api'
import { useAuth, type AuthUser } from '../auth/authContext'
import { useAccountName } from '../auth/useAccountName'
import { Avatar } from './Avatar'

/** What the server accepts (ProfileController::storePhoto). */
const PHOTO_MAX_MB = 2
const PHOTO_TYPES = /\.(jpe?g|png|webp)$/i

type Layout = ComponentType<{ activeHref: string; children: ReactNode }>

function Panel({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-24 p-5 sm:p-7 ${cardClass}`}>
      <h2 id={`${id}-title`} className="font-serif text-2xl font-semibold text-stone-900">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-stone-100 pt-5">{children}</div>
}

/**
 * Profile Settings, shared by the priest, staff, GKK and PYA-KKK, and PPC
 * portals: profile picture, name, and password. Everything here is saved.
 */
export function ProfileSettings({ layout: PortalLayout, path }: { layout: Layout; path: string }) {
  const { user, setUser } = useAuth()
  const account = useAccountName()

  return (
    <PortalLayout activeHref={path}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Profile Settings</h1>
      <p className="mt-1 max-w-2xl text-stone-600">Your picture, your name, and your password.</p>

      {/* RequireRole guarantees a signed-in user here. */}
      {user && (
        <div className="mt-6 max-w-3xl space-y-6">
          <PhotoPanel user={user} initials={account.initials} name={account.full} onSaved={setUser} />
          <NamePanel key={user.user_id} user={user} onSaved={setUser} />
          <PasswordPanel />
        </div>
      )}
    </PortalLayout>
  )
}

function PhotoPanel({ user, initials, name, onSaved }: { user: AuthUser; initials: string; name: string; onSaved: (u: AuthUser) => void }) {
  const { toast } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState<string>()

  const upload = async (file: File) => {
    if (!PHOTO_TYPES.test(file.name)) return setError('Upload a JPG, PNG, or WebP picture.')
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) return setError(`The picture is too large. The limit is ${PHOTO_MAX_MB} MB.`)
    setError(undefined)
    setBusy('upload')
    const body = new FormData()
    body.append('photo', file)
    try {
      const r = await api<{ user: AuthUser }>('/api/auth/profile/photo', {
        method: 'POST',
        body,
      })
      onSaved(r.user)
      toast('Profile picture updated.')
    } catch (e) {
      setError(e instanceof ApiError ? (e.field('photo') ?? e.message) : 'Could not upload the picture. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setError(undefined)
    setBusy('remove')
    try {
      const r = await api<{ user: AuthUser }>('/api/auth/profile/photo', {
        method: 'DELETE',
      })
      onSaved(r.user)
      toast('Profile picture removed.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove the picture. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel id="photo" title="Profile picture" description="Shown beside your name at the top of every page.">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar photoUrl={user.photo_url} initials={initials} className="size-24 text-3xl" />
        <div className="min-w-0">
          <p className="font-semibold break-words text-stone-900">{name}</p>
          <p className="text-sm text-stone-600">{user.role.name}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => input.current?.click()} disabled={busy !== null} className={btnPrimary}>
              <Icon name="upload" className="size-4" />
              {busy === 'upload' ? 'Uploading…' : user.photo_url ? 'Change picture' : 'Upload picture'}
            </button>
            {user.photo_url && (
              <button type="button" onClick={remove} disabled={busy !== null} className={btnSecondary}>
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
          <input
            ref={input}
            id="photo-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-label="Profile picture file"
            aria-describedby={error ? 'photo-error' : 'photo-hint'}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.target.value = ''
            }}
          />
          {error ? (
            <p id="photo-error" role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          ) : (
            <p id="photo-hint" className="mt-2 text-sm text-stone-500">
              JPG, PNG, or WebP, up to {PHOTO_MAX_MB} MB. A square picture works best.
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function NamePanel({ user, onSaved }: { user: AuthUser; onSaved: (u: AuthUser) => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [saving, setSaving] = useState(false)
  const unchanged = form.first_name.trim() === (user.first_name ?? '') && form.last_name.trim() === (user.last_name ?? '')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const next = {
      first_name: form.first_name.trim() ? undefined : 'Enter your first name.',
      last_name: form.last_name.trim() ? undefined : 'Enter your last name.',
    }
    setErrors(next)
    const first = (['first_name', 'last_name'] as const).find((k) => next[k])
    if (first) return document.getElementById(`pf-${first}`)?.focus()
    if (unchanged) return toast('Nothing changed, so there was nothing to save.')

    setSaving(true)
    try {
      const r = await api<{ user: AuthUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
        },
      })
      onSaved(r.user)
      setForm({
        first_name: r.user.first_name ?? '',
        last_name: r.user.last_name ?? '',
      })
      toast('Profile saved.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422)
        setErrors({
          first_name: err.field('first_name'),
          last_name: err.field('last_name'),
        })
      else toast(err instanceof ApiError ? err.message : 'Could not save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const nameInput = (key: keyof typeof form, label: string, autoComplete: string) => (
    <Field label={label} htmlFor={`pf-${key}`} required error={errors[key]}>
      <input
        id={`pf-${key}`}
        autoComplete={autoComplete}
        maxLength={100}
        value={form[key]}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }))
          setErrors((x) => ({ ...x, [key]: undefined }))
        }}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `pf-${key}-error` : undefined}
        className={inputClass}
      />
    </Field>
  )

  return (
    <Panel id="profile" title="Profile" description="Your name appears on the work you do here and in the activity log.">
      <form noValidate onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2">
          {nameInput('first_name', 'First name', 'given-name')}
          {nameInput('last_name', 'Last name', 'family-name')}
          <Field label="Email" htmlFor="pf-email" hint="Only the system administrator can change this.">
            <input id="pf-email" type="email" value={user.email} readOnly aria-describedby="pf-email-hint" className={inputClass} />
          </Field>
          <Field label="Username" htmlFor="pf-username" hint="You can sign in with this or your email.">
            <input id="pf-username" value={user.username} readOnly aria-describedby="pf-username-hint" className={inputClass} />
          </Field>
        </div>
        <Actions>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </Actions>
      </form>
    </Panel>
  )
}

const passwordFields = [
  ['current_password', 'Current password', 'current-password'],
  ['password', 'New password', 'new-password'],
  ['password_confirmation', 'Confirm new password', 'new-password'],
] as const

type PasswordKey = (typeof passwordFields)[number][0]

function PasswordPanel() {
  const { toast } = useToast()
  const empty = {
    current_password: '',
    password: '',
    password_confirmation: '',
  }
  const [form, setForm] = useState<Record<PasswordKey, string>>(empty)
  const [errors, setErrors] = useState<Partial<Record<PasswordKey, string>>>({})
  const [saving, setSaving] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const next: Partial<Record<PasswordKey, string>> = {
      current_password: form.current_password ? undefined : 'Enter your current password.',
      password:
        form.password.length < 8
          ? 'Use at least 8 characters.'
          : !/[a-z]/i.test(form.password) || !/\d/.test(form.password)
            ? 'Use both letters and numbers.'
            : form.password === form.current_password
              ? 'Choose a password different from your current one.'
              : undefined,
      password_confirmation: form.password_confirmation !== form.password ? 'The passwords do not match.' : undefined,
    }
    setErrors(next)
    const first = passwordFields.map(([k]) => k).find((k) => next[k])
    if (first) return document.getElementById(`pw-${first}`)?.focus()

    setSaving(true)
    try {
      const r = await api<{ message: string }>('/api/auth/password', {
        method: 'PUT',
        body: form,
      })
      setForm(empty)
      toast(r.message)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const fieldErrors = Object.fromEntries(passwordFields.map(([k]) => [k, err.field(k)]))
        setErrors(fieldErrors)
        const bad = passwordFields.map(([k]) => k).find((k) => fieldErrors[k])
        if (bad) document.getElementById(`pw-${bad}`)?.focus()
      } else toast(err instanceof ApiError ? err.message : 'Could not change your password. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel id="password" title="Password" description="You stay signed in here. Other devices signed in to your account are signed out.">
      <form noValidate onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-3">
          {passwordFields.map(([key, label, autoComplete]) => (
            <Field
              key={key}
              label={label}
              htmlFor={`pw-${key}`}
              error={errors[key]}
              hint={key === 'password' ? 'At least 8 characters, with letters and numbers.' : undefined}
            >
              <input
                id={`pw-${key}`}
                type="password"
                autoComplete={autoComplete}
                value={form[key]}
                onChange={(e) => {
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                  setErrors((x) => ({ ...x, [key]: undefined }))
                }}
                aria-invalid={errors[key] ? true : undefined}
                aria-describedby={errors[key] ? `pw-${key}-error` : key === 'password' ? 'pw-password-hint' : undefined}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
        <Actions>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </Actions>
      </form>
    </Panel>
  )
}
