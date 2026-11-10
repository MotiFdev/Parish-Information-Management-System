import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { LoadingState } from '../components/ui/DataState'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { PageBanner } from '../components/ui/PageBanner'
import { btnPrimary, btnSecondary, cardClass, chipClass, inputClass } from '../components/ui/styles'
import { bookAppointment } from '../features/parishioner/appointments/appointmentsApi'
import { SlotPicker } from '../features/parishioner/appointments/SlotPicker'
import { apiVenue, formatSlot, useAvailability, type Slot, type VenueType } from '../features/parishioner/appointments/slots'
import { parish, type Appointment } from '../features/parishioner/sampleData'
import { SubmittedConfirmation } from '../features/parishioner/tracking/SubmittedConfirmation'
import { TrackForm } from '../features/parishioner/tracking/TrackForm'
import { useSonas } from '../features/parishioner/useSonas'
import { ApiError } from '../lib/api'
import { useLocation } from '../lib/router'
import { ParishionerLayout } from '../layouts/ParishionerLayout'

const eventTypes = ['Mass Intention', 'House Blessing', 'Wedding Pre-interview', 'General Counseling'] as const
type EventType = (typeof eventTypes)[number]

const venueTypes: VenueType[] = ['Parish Church', 'Chapel', 'Client’s Home']

/** Shown label -> the value the API stores. */
const intentionCategories: Array<[label: string, value: string]> = [
  ['Thanksgiving', 'Thanksgiving'],
  ['Souls of the Departed', 'Souls'],
  ['Healing', 'Healing'],
  ['Special Intention', 'Special'],
]

// The API's field names, mapped onto the form's. Date and time problems show under the schedule.
const fieldFor: Record<string, string> = {
  event_title: 'title',
  sona_id: 'sonaId',
  chapel_id: 'chapelId',
  house_address: 'houseAddress',
  date: 'schedule',
  time: 'schedule',
  full_name: 'fullName',
  contact_number: 'contact',
  email: 'email',
  intention_category: 'intentionCategory',
  intention_details: 'intentionNames',
  groom_name: 'groomName',
  groom_contact: 'groomContact',
  bride_name: 'brideName',
  bride_contact: 'brideContact',
  attendee_count: 'attendees',
  notes: 'notes',
  privacy_consent: 'consent',
}
const fieldOrder = [
  'title',
  'sonaId',
  'chapelId',
  'houseAddress',
  'fullName',
  'contact',
  'email',
  'schedule',
  'intentionCategory',
  'intentionNames',
  'groomName',
  'groomContact',
  'brideName',
  'brideContact',
  'attendees',
  'notes',
  'consent',
]

