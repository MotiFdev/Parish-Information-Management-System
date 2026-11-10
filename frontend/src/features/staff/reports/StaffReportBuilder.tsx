import { Field } from '../../../components/ui/Field'
import { cardClass, inputClass } from '../../../components/ui/styles'
import type { PeriodPreset } from '../../priest/reports/ReportBuilder'
import { sacraments, sacramentPlural, type Sacrament } from '../../priest/sampleData'
import { reportTypes, thisMonth, todayKey, type ReportOptions, type StaffReportConfig, type StaffReportType, type TurnaroundGroup } from './staffReports'

interface Props {
  config: StaffReportConfig
  /** Choices from the server; empty until the first report loads. */
  options: ReportOptions
  preset: PeriodPreset
  errors: { range?: string; sacraments?: string; date?: string }
  onChange: (c: Partial<StaffReportConfig>) => void
  onPreset: (p: PeriodPreset) => void
}

export function StaffReportBuilder({ config: c, options, preset, errors, onChange, onPreset }: Props) {
  const latest = thisMonth()
  const hint = reportTypes.find((t) => t.value === c.type)?.hint

  return (
    <form aria-label="Report options" onSubmit={(e) => e.preventDefault()} className={`${cardClass} space-y-5 px-5 py-5`}>
      <Field label="Report" htmlFor="sr-type" hint={hint}>
        <select
          id="sr-type"
          aria-describedby="sr-type-hint"
          value={c.type}
          onChange={(e) => onChange({ type: e.target.value as StaffReportType })}
          className={`${inputClass} font-semibold`}
        >
          {reportTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      {c.type === 'daily' ? (
        <>
          <Field label="Day" htmlFor="sr-date" error={errors.date}>
            <input
              id="sr-date"
              type="date"
              max={todayKey()}
              value={c.date}
              onChange={(e) => onChange({ date: e.target.value })}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? 'sr-date-error' : undefined}
              className={inputClass}
            />
          </Field>
          <Field label="Kind of work" htmlFor="sr-activity">
            <select id="sr-activity" value={c.activity} onChange={(e) => onChange({ activity: e.target.value })} className={inputClass}>
              <option value="all">All office work</option>
              {options.categories.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Done by" htmlFor="sr-staff">
            <select id="sr-staff" value={c.staff} onChange={(e) => onChange({ staff: e.target.value })} className={inputClass}>
              <option value="">Everyone</option>
              {options.people.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <div className="space-y-3">
          <Field label="Period" htmlFor="sr-period">
            <select id="sr-period" value={preset} onChange={(e) => onPreset(e.target.value as PeriodPreset)} className={inputClass}>
              <option value="last12">Last 12 months</option>
              <option value="year">This year so far</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From" htmlFor="sr-from" error={errors.range}>
                <input
                  id="sr-from"
                  type="month"
                  max={latest}
                  value={c.from}
                  onChange={(e) => onChange({ from: e.target.value })}
                  aria-invalid={errors.range ? true : undefined}
                  aria-describedby={errors.range ? 'sr-from-error' : undefined}
                  className={inputClass}
                />
              </Field>
              <Field label="To" htmlFor="sr-to">
                <input id="sr-to" type="month" max={latest} value={c.to} onChange={(e) => onChange({ to: e.target.value })} className={inputClass} />
              </Field>
            </div>
          )}
        </div>
      )}

      {c.type === 'sacramental' && (
        <fieldset aria-describedby={errors.sacraments ? 'sr-sacraments-error' : undefined}>
          <legend className="mb-2 text-sm font-medium text-stone-700">Include</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {sacraments.map((s: Sacrament) => (
              <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-stone-800">
                <input
                  type="checkbox"
                  checked={c.sacraments.includes(s)}
                  onChange={(e) =>
                    onChange({
                      sacraments: e.target.checked ? sacraments.filter((x) => x === s || c.sacraments.includes(x)) : c.sacraments.filter((x) => x !== s),
                    })
                  }
                  className="size-4.5 accent-forest"
                />
                {sacramentPlural[s]}
              </label>
            ))}
          </div>
          {errors.sacraments && (
            <p id="sr-sacraments-error" className="mt-1 text-sm text-red-700">
              {errors.sacraments}
            </p>
          )}
        </fieldset>
      )}

      {c.type === 'turnaround' && (
        <Field label="Group by" htmlFor="sr-group">
          <select id="sr-group" value={c.groupBy} onChange={(e) => onChange({ groupBy: e.target.value as TurnaroundGroup })} className={inputClass}>
            <option value="recordType">Record type</option>
            <option value="requestType">Request type</option>
            <option value="month">Month</option>
          </select>
        </Field>
      )}

      {c.type === 'appointments' && (
        <Field label="Event type" htmlFor="sr-event">
          <select id="sr-event" value={c.eventType} onChange={(e) => onChange({ eventType: e.target.value })} className={inputClass}>
            <option value="all">All event types</option>
            {options.event_types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      )}
    </form>
  )
}
