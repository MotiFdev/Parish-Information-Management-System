import { Dialog } from './ui/Dialog'
import { Icon } from './ui/Icon'
import { btnSecondary } from './ui/styles'

export interface ViewableFile {
  label: string
  file: string
  note?: string
  /** A short-lived signed link to the stored file. Without one, a placeholder shows (sample data). */
  url?: string
  /** True while the link is being fetched. */
  loading?: boolean
  /** Set when the link could not be fetched. */
  error?: string
}

interface Props {
  doc: ViewableFile | null
  onClose: () => void
  /** Shown on Certificate Approvals, where the priest verifies each document; absent when read-only. */
  verify?: { verified: boolean; onToggle: () => void }
}

const kind = (file: string) => (/\.pdf$/i.test(file) ? 'PDF document' : 'Image')

// Uploaded files are private; callers fetch a short-lived signed link and pass it as `url`.
export function DocumentViewer({ doc, onClose, verify }: Props) {
  const name = doc ? (doc.note && doc.label === 'Other' ? doc.note : doc.label) : ''

  return (
    <Dialog
      open={doc !== null}
      onClose={onClose}
      labelledBy="viewer-title"
      className="m-auto h-[min(48rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-3xl rounded-2xl"
    >
      {doc && (
        <div className="flex h-full flex-col">
          <header className="flex items-start gap-3 border-b border-stone-200 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="viewer-title" className="font-serif text-2xl font-semibold text-stone-900">
                {name}
              </h2>
              <p className="text-sm break-all text-stone-600">
                {doc.file} · {kind(doc.file)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document"
              className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            >
              <Icon name="close" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto bg-stone-100 p-4 sm:p-6">
            {doc.url ? (
              /\.pdf$/i.test(doc.file) ? (
                <iframe src={doc.url} title={name} className="h-full min-h-96 w-full rounded-lg border border-stone-300 bg-white" />
              ) : (
                <img src={doc.url} alt={name} className="mx-auto max-h-full max-w-full rounded-lg bg-white object-contain shadow-sm" />
              )
            ) : (
              <div className="mx-auto flex h-full min-h-64 max-w-xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-400 bg-white px-6 text-center">
                <Icon name="file" className="size-10 text-stone-500" />
                {doc.loading ? (
                  <p className="font-semibold text-stone-800">Opening the file…</p>
                ) : doc.error ? (
                  <p role="alert" className="max-w-sm text-sm text-red-800">
                    {doc.error}
                  </p>
                ) : (
                  <>
                    <p className="font-semibold text-stone-800">The file shows here</p>
                    <p className="max-w-sm text-sm text-stone-600">
                      This is a design preview, so no real file is attached. {doc.note && doc.label !== 'Other' ? `Secretary note: ${doc.note}` : ''}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-ivory px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            {verify && (
              <p className="flex items-center gap-1.5 text-sm text-stone-600 sm:mr-auto">
                <Icon name="check" className="size-4 text-forest" strokeWidth={2.5} />
                Verified by the secretary
              </p>
            )}
            <button type="button" onClick={onClose} className={btnSecondary}>
              Close
            </button>
            {verify && (
              <button
                type="button"
                aria-pressed={verify.verified}
                onClick={verify.onToggle}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 font-semibold ${
                  verify.verified ? 'bg-forest text-white hover:bg-forest-dark' : 'border border-forest/40 bg-white text-forest hover:bg-forest-soft'
                }`}
              >
                <Icon name="check" className="size-4.5" strokeWidth={2.5} />
                {verify.verified ? 'Verified by you' : 'Verify this document'}
              </button>
            )}
          </footer>
        </div>
      )}
    </Dialog>
  )
}
