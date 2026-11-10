import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from '../../components/Link'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Field } from '../../components/ui/Field'
import { btnPrimary, cardClass, inputClass } from '../../components/ui/styles'
import { setOfficeHours } from '../../features/parishioner/officeHours'
import { sacramentPlural, sacraments } from '../../features/priest/sampleData'
import {
  saveDefaults,
  saveNotifications,
  useStaffSettings,
  useSyncAccount,
  type StaffDefaults,
  type StaffPrefKey,
  type StaffSettings,
} from '../../features/staff/settings/settingsApi'
import { prefOptions } from '../../features/staff/settingsData'
import { StaffLayout } from '../../layouts/StaffLayout'
import { ApiError } from '../../lib/api'
import { usePreviewState } from '../../lib/preview'
import { scrollToHash } from '../../lib/router'

const PATH = '/secretary/settings'

const sections = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'defaults', label: 'System defaults' },
]

type DefaultsForm = StaffDefaults & { officeHours: string }
type FormErrors = Partial<Record<'officeHours' | 'general', string>>

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

function PanelActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-stone-100 pt-5">{children}</div>
}

export default function StaffSettingsPage() {
  const preview = usePreviewState()
  const { settings, failed, reload } = useStaffSettings()
  const state = preview === 'loading' || preview === 'error' ? preview : failed ? 'error' : !settings ? 'loading' : 'ready'

  return (
    <StaffLayout activeHref={PATH}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Settings</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        What the system tells you about, and the choices the office pages start from. Your name, picture, and password are in{' '}
        <Link href="/secretary/profile" className="font-semibold text-forest underline underline-offset-2">
          Profile Settings
        </Link>
        .
      </p>

      {state !== 'ready' || !settings ? (
        <div className={`${cardClass} mt-6 max-w-4xl`}>
          {state === 'error' ? (
            <ErrorState what="your settings" help="If it keeps happening, tell the system administrator." onRetry={preview === 'error' ? undefined : reload} />
          ) : (
            <LoadingState what="your settings" />
          )}
        </div>
      ) : (
        <SettingsPanels initial={settings} />
      )}
    </StaffLayout>
  )
}

