import { useRef, useState, type ReactNode } from 'react'
import { Link } from '../components/Link'
import { FileInput } from '../components/ui/FileInput'
import { fileProblem } from '../lib/upload'
import { Icon } from '../components/ui/Icon'
import { PageBanner } from '../components/ui/PageBanner'
import { btnPrimary, btnSecondary, cardClass } from '../components/ui/styles'
import { FormField } from '../features/parishioner/requests/FormField'
import { submitRecordRequest } from '../features/parishioner/requests/requestsApi'
import {
  correctionDocument,
  correctionGroup,
  recordDocuments,
  recordForms,
  recordTypes,
  requestTypes,
  type FieldDef,
  type FieldGroup,
} from '../features/parishioner/requests/recordTypes'
import { parish, type RecordRequest, type RecordType, type RequestType } from '../features/parishioner/sampleData'
import { SubmittedConfirmation } from '../features/parishioner/tracking/SubmittedConfirmation'
import { ApiError } from '../lib/api'
import { navigate, useLocation } from '../lib/router'
import { ParishionerLayout } from '../layouts/ParishionerLayout'

const steps = ['Record type', 'Request type', 'Details', 'Documents', 'Review'] as const

const commonGroup: FieldGroup = {
  title: 'Your details',
  fields: [
    { name: 'clientName', label: 'Your full name', key: true },
    {
      name: 'relationship',
      label: 'Relationship to the person on the record',
      type: 'select',
      key: true,
      options: ['Self', 'Parent', 'Spouse', 'Child', 'Relative', 'Authorized Representative'],
    },
    { name: 'contact', label: 'Contact number', type: 'tel', key: true },
    { name: 'email', label: 'Email address', type: 'email', key: true },
    { name: 'address', label: 'Complete address', key: true, wide: true },
    { name: 'parish', label: 'Parish where the record is held', key: true },
    {
      name: 'purpose',
      label: 'Purpose of request',
      type: 'select',
      key: true,
      options: ['Personal copy', 'Marriage requirement', 'Legal purpose', 'Other'],
    },
  ],
}

const without = (o: Record<string, string>, key: string) => {
  const next = { ...o }
  delete next[key]
  return next
}

// The API's field names for "Your details", mapped onto the form's.
const commonFieldFor: Record<string, string> = {
  full_name: 'clientName',
  relationship: 'relationship',
  contact_number: 'contact',
  email: 'email',
  address: 'address',
  parish: 'parish',
  purpose: 'purpose',
  purpose_other: 'purposeOther',
}