export default function AppointmentsPage() {
  const { sonas, failed: sonasFailed } = useSonas()
  const { query } = useLocation()
  const topRef = useRef<HTMLDivElement>(null)

  const suggestTitle = (type: EventType) => (type === 'General Counseling' ? 'Counseling Session' : type)

  // The title stays undefined until edited, so it follows the event type.
  const blank = (type: EventType) => ({
    eventType: type,
    title: undefined as string | undefined,
    venueType: (type === 'House Blessing' ? 'Client’s Home' : 'Parish Church') as VenueType,
    sonaId: null as number | null,
    chapelId: null as number | null,
    houseAddress: '',
    fullName: '',
    contact: '',
    email: '',
    intentionCategory: '',
    intentionNames: '',
    attendees: '',
    notes: '',
    groomName: '',
    groomContact: '',
    brideName: '',
    brideContact: '',
  })

  const [form, setForm] = useState(() => blank(query.get('event') === 'wedding' ? 'Wedding Pre-interview' : 'Mass Intention'))
  const [slot, setSlot] = useState<Slot>()
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState<Appointment>()

  const title = form.title ?? suggestTitle(form.eventType)
  const { chapelId, sonaId, houseAddress, contact } = form
  const sona = sonas?.find((s) => s.sona_id === sonaId)
  const chapel = sona?.chapels.find((c) => c.chapel_id === chapelId)
  const showSona = form.venueType !== 'Parish Church'
  const availability = useAvailability(form.venueType, chapelId)
  const venueLabel = form.venueType === 'Chapel' ? (chapel?.name ?? 'Chapel') : form.venueType

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const changeChapel = (id: number | null) => {
    set('chapelId', id)
    // Chapel venues have their own calendars, so a time picked for another chapel no longer applies.
    if (form.venueType === 'Chapel') setSlot(undefined)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const next: Record<string, string> = {}
    const need = (key: string, ok: unknown, msg = 'This field is required.') => {
      if (!ok) next[key] = msg
    }
    need('title', title.trim())
    if (showSona) {
      need('sonaId', sonaId)
      need('chapelId', chapelId)
    }
    if (form.venueType === 'Client’s Home') need('houseAddress', houseAddress.trim())
    need('fullName', form.fullName.trim())
    need('contact', contact.trim(), 'Enter a mobile number the secretary can call.')
    need('schedule', slot, 'Choose a date and time.')
    if (form.eventType === 'Mass Intention') {
      need('intentionCategory', form.intentionCategory)
      need('intentionNames', form.intentionNames.trim())
    }
    if (form.eventType === 'Wedding Pre-interview') {
      need('groomName', form.groomName.trim())
      need('groomContact', form.groomContact.trim())
      need('brideName', form.brideName.trim())
      need('brideContact', form.brideContact.trim())
    }
    need('consent', consent, 'Please accept the privacy notice to submit.')
    setErrors(next)
    setFormError(null)
    const first = fieldOrder.find((k) => next[k])
    if (first) return document.getElementById(first)?.focus()

    const mass = form.eventType === 'Mass Intention'
    const wedding = form.eventType === 'Wedding Pre-interview'
    setSubmitting(true)
    try {
      const created = await bookAppointment({
        event_type: form.eventType,
        event_title: title.trim(),
        venue_type: apiVenue(form.venueType),
        sona_id: showSona ? sonaId : null,
        chapel_id: showSona ? chapelId : null,
        house_address: form.venueType === 'Client’s Home' ? houseAddress.trim() : null,
        date: slot!.date,
        time: slot!.time,
        full_name: form.fullName.trim(),
        contact_number: contact.trim(),
        email: form.email.trim() || null,
        intention_category: mass ? form.intentionCategory : null,
        intention_details: mass ? form.intentionNames.trim() : null,
        groom_name: wedding ? form.groomName.trim() : null,
        groom_contact: wedding ? form.groomContact.trim() : null,
        bride_name: wedding ? form.brideName.trim() : null,
        bride_contact: wedding ? form.brideContact.trim() : null,
        attendee_count: form.attendees ? Number(form.attendees) : null,
        notes: form.notes.trim() || null,
        privacy_consent: consent,
      })
      setSubmitting(false)
      setBooked(created)
      topRef.current?.scrollIntoView({ block: 'start' })
    } catch (err) {
      setSubmitting(false)
      if (err instanceof ApiError && err.status === 422 && Object.keys(err.errors).length) {
        const server: Record<string, string> = {}
        for (const [field, messages] of Object.entries(err.errors)) server[fieldFor[field] ?? field] ??= messages[0]
        setErrors(server)
        if (err.errors.time || err.errors.date) {
          // Most likely someone else just took the time: show the calendar as it is now.
          setSlot(undefined)
          availability.reload()
        }
        const firstServer = fieldOrder.find((k) => server[k])
        if (firstServer) document.getElementById(firstServer)?.focus()
        else setFormError(err.message)
        return
      }
      setFormError(err instanceof ApiError && err.status === 0 ? err.message : 'Your request could not be sent. Please try again in a moment.')
    }
  }

  const bookAnother = () => {
    setForm(blank(form.eventType))
    setSlot(undefined)
    setConsent(false)
    setBooked(undefined)
    availability.reload()
  }

  const err = (key: string) => errors[key] || undefined
  const aria = (key: string) => ({ 'aria-invalid': errors[key] ? true : undefined, 'aria-describedby': errors[key] ? `${key}-error` : undefined })

  return (
    <ParishionerLayout
      activeHref="/parishioner/appointments"
      hero={
        <PageBanner
          title="Book Appointment"
          description="Request a Mass intention, house blessing, wedding pre-interview, or counseling. Pick from open times and the secretary will confirm."
        />
      }
    >
      <div ref={topRef} className="scroll-mt-24" />
      {booked ? (
        <SubmittedConfirmation
          title="Appointment request sent"
          reference={booked.reference}
          actions={
            <button type="button" onClick={bookAnother} className={btnSecondary}>
              Book another
            </button>
          }
        >
          {booked.title} · {booked.schedule}. The secretary will approve, move, or decline it. Track it to see the answer.
        </SubmittedConfirmation>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <form noValidate onSubmit={submit} aria-busy={submitting} className={`p-4 sm:p-8 lg:col-span-2 ${cardClass}`}>
            <Section title="Event">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Event type">
                {eventTypes.map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest ${
                      form.eventType === t ? 'border-forest bg-forest-soft/50 text-forest' : 'border-stone-200 text-stone-700 hover:border-forest/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="eventType"
                      value={t}
                      checked={form.eventType === t}
                      onChange={() => {
                        if (t === 'House Blessing' && form.venueType !== 'Client’s Home') setSlot(undefined)
                        setForm((f) => ({ ...f, eventType: t, venueType: t === 'House Blessing' ? 'Client’s Home' : f.venueType }))
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`grid size-4.5 shrink-0 place-items-center rounded-full border-2 ${form.eventType === t ? 'border-forest' : 'border-stone-300'}`}
                    >
                      {form.eventType === t && <span className="size-2 rounded-full bg-forest" />}
                    </span>
                    {t}
                  </label>
                ))}
              </div>
              <Field label="Event title" htmlFor="title" required error={err('title')} hint="Suggested from the event type; you can change it." className="mt-4">
                <input id="title" value={title} maxLength={150} onChange={(e) => set('title', e.target.value)} className={inputClass} {...aria('title')} />
              </Field>
            </Section>

            <Section title="Requester">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="fullName" required error={err('fullName')}>
                  <input
                    id="fullName"
                    autoComplete="name"
                    value={form.fullName}
                    maxLength={200}
                    onChange={(e) => set('fullName', e.target.value)}
                    className={inputClass}
                    {...aria('fullName')}
                  />
                </Field>
                <Field label="Contact number" htmlFor="contact" required error={err('contact')} hint="The secretary calls this number about the schedule.">
                  <input
                    id="contact"
                    type="tel"
                    autoComplete="tel"
                    value={contact}
                    onChange={(e) => set('contact', e.target.value)}
                    placeholder="0917 555 0142"
                    className={inputClass}
                    {...aria('contact')}
                  />
                </Field>
                <Field label="Email" htmlFor="email" hint="Optional" error={err('email')}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    maxLength={150}
                    onChange={(e) => set('email', e.target.value)}
                    className={inputClass}
                    {...aria('email')}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Venue">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Venue type">
                {venueTypes.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={form.venueType === v}
                    onClick={() => {
                      if (v === form.venueType) return
                      set('venueType', v)
                      setSlot(undefined)
                    }}
                    className={chipClass(form.venueType === v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {showSona && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Sona"
                    htmlFor="sonaId"
                    required
                    error={err('sonaId') ?? (sonasFailed ? 'The Sona list could not be loaded. Reload the page to try again.' : undefined)}
                  >
                    <select
                      id="sonaId"
                      value={sonaId ?? ''}
                      disabled={!sonas}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null
                        set('sonaId', id)
                        const chapels = sonas?.find((s) => s.sona_id === id)?.chapels
                        changeChapel(chapels?.length === 1 ? chapels[0].chapel_id : null)
                      }}
                      className={inputClass}
                      {...aria('sonaId')}
                    >
                      <option value="">{sonas ? 'Select…' : 'Loading…'}</option>
                      {sonas?.map((s) => (
                        <option key={s.sona_id} value={s.sona_id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={form.venueType === 'Chapel' ? 'Chapel' : 'Nearest chapel'} htmlFor="chapelId" required error={err('chapelId')}>
                    <select
                      id="chapelId"
                      value={chapel ? chapel.chapel_id : ''}
                      disabled={!sona}
                      onChange={(e) => changeChapel(e.target.value ? Number(e.target.value) : null)}
                      className={inputClass}
                      {...aria('chapelId')}
                    >
                      <option value="">{sona ? 'Select…' : 'Choose a Sona first'}</option>
                      {sona?.chapels.map((c) => (
                        <option key={c.chapel_id} value={c.chapel_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {form.venueType === 'Client’s Home' && (
                    <Field label="House address" htmlFor="houseAddress" required error={err('houseAddress')} className="sm:col-span-2">
                      <input
                        id="houseAddress"
                        value={houseAddress}
                        maxLength={250}
                        onChange={(e) => set('houseAddress', e.target.value)}
                        className={inputClass}
                        {...aria('houseAddress')}
                      />
                    </Field>
                  )}
                </div>
              )}
            </Section>

            <Section title="Schedule">
              <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-semibold text-stone-500">Date and time</span>
                <span className={`font-semibold ${slot ? 'text-stone-900' : 'text-stone-400'}`}>{slot ? formatSlot(slot) : 'Not chosen'}</span>
              </p>
              {availability.waitingForChapel ? (
                <p className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">
                  Choose the chapel to see its open times.
                </p>
              ) : availability.data ? (
                <SlotPicker
                  key={`${form.venueType}-${form.venueType === 'Chapel' ? chapelId : ''}`}
                  availability={availability.data}
                  venueLabel={venueLabel}
                  selected={slot}
                  onPick={(s) => {
                    setSlot(s)
                    setErrors((x) => ({ ...x, schedule: '' }))
                  }}
                />
              ) : availability.failed ? (
                <div className="rounded-xl border border-stone-200 p-4 text-center">
                  <p className="text-sm text-stone-700">Open times could not be loaded.</p>
                  <button type="button" onClick={availability.reload} className={`${btnSecondary} mt-3`}>
                    Try again
                  </button>
                </div>
              ) : (
                <LoadingState what="open times" />
              )}
              {errors.schedule && (
                <p id="schedule" tabIndex={-1} className="mt-2 text-sm text-red-700">
                  {errors.schedule}
                </p>
              )}
            </Section>

            <Section title="Details">
              <div className="grid gap-4 sm:grid-cols-2">
                {form.eventType === 'Mass Intention' && (
                  <>
                    <Field label="Intention" htmlFor="intentionCategory" required error={err('intentionCategory')}>
                      <select
                        id="intentionCategory"
                        value={form.intentionCategory}
                        onChange={(e) => set('intentionCategory', e.target.value)}
                        className={inputClass}
                        {...aria('intentionCategory')}
                      >
                        <option value="">Select…</option>
                        {intentionCategories.map(([label, value]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Name(s) to be prayed for" htmlFor="intentionNames" required error={err('intentionNames')}>
                      <input
                        id="intentionNames"
                        value={form.intentionNames}
                        maxLength={1000}
                        onChange={(e) => set('intentionNames', e.target.value)}
                        placeholder="e.g. Santos family"
                        className={inputClass}
                        {...aria('intentionNames')}
                      />
                    </Field>
                  </>
                )}
                {form.eventType === 'Wedding Pre-interview' && (
                  <>
                    <Field label="Groom’s full name" htmlFor="groomName" required error={err('groomName')}>
                      <input
                        id="groomName"
                        value={form.groomName}
                        maxLength={200}
                        onChange={(e) => set('groomName', e.target.value)}
                        className={inputClass}
                        {...aria('groomName')}
                      />
                    </Field>
                    <Field label="Groom’s contact number" htmlFor="groomContact" required error={err('groomContact')}>
                      <input
                        id="groomContact"
                        type="tel"
                        value={form.groomContact}
                        onChange={(e) => set('groomContact', e.target.value)}
                        className={inputClass}
                        {...aria('groomContact')}
                      />
                    </Field>
                    <Field label="Bride’s full name" htmlFor="brideName" required error={err('brideName')}>
                      <input
                        id="brideName"
                        value={form.brideName}
                        maxLength={200}
                        onChange={(e) => set('brideName', e.target.value)}
                        className={inputClass}
                        {...aria('brideName')}
                      />
                    </Field>
                    <Field label="Bride’s contact number" htmlFor="brideContact" required error={err('brideContact')}>
                      <input
                        id="brideContact"
                        type="tel"
                        value={form.brideContact}
                        onChange={(e) => set('brideContact', e.target.value)}
                        className={inputClass}
                        {...aria('brideContact')}
                      />
                    </Field>
                  </>
                )}
                <Field label="Number of attendees" htmlFor="attendees" hint="Optional" error={err('attendees')}>
                  <input
                    id="attendees"
                    type="number"
                    min={1}
                    value={form.attendees}
                    onChange={(e) => set('attendees', e.target.value)}
                    className={inputClass}
                    {...aria('attendees')}
                  />
                </Field>
                <Field label="Notes" htmlFor="notes" hint="Optional" error={err('notes')} className="sm:col-span-2">
                  <textarea
                    id="notes"
                    rows={3}
                    maxLength={1000}
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    className={inputClass}
                    {...aria('notes')}
                  />
                </Field>
              </div>
            </Section>

            <div className={`rounded-xl border p-4 ${errors.consent ? 'border-red-400 bg-red-50/50' : 'border-stone-200 bg-ivory/60'}`}>
              <label className="flex items-start gap-3">
                <input
                  id="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked)
                    setErrors((x) => ({ ...x, consent: '' }))
                  }}
                  className="mt-1 size-4.5 shrink-0 accent-forest"
                />
                <span className="text-sm leading-relaxed text-stone-700">
                  I consent to the {parish.name} using these details to schedule and coordinate this appointment, in line with the Data Privacy Act of 2012.
                </span>
              </label>
              {errors.consent && <p className="mt-2 text-sm text-red-700">{errors.consent}</p>}
            </div>

            {formError && (
              <p role="alert" className="mt-6 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end border-t border-stone-100 pt-6">
              <button type="submit" disabled={submitting} className={`${btnPrimary} w-full disabled:cursor-wait disabled:opacity-70 sm:w-auto`}>
                {submitting ? (
                  <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <Icon name="send" className="size-4" />
                )}
                {submitting ? 'Sending…' : 'Send appointment request'}
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <section aria-labelledby="track-heading" className={`p-5 ${cardClass}`}>
              <h2 id="track-heading" className="mb-3 font-serif text-xl font-semibold text-stone-900">
                Already booked?
              </h2>
              <TrackForm id="track-appointment" />
            </section>

            <section className="rounded-2xl bg-forest p-5 text-white">
              <h2 className="font-serif text-xl font-semibold">How booking works</h2>
              <ol className="mt-3 space-y-2 text-sm text-white/85">
                <li>1. Send your request with the date and time you want. No account needed.</li>
                <li>2. Keep the reference number you get.</li>
                <li>3. The secretary approves, reschedules, or declines it. Track it with the reference number to see the answer.</li>
              </ol>
            </section>
          </div>
        </div>
      )}
    </ParishionerLayout>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-8 border-b border-stone-100 pb-8">
      <legend className="mb-4 font-serif text-xl font-semibold text-stone-900">{title}</legend>
      {children}
    </fieldset>
  )
}
