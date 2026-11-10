import { Field } from '../../../components/ui/Field'
import { cardClass, inputClass } from '../../../components/ui/styles'
import { sacraments, sacramentPlural, type Sacrament } from '../sampleData'
import { thisMonth } from '../../staff/reports/staffReports'
import type { DemographicGroup, ReportConfig, ReportType } from './reportData'

export type PeriodPreset = 'last12' | 'year' | 'custom'

const types: { value: ReportType; hint: string }[] = [
  { value: 'Demographic', hint: 'Parishioners by Sona, age group, or sex' },
  { value: 'Sacramental', hint: 'Baptisms, confirmations, marriages, and burials per month' },
  { value: 'Financial', hint: 'Offerings and fees by category, from the offerings ledger' },
]

interface Props {
  config: ReportConfig
  preset: PeriodPreset
  errors: { range?: string; sacraments?: string }
  onChange: (c: Partial<ReportConfig>) => void
  onPreset: (p: PeriodPreset) => void
}

export function ReportBuilder({ config, preset, errors, onChange, onPreset }: Props) {
  return (
    <form aria-label="Report options" onSubmit={(e) => e.preventDefault()} className={`${cardClass} space-y-5 px-5 py-5`}>
      <fieldset>
        <legend className="mb-2 font-semibold text-stone-900">Report</legend>
        <div className="space-y-2">
          {types.map((t) => {
            const active = config.type === t.value
            return (
              <label
                key={t.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${
                  active ? 'border-forest bg-forest-soft' : 'border-stone-300 bg-white hover:border-forest/50'
                }`}
              >
                <input
                  type="radio"
                  name="report-type"
                  value={t.value}
                  checked={active}
                  onChange={() => onChange({ type: t.value })}
                  className="mt-1 size-4 shrink-0 accent-forest"
                />
                <span>
                  <span className={`block font-semibold ${active ? 'text-forest' : 'text-stone-900'}`}>{t.value}</span>
                  <span className="block text-sm text-stone-600">{t.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {config.type === 'Demographic' ? (
        <Field label="Group by" htmlFor="report-group" hint="A snapshot of the parish directory as of today.">
          <select id="report-group" value={config.groupBy} onChange={(e) => onChange({ groupBy: e.target.value as DemographicGroup })} className={inputClass}>
            <option value="sona">Sona</option>
            <option value="age">Age group</option>
            <option value="sex">Sex</option>
          </select>
        </Field>
      ) : (
        <div className="space-y-3">
          <Field label="Period" htmlFor="report-period">
            <select id="report-period" value={preset} onChange={(e) => onPreset(e.target.value as PeriodPreset)} className={inputClass}>
              <option value="last12">Last 12 months</option>
              <option value="year">This year so far</option>
              <option value="custom">Custom range</option>
            </select>
          </Field>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From" htmlFor="report-from" error={errors.range}>
                <input
                  id="report-from"
                  type="month"
                  max={thisMonth()}
                  value={config.from}
                  onChange={(e) => onChange({ from: e.target.value })}
                  aria-invalid={errors.range ? true : undefined}
                  aria-describedby={errors.range ? 'report-from-error' : undefined}
                  className={inputClass}
                />
              </Field>
              <Field label="To" htmlFor="report-to">
                <input
                  id="report-to"
                  type="month"
                  max={thisMonth()}
                  value={config.to}
                  onChange={(e) => onChange({ to: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {config.type === 'Sacramental' && (
        <fieldset aria-describedby={errors.sacraments ? 'report-sacraments-error' : undefined}>
          <legend className="mb-2 text-sm font-medium text-stone-700">Include</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {sacraments.map((s: Sacrament) => (
              <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-stone-800">
                <input
                  type="checkbox"
                  checked={config.sacraments.includes(s)}
                  onChange={(e) =>
                    onChange({
                      sacraments: e.target.checked
                        ? sacraments.filter((x) => x === s || config.sacraments.includes(x))
                        : config.sacraments.filter((x) => x !== s),
                    })
                  }
                  className="size-4.5 accent-forest"
                />
                {sacramentPlural[s]}
              </label>
            ))}
          </div>
          {errors.sacraments && (
            <p id="report-sacraments-error" className="mt-1 text-sm text-red-700">
              {errors.sacraments}
            </p>
          )}
        </fieldset>
      )}
    </form>
  )
}