export default function NewRequestPage() {
  const { query } = useLocation()
  const preset = recordTypes.find((t) => t.slug === query.get('type'))

  const [step, setStep] = useState(preset ? 1 : 0)
  const [recordType, setRecordType] = useState<RecordType | undefined>(preset?.type)
  const [requestType, setRequestType] = useState<RequestType>()
  const [values, setValues] = useState<Record<string, string>>({
    clientName: '',
    relationship: 'Self',
    contact: '',
    email: '',
    address: '',
    parish: parish.name,
    purpose: '',
  })
  const [files, setFiles] = useState<Record<string, File>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<RecordRequest>()
  const topRef = useRef<HTMLDivElement>(null)

  const groups: FieldGroup[] = recordType ? [commonGroup, ...recordForms[recordType], ...(requestType === 'Record Correction' ? [correctionGroup] : [])] : []
  const documents = recordType ? [...(requestType === 'Record Correction' ? [correctionDocument] : []), ...recordDocuments[recordType]] : []

  const isRequired = (f: FieldDef) => !f.optional && (f.key || requestType === 'New Registration')

  const goTo = (next: number) => {
    setErrors({})
    setFormError(null)
    setStep(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const chooseRecordType = (type: RecordType) => {
    setRecordType(type)
    navigate(`/parishioner/requests/new?type=${recordTypes.find((t) => t.type === type)?.slug}`, { replace: true })
    goTo(1)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (step === 2) {
      for (const f of groups.flatMap((g) => g.fields)) {
        if (isRequired(f) && !values[f.name]?.trim()) next[f.name] = 'This field is required.'
      }
      if (values.purpose === 'Other' && !values.purposeOther?.trim()) next.purposeOther = 'Please describe the purpose.'
    }
    if (step === 3) {
      for (const d of documents) if (d.required && !files[d.id]) next[`doc-${d.id}`] = 'Please attach this document.'
    }
    if (step === 4 && !consent) next.consent = 'Please accept the privacy notice to submit.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) document.getElementById(first)?.focus()
    return !first
  }

  const submit = async () => {
    if (submitting || !recordType || !requestType || !validate()) return
    const form = new FormData()
    form.append('record_type', recordType)
    form.append('request_type', requestType)
    form.append('full_name', values.clientName.trim())
    form.append('relationship', values.relationship)
    form.append('contact_number', values.contact.trim())
    form.append('email', values.email.trim())
    form.append('address', values.address.trim())
    form.append('parish', values.parish.trim())
    form.append('purpose', values.purpose)
    if (values.purpose === 'Other') form.append('purpose_other', (values.purposeOther ?? '').trim())
    for (const f of groups.slice(1).flatMap((g) => g.fields)) if (values[f.name]?.trim()) form.append(`details[${f.name}]`, values[f.name].trim())
    for (const d of documents) if (files[d.id]) form.append(`documents[${d.id}]`, files[d.id])
    form.append('privacy_consent', consent ? '1' : '0')

    setSubmitting(true)
    setFormError(null)
    try {
      setSubmitted(await submitRecordRequest(form))
      topRef.current?.scrollIntoView({ block: 'start' })
    } catch (err) {
      setSubmitting(false)
      if (err instanceof ApiError && err.status === 422 && Object.keys(err.errors).length) {
        // Show each problem on its own field, and go back to the first step that has one.
        const next: Record<string, string> = {}
        for (const [field, messages] of Object.entries(err.errors)) {
          const key = field.startsWith('details.')
            ? field.slice(8)
            : field.startsWith('documents.')
              ? `doc-${field.slice(10)}`
              : (commonFieldFor[field] ?? field)
          next[key] ??= messages[0]
        }
        setErrors(next)
        const keys = Object.keys(next)
        const back = keys.some((k) => k !== 'consent' && !k.startsWith('doc-')) ? 2 : keys.some((k) => k.startsWith('doc-')) ? 3 : 4
        if (back !== 4) {
          setStep(back)
          topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setFormError('Some details need attention before the request can be sent.')
        }
        return
      }
      setFormError(err instanceof ApiError && err.status === 0 ? err.message : 'Your request could not be sent. Please try again in a moment.')
    }
  }

  const setValue = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors((e) => without(e, name))
  }

  const banner = (
    <PageBanner
      back={{ href: '/parishioner/requests', label: 'Record Requests' }}
      title="New record request"
      description={
        recordType ? (
          <p>
            {recordType}
            {requestType && ` · ${requestType}`}
          </p>
        ) : (
          'Choose the record, the kind of request, then fill in the details the secretary needs to find or create the entry.'
        )
      }
    />
  )

  if (submitted) {
    return (
      <ParishionerLayout activeHref="/parishioner/requests" hero={banner}>
        <div ref={topRef} className="scroll-mt-24">
          <SubmittedConfirmation
            title="Request submitted"
            reference={submitted.number}
            actions={
              <Link href="/parishioner/requests" className={btnSecondary}>
                Back to Record Requests
              </Link>
            }
          >
            Status: <span className="font-semibold text-stone-800">Pending</span>. The secretary will check the register and your documents. If anything else is needed,
            it shows when you track the request.
          </SubmittedConfirmation>
        </div>
      </ParishionerLayout>
    )
  }

  return (
    <ParishionerLayout activeHref="/parishioner/requests" hero={banner}>
      <div ref={topRef} className="scroll-mt-24">
        <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Steps">
          {steps.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-medium ${
                i === step ? 'bg-forest text-white' : i < step ? 'bg-forest-soft text-forest' : 'bg-white text-stone-500 ring-1 ring-stone-200'
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                  i === step ? 'bg-gold text-forest-dark' : i < step ? 'bg-forest text-white' : 'bg-stone-100'
                }`}
              >
                {i < step ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        {formError && (
          <p role="alert" className="mt-6 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}

        <div className="mt-6">
          {step === 0 && (
            <StepShell title="Which record is this for?">
              <div className="grid gap-3 sm:grid-cols-2">
                {recordTypes.map((t) => (
                  <ChoiceCard
                    key={t.type}
                    selected={recordType === t.type}
                    onClick={() => chooseRecordType(t.type)}
                    icon={<Icon name={t.icon} />}
                    title={t.type}
                    body={t.blurb}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="What do you need?" onBack={() => goTo(0)}>
              <div className="grid gap-3 md:grid-cols-3">
                {requestTypes.map((t) => (
                  <ChoiceCard
                    key={t.type}
                    selected={requestType === t.type}
                    onClick={() => {
                      setRequestType(t.type)
                      goTo(2)
                    }}
                    title={t.type}
                    body={t.blurb}
                  />
                ))}
              </div>
              {recordType === 'Marriage' && (
                <p className="mt-5 flex gap-2.5 rounded-xl bg-gold-soft p-4 text-sm text-stone-800">
                  <Icon name="alert" className="mt-0.5 size-4.5 shrink-0 text-brown" />
                  <span>
                    Preparing for a church wedding? That starts with a{' '}
                    <Link href="/parishioner/appointments?event=wedding" className="font-semibold text-forest underline">
                      Wedding Pre-interview appointment
                    </Link>
                    , not a record request.
                  </span>
                </p>
              )}
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              title="Fill in the details"
              description={
                requestType === 'New Registration'
                  ? 'All fields marked * are needed to register the sacrament.'
                  : 'Fields marked * help the secretary find the existing entry. Add anything else you know.'
              }
              onBack={() => goTo(1)}
              onNext={() => validate() && goTo(3)}
            >
              <div className="space-y-8">
                {groups.map((g) => (
                  <fieldset key={g.title}>
                    <legend className="font-serif text-xl font-semibold text-stone-900">{g.title}</legend>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {g.fields.map((f) => (
                        <FormField
                          key={f.name}
                          field={f}
                          value={values[f.name] ?? ''}
                          required={isRequired(f)}
                          error={errors[f.name]}
                          onChange={(v) => setValue(f.name, v)}
                        />
                      ))}
                      {g === commonGroup && values.purpose === 'Other' && (
                        <FormField
                          field={{ name: 'purposeOther', label: 'Describe the purpose' }}
                          value={values.purposeOther ?? ''}
                          required
                          error={errors.purposeOther}
                          onChange={(v) => setValue('purposeOther', v)}
                        />
                      )}
                    </div>
                  </fieldset>
                ))}
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              title="Upload supporting documents"
              description="Clear photos or scans are fine. The secretary verifies each document separately."
              onBack={() => goTo(2)}
              onNext={() => validate() && goTo(4)}
            >
              <ul className="space-y-5">
                {documents.map((d) => (
                  <li key={d.id}>
                    <p className="mb-1.5 text-sm font-medium text-stone-700">
                      {d.label}
                      {d.required ? <span className="text-red-600"> *</span> : <span className="text-stone-400"> (optional)</span>}
                    </p>
                    <FileInput
                      id={`doc-${d.id}`}
                      fileName={files[d.id]?.name}
                      invalid={!!errors[`doc-${d.id}`]}
                      onChange={(file) => {
                        const problem = fileProblem(file)
                        if (problem) return setErrors((e) => ({ ...e, [`doc-${d.id}`]: problem }))
                        setFiles((f) => ({ ...f, [d.id]: file }))
                        setErrors((e) => without(e, `doc-${d.id}`))
                      }}
                    />
                    {errors[`doc-${d.id}`] && <p className="mt-1.5 text-sm text-red-700">{errors[`doc-${d.id}`]}</p>}
                  </li>
                ))}
              </ul>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
              title="Review and submit"
              onBack={() => goTo(3)}
              onNext={submit}
              nextLabel={submitting ? 'Sending…' : 'Submit request'}
              busy={submitting}
            >
              <div className="space-y-6">
                <ReviewBlock
                  title="Request"
                  rows={[
                    ['Record type', recordType ?? ''],
                    ['Request type', requestType ?? ''],
                  ]}
                  onEdit={() => goTo(1)}
                />
                {groups.map((g) => (
                  <ReviewBlock
                    key={g.title}
                    title={g.title}
                    rows={g.fields
                      .filter((f) => values[f.name]?.trim())
                      .map((f) => [f.label, f.name === 'purpose' && values.purpose === 'Other' ? values.purposeOther : values[f.name]])}
                    onEdit={() => goTo(2)}
                  />
                ))}
                <ReviewBlock title="Documents" rows={documents.filter((d) => files[d.id]).map((d) => [d.label, files[d.id].name])} onEdit={() => goTo(3)} />

                <div className={`rounded-xl border p-4 ${errors.consent ? 'border-red-400 bg-red-50/50' : 'border-stone-200 bg-ivory/60'}`}>
                  <label className="flex items-start gap-3">
                    <input
                      id="consent"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked)
                        setErrors({})
                      }}
                      className="mt-1 size-4.5 shrink-0 accent-forest"
                    />
                    <span className="text-sm leading-relaxed text-stone-700">
                      I consent to the {parish.name} collecting and processing the information and documents in this request for the purpose of verifying and
                      issuing parish records, in line with the Data Privacy Act of 2012.
                    </span>
                  </label>
                  {errors.consent && <p className="mt-2 text-sm text-red-700">{errors.consent}</p>}
                </div>
              </div>
            </StepShell>
          )}
        </div>
      </div>
    </ParishionerLayout>
  )
}

interface StepShellProps {
  busy?: boolean
  title: string
  description?: string
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  children: ReactNode
}

function StepShell({ title, description, onBack, onNext, nextLabel = 'Continue', busy, children }: StepShellProps) {
  return (
    <section className={`p-5 sm:p-8 ${cardClass}`}>
      <h2 className="font-serif text-2xl font-semibold text-stone-900 sm:text-3xl">{title}</h2>
      {description && <p className="mt-1.5 text-stone-600">{description}</p>}
      <div className="mt-6">{children}</div>
      {(onBack || onNext) && (
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-stone-100 pt-6 sm:flex-row sm:justify-between">
          {onBack ? (
            <button type="button" onClick={onBack} className={btnSecondary}>
              <Icon name="arrowLeft" className="size-4" />
              Back
            </button>
          ) : (
            <span />
          )}
          {onNext && (
            <button type="button" onClick={onNext} disabled={busy} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
              {nextLabel}
              <Icon name={nextLabel === 'Continue' ? 'arrowRight' : 'send'} className="size-4" />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

interface ChoiceCardProps {
  selected: boolean
  onClick: () => void
  title: string
  body: string
  icon?: ReactNode
}

function ChoiceCard({ selected, onClick, title, body, icon }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors sm:p-5 ${
        selected ? 'border-forest bg-forest-soft/50' : 'border-stone-200 bg-white hover:border-forest/40'
      }`}
    >
      {icon && <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-brown">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-stone-900">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-stone-600">{body}</span>
      </span>
      <Icon name="chevronRight" className="mt-0.5 size-5 shrink-0 text-stone-400" />
    </button>
  )
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: Array<[string, string]>; onEdit: () => void }) {
  if (rows.length === 0) return null
  return (
    <section className="rounded-xl border border-stone-200">
      <header className="flex items-center justify-between border-b border-stone-100 py-0.5 pr-2 pl-4">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-forest hover:underline"
        >
          Edit
        </button>
      </header>
      <dl className="divide-y divide-stone-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="text-stone-500">{label}</dt>
            <dd className="break-words text-stone-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
