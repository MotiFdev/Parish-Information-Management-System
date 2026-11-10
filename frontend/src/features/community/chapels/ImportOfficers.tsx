import { useRef, useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary, inputClass } from '../../../components/ui/styles'
import { download } from '../../../lib/download'
import { readOfficerSheet, templateCsv, type Chapel, type ImportRow, type Officer, type SonaOption } from './chapelsData'

export interface ImportResult {
  chapelId: string
  term: number
  replace: boolean
  rows: ImportRow['officer'][]
}

interface Props {
  sonas: SonaOption[]
  /** Where the import starts; the chapel and term can still be changed. */
  start: { chapelId: string; term: number } | null
  chapels: Chapel[]
  officers: Officer[]
  onClose: () => void
  /** Resolves with an error message, or null once imported. */
  onImport: (r: ImportResult) => Promise<string | null>
}

export function ImportOfficers({ sonas, start, chapels, officers, onClose, onImport }: Props) {
  return (
    <Dialog open={start !== null} onClose={onClose} labelledBy="imp-title" className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl">
      {start && <ImportBody sonas={sonas} start={start} chapels={chapels} officers={officers} onClose={onClose} onImport={onImport} />}
    </Dialog>
  )
}

function ImportBody({ sonas, start, chapels, officers, onClose, onImport }: Omit<Props, 'start'> & { start: { chapelId: string; term: number } }) {
  const input = useRef<HTMLInputElement>(null)
  const [chapelId, setChapelId] = useState(start.chapelId)
  const [term, setTerm] = useState(String(start.term))
  const [file, setFile] = useState<{ name: string; rows: ImportRow[]; problem?: string } | null>(null)
  const [replace, setReplace] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const ready = file?.rows.filter((r) => !r.error) ?? []
  const skipped = (file?.rows.length ?? 0) - ready.length
  const existing = officers.filter((o) => o.chapelId === chapelId && String(o.term) === term).length
  const chapel = chapels.find((c) => c.id === chapelId)

  const choose = async (f: File) => {
    // TODO: .xlsx needs a spreadsheet reader (a library or the backend); for now Excel lists are saved as CSV first.
    if (!/\.csv$/i.test(f.name)) return setFile({ name: f.name, rows: [], problem: 'Only CSV files can be read for now. In Excel, use File, Save As, and choose CSV.' })
    setFile({ name: f.name, ...readOfficerSheet(await f.text()) })
    setErrors((e) => ({ ...e, file: undefined }))
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const next = {
          chapelId: chapelId ? undefined : 'Choose a chapel.',
          term: /^\d{4}$/.test(term) ? undefined : 'Enter the term as a year.',
          file: !file ? 'Choose the officer list.' : !ready.length ? 'There are no officers in this file that can be imported.' : undefined,
        }
        setErrors(next)
        if (next.chapelId) return document.getElementById('imp-chapel')?.focus()
        if (next.term) return document.getElementById('imp-term')?.focus()
        if (next.file) return document.getElementById('imp-choose')?.focus()
        setBusy(true)
        setFailed(null)
        const problem = await onImport({ chapelId, term: Number(term), replace: replace && existing > 0, rows: ready.map((r) => r.officer) })
        setBusy(false)
        setFailed(problem)
      }}
    >
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto px-6 pt-5 pb-4">
        <h2 id="imp-title" className="font-serif text-2xl font-semibold text-stone-900">
          Import officer list
        </h2>
        <p className="mt-1 text-stone-700">
          Upload the list a chapel sent, check it here, then import. Nothing is added until you press Import, and imported officers wait for PPC
          approval.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field label="Chapel" htmlFor="imp-chapel" required error={errors.chapelId}>
            <select id="imp-chapel" value={chapelId} onChange={(e) => setChapelId(e.target.value)} aria-invalid={errors.chapelId ? true : undefined} className={inputClass}>
              <option value="">Choose a chapel</option>
              {sonas.map((s) => (
                <optgroup key={s.id} label={s.name}>
                  {chapels
                    .filter((c) => c.sonaId === s.id && c.status === 'Approved')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Term" htmlFor="imp-term" required error={errors.term}>
            <input id="imp-term" inputMode="numeric" maxLength={4} value={term} onChange={(e) => setTerm(e.target.value)} aria-invalid={errors.term ? true : undefined} className={inputClass} />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-stone-900">{file ? file.name : 'Spreadsheet saved as CSV'}</p>
              <p className="text-stone-600">Columns: Name, Position, Ministry, Age, Facebook account, Contact number. Name and Position are required.</p>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void choose(f)
                e.target.value = ''
              }}
            />
            <button id="imp-choose" type="button" onClick={() => input.current?.click()} aria-describedby={errors.file ? 'imp-file-error' : undefined} className={`${btnSecondary} shrink-0`}>
              <Icon name="upload" className="size-4.5" />
              {file ? 'Choose another file' : 'Choose file'}
            </button>
          </div>
          <button type="button" onClick={() => download(templateCsv, 'chapel-officers-template.csv', 'text/csv')} className="mt-2 -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-forest hover:underline">
            <Icon name="download" className="size-4" />
            Download the template
          </button>
          {errors.file && (
            <p id="imp-file-error" className="text-sm text-red-700">
              {errors.file}
            </p>
          )}
        </div>

        {file?.problem && (
          <p role="alert" className="mt-3 flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {file.problem}
          </p>
        )}

        {file && file.rows.length > 0 && (
          <section aria-labelledby="imp-preview" className="mt-4">
            <h3 id="imp-preview" className="font-semibold text-stone-900">
              Check the list
            </h3>
            <p className="text-sm text-stone-600" aria-live="polite">
              {ready.length} ready to import{skipped > 0 && `, ${skipped} left out`}.
            </p>
            <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-stone-200 bg-ivory/60 text-stone-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Row
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Position and ministry
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Check
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {file.rows.map((r) => (
                    <tr key={r.line} className={r.error ? 'bg-stone-50 text-stone-500' : ''}>
                      <td className="px-3 py-2 tabular-nums">{r.line}</td>
                      <td className={`px-3 py-2 ${r.error ? '' : 'font-semibold text-stone-900'}`}>{r.officer.name || 'No name'}</td>
                      <td className="px-3 py-2">
                        {r.officer.position || 'None'}
                        {r.officer.ministry && <span className="text-stone-600"> · {r.officer.ministry}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.error ? (
                          <span className="font-semibold text-red-700">Left out: {r.error}</span>
                        ) : r.warning ? (
                          <span className="font-semibold text-brown">{r.warning}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-forest">
                            <Icon name="check" className="size-4" />
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {failed && (
          <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {failed}
          </p>
        )}

        {file && ready.length > 0 && existing > 0 && (
          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium text-stone-700">
              {chapel?.name} already lists {existing} {existing === 1 ? 'officer' : 'officers'} for {term}
            </legend>
            {[
              [false, 'Add to the current list', 'Keep everyone listed now and add the new rows.'],
              [true, `Replace the ${term} list`, 'Remove the current officers for this term and use the file instead. Other terms are not touched.'],
            ].map(([value, label, help]) => (
              <label key={String(value)} className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${replace === value ? 'border-forest bg-forest-soft' : 'border-stone-300 bg-white'}`}>
                <input type="radio" name="imp-mode" checked={replace === value} onChange={() => setReplace(value as boolean)} className="mt-1 size-4 accent-forest" />
                <span className="text-sm">
                  <span className="block font-semibold text-stone-900">{label}</span>
                  <span className="block text-stone-600">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {busy ? 'Importing…' : ready.length ? `Import ${ready.length} ${ready.length === 1 ? 'officer' : 'officers'}` : 'Import'}
        </button>
      </div>
    </form>
  )
}