/** Mounted once the settings have loaded, so the form starts from what was saved. */
function SettingsPanels({ initial }: { initial: StaffSettings }) {
  const { toast } = useToast()
  const syncAccount = useSyncAccount()
  const [prefs, setPrefs] = useState(initial.notify)
  const [savingPref, setSavingPref] = useState<StaffPrefKey | null>(null)
  const start: DefaultsForm = { ...initial.defaults, officeHours: initial.office_hours }
  const [form, setForm] = useState<DefaultsForm>(start)
  const [saved, setSaved] = useState<DefaultsForm>(start)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // The bell's "Choose what you're notified about" link lands on #notifications.
  useEffect(() => {
    if (window.location.hash) scrollToHash(window.location.hash)
  }, [])

  const set = <K extends keyof DefaultsForm>(key: K, value: DefaultsForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const togglePref = async (key: StaffPrefKey) => {
    if (savingPref) return
    const on = !prefs[key]
    const label = prefOptions.find((p) => p.key === key)?.label ?? 'Notification'
    setPrefs((p) => ({ ...p, [key]: on }))
    setSavingPref(key)
    try {
      const s = await saveNotifications({ [key]: on })
      setPrefs(s.notify)
      syncAccount(s)
      toast(`${label}: ${on ? 'on' : 'off'}.`)
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: !on }))
      toast(e instanceof ApiError && e.status === 0 ? e.message : `Couldn’t change “${label}”. Try again.`)
    } finally {
      setSavingPref(null)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!form.officeHours.trim()) {
      setErrors({ officeHours: 'Enter the office hours parishioners should see.' })
      return document.getElementById('df-hours')?.focus()
    }
    if (!dirty) return toast('Nothing changed, so there was nothing to save.')
    setSaving(true)
    setErrors({})
    try {
      const s = await saveDefaults(form)
      const next = { ...s.defaults, officeHours: s.office_hours }
      setForm(next)
      setSaved(next)
      syncAccount(s)
      setOfficeHours(s.office_hours)
      toast('Defaults saved.')
    } catch (err) {
      if (err instanceof ApiError && err.field('office_hours')) {
        setErrors({ officeHours: err.field('office_hours') })
        document.getElementById('df-hours')?.focus()
      } else {
        setErrors({ general: err instanceof ApiError && err.status !== 422 ? err.message : 'Couldn’t save the defaults. Check the choices and try again.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const select = (id: string, label: string, key: keyof StaffDefaults, options: Array<[string, string]>) => (
    <Field label={label} htmlFor={id}>
      <select id={id} value={form[key]} onChange={(e) => set(key, e.target.value as DefaultsForm[typeof key])} className={inputClass}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  )

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,56rem)]">
      {/* Jump links for a long page; on phones the sections simply follow one another. */}
      <nav aria-label="Settings sections" className="max-lg:hidden lg:sticky lg:top-24">
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex min-h-11 items-center rounded-lg px-3 font-medium text-stone-700 hover:bg-white hover:text-forest">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6">
        <Panel
          id="notifications"
          title="Notification preferences"
          description="Changes save as soon as you switch them. Notifications show under the bell at the top of every page."
        >
          <ul className="divide-y divide-stone-100">
            {prefOptions.map((p) => {
              const on = prefs[p.key]
              return (
                <li key={p.key} className="flex items-center justify-between gap-4 py-3.5">
                  <div>
                    <p id={`pref-${p.key}`} className="font-medium text-stone-800">
                      {p.label}
                    </p>
                    <p id={`pref-${p.key}-hint`} className="text-sm text-stone-600">
                      {p.hint}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby={`pref-${p.key}`}
                    aria-describedby={`pref-${p.key}-hint`}
                    aria-busy={savingPref === p.key || undefined}
                    onClick={() => togglePref(p.key)}
                    className="grid h-11 w-14 shrink-0 place-items-center rounded-full"
                  >
                    <span
                      className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-forest' : 'bg-stone-500'} ${savingPref === p.key ? 'opacity-60' : ''}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel id="defaults" title="System defaults" description="Where the office pages start for you. You can still change any of these on the page itself.">
          <form noValidate onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              {select(
                'df-register',
                'Sacramental Records opens on',
                'register',
                sacraments.map((s) => [s, `${sacramentPlural[s]} register`]),
              )}
              {select('df-view', 'Appointments calendar opens in', 'calendarView', [
                ['month', 'Month view'],
                ['week', 'Week view'],
                ['day', 'Day view'],
              ])}
              {select('df-period', 'Reports start with', 'reportPeriod', [
                ['last12', 'The last 12 months'],
                ['year', 'This year so far'],
              ])}
              {select('df-rows', 'Rows per page in lists', 'pageSize', [
                ['10', '10 rows'],
                ['25', '25 rows'],
                ['50', '50 rows'],
              ])}
            </div>

            <h3 className="mt-7 font-semibold text-stone-900">Parish office</h3>
            <p className="text-sm text-stone-600">Shared by everyone on staff.</p>
            <Field
              label="Office hours"
              htmlFor="df-hours"
              required
              error={errors.officeHours}
              hint="Shown to parishioners on the public pages, the Track page, and the parish assistant."
              className="mt-3"
            >
              <input
                id="df-hours"
                value={form.officeHours}
                maxLength={120}
                onChange={(e) => {
                  set('officeHours', e.target.value)
                  setErrors({})
                }}
                aria-invalid={errors.officeHours ? true : undefined}
                aria-describedby={errors.officeHours ? 'df-hours-error' : 'df-hours-hint'}
                className={inputClass}
              />
            </Field>
            {errors.general && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {errors.general}
              </p>
            )}
            <PanelActions>
              {dirty && <p className="mr-auto text-sm text-brown">You have unsaved changes.</p>}
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save defaults'}
              </button>
            </PanelActions>
          </form>
        </Panel>
      </div>
    </div>
  )
}
