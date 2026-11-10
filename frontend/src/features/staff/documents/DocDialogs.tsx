import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary } from '../../../components/ui/styles'
import { MAX_KB, choiceFrom, emptyChoice, formatSize, linkComplete, type DocFile, type LinkChoice, type LinkTargets } from './documentsData'
import { LinkPicker } from './LinkPicker'

/** Change where one file is filed. `onSave` resolves with a reason when the server refuses. */
export function LinkDialog({
  file,
  targets,
  onClose,
  onSave,
}: {
  file: DocFile | null
  targets: LinkTargets
  onClose: () => void
  onSave: (c: LinkChoice) => Promise<string | void>
}) {
  return (
    <Dialog open={file !== null} onClose={onClose} labelledBy="link-title">
      {file && <LinkForm file={file} targets={targets} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function LinkForm({
  file,
  targets,
  onClose,
  onSave,
}: {
  file: DocFile
  targets: LinkTargets
  onClose: () => void
  onSave: (c: LinkChoice) => Promise<string | void>
}) {
  const [choice, setChoice] = useState<LinkChoice>(() => choiceFrom(file.link))
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (saving) return
        if (!linkComplete(choice)) return setError('Choose the record this file belongs to.')
        setSaving(true)
        const refused = await onSave(choice)
        setSaving(false)
        if (refused) setError(refused)
      }}
    >
      <div className="px-6 pt-5 pb-4">
        <h2 id="link-title" className="font-serif text-2xl font-semibold break-all text-stone-900">
          Link {file.name}
        </h2>
        <p className="mt-1 text-sm text-stone-600">Now: {file.link.title}</p>
        <div className="mt-4">
          <LinkPicker
            value={choice}
            targets={targets}
            onChange={(c) => {
              setChoice(c)
              setError(undefined)
            }}
            error={error}
          />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${btnPrimary} disabled:cursor-wait disabled:opacity-70`}>
          {saving ? 'Saving…' : 'Save link'}
        </button>
      </div>
    </form>
  )
}

interface Pending {
  file: File
  choice: LinkChoice
  /** Why it will be skipped (wrong type or too large), checked before upload. */
  problem?: string
  /** Set once sent: the saved file, or why the server refused it. */
  result?: DocFile | string
}

const supported = (f: File) => /\.(pdf|png|jpe?g)$/i.test(f.name)

type Upload = (file: File, c: LinkChoice) => Promise<DocFile | string>

/** Files picked or dropped: say what each one is linked to, then upload them one by one. */
export function UploadDialog({
  files,
  targets,
  upload,
  onClose,
  onDone,
}: {
  files: File[] | null
  targets: LinkTargets
  upload: Upload
  onClose: () => void
  /** Called with every file that was saved, once all have been sent. */
  onDone: (uploaded: DocFile[], failed: number) => void
}) {
  return (
    <Dialog open={files !== null} onClose={onClose} labelledBy="upload-title" className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl">
      {files && <UploadForm files={files} targets={targets} upload={upload} onClose={onClose} onDone={onDone} />}
    </Dialog>
  )
}

function UploadForm({
  files,
  targets,
  upload,
  onClose,
  onDone,
}: {
  files: File[]
  targets: LinkTargets
  upload: Upload
  onClose: () => void
  onDone: (uploaded: DocFile[], failed: number) => void
}) {
  const [items, setItems] = useState<Pending[]>(() =>
    files.map((file) => ({
      file,
      choice: emptyChoice,
      problem: !supported(file)
        ? 'Not a PDF, JPG, or PNG, so it will be skipped.'
        : file.size / 1024 > MAX_KB
          ? `Larger than ${formatSize(MAX_KB)}, so it will be skipped.`
          : undefined,
    })),
  )
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [sent, setSent] = useState<number | null>(null)
  // Files the server refused stay in the list to fix and send again.
  const todo = items.filter((i) => !i.problem && typeof i.result !== 'object')
  const busy = sent !== null

  const submit = async () => {
    const next: Record<number, string> = {}
    items.forEach((it, i) => {
      if (!it.problem && typeof it.result !== 'object' && !linkComplete(it.choice)) next[i] = 'Choose the record, or link it to nothing yet.'
    })
    setErrors(next)
    if (Object.keys(next).length) return

    setSent(0)
    const results = [...items]
    for (let i = 0; i < results.length; i++) {
      const it = results[i]
      if (it.problem || typeof it.result === 'object') continue
      results[i] = { ...it, result: await upload(it.file, it.choice) }
      setItems([...results])
      setSent((n) => (n ?? 0) + 1)
    }
    setSent(null)
    const saved = results.flatMap((r) => (typeof r.result === 'object' ? [r.result] : []))
    const failed = results.filter((r) => typeof r.result === 'string').length
    onDone(saved, failed)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="upload-title" className="font-serif text-2xl font-semibold text-stone-900">
            Upload {files.length} {files.length === 1 ? 'file' : 'files'}
          </h2>
          <p className="text-sm text-stone-600">Link each file to the record it belongs to. You can leave a file unlinked and file it later.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
        >
          <Icon name="close" />
        </button>
      </div>
      <ul className="max-h-[55dvh] divide-y divide-stone-100 overflow-y-auto border-y border-stone-100">
        {items.map((it, i) => (
          <li key={`${it.file.name}-${i}`} className="px-6 py-4">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold break-all text-stone-900">{it.file.name}</span>
              <span className="text-sm text-stone-600">{formatSize(Math.max(1, Math.round(it.file.size / 1024)))}</span>
            </p>
            {it.problem ? (
              <p className="mt-1 text-sm font-semibold text-red-700">{it.problem}</p>
            ) : typeof it.result === 'object' ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-forest">
                <Icon name="check" className="size-4" strokeWidth={2.5} />
                Uploaded · {it.result.link.title}
              </p>
            ) : (
              <div className="mt-3">
                {typeof it.result === 'string' && (
                  <p role="alert" className="mb-2 text-sm font-semibold text-red-700">
                    {it.result}
                  </p>
                )}
                <LinkPicker
                  value={it.choice}
                  targets={targets}
                  onChange={(c) => {
                    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, choice: c } : x)))
                    setErrors((e) => ({ ...e, [i]: '' }))
                  }}
                  error={errors[i] || undefined}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col-reverse gap-2 bg-ivory/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
        {busy && (
          <p className="text-sm text-stone-700 sm:mr-auto" role="status">
            Uploaded {sent} of {todo.length + sent}…
          </p>
        )}
        <button type="button" onClick={onClose} disabled={busy} className={`${btnSecondary} disabled:opacity-50`}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!todo.length || busy} className={btnPrimary}>
          <Icon name="upload" className="size-4.5" />
          {busy ? 'Uploading…' : `Upload ${todo.length} ${todo.length === 1 ? 'file' : 'files'}`}
        </button>
      </div>
    </div>
  )
}
