import { Dialog } from '../../../components/ui/Dialog'
import { Icon } from '../../../components/ui/Icon'
import { btnPrimary, btnSecondary } from '../../../components/ui/styles'
import { parish } from '../../parishioner/sampleData'
import type { RegisterEntry } from '../../priest/registerData'

const longDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
const registerName: Record<RegisterEntry['type'], string> = { Baptism: 'Baptismal', Confirmation: 'Confirmation', Marriage: 'Marriage', Burial: 'Burial' }

// "Generate Certificate preview" from section 4.3. It is a draft on purpose: a
// certificate is only issued through a Certificate Request the priest approves
// and signs (section 1), so this never stands in for that.
export function CertificatePreview({ entry, onClose }: { entry: RegisterEntry | null; onClose: () => void }) {
  return (
    <Dialog open={entry !== null} onClose={onClose} labelledBy="cert-title" className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl">
      {entry && (
        <>
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 print:hidden">
            <div>
              <h2 id="cert-title" className="font-serif text-2xl font-semibold text-stone-900">
                Certificate preview
              </h2>
              <p className="text-sm text-stone-600">A draft for checking the wording. It is not valid until the priest signs it.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close preview" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
              <Icon name="close" />
            </button>
          </div>

          <div className="px-6 pb-2">
            <article id="certificate-print" aria-label={`Certificate of ${entry.type}, draft`} className="relative overflow-hidden rounded-lg border border-stone-300 bg-white px-6 py-8 sm:px-10">
              <p className="pointer-events-none absolute inset-0 grid -rotate-12 place-items-center font-serif text-6xl font-semibold text-stone-200 select-none sm:text-7xl" aria-hidden="true">
                DRAFT
              </p>
              <div className="relative">
                <p className="text-center font-serif text-lg font-semibold text-forest">{parish.name}</p>
                <h3 className="mt-1 text-center font-serif text-3xl font-semibold text-stone-900">Certificate of {entry.type}</h3>
                <p className="mx-auto mt-4 max-w-lg text-center leading-relaxed text-stone-800">
                  This is to certify that the following appears in the {registerName[entry.type]} Register of this parish, Book {entry.register.book}, Page {entry.register.page}, Line {entry.register.line}.
                </p>
                <dl className="mx-auto mt-5 grid max-w-lg grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-sm">
                  {entry.details
                    .filter(([k]) => !k.startsWith('Informant'))
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-stone-600">{k}</dt>
                        <dd className="font-medium text-stone-900">{v}</dd>
                      </div>
                    ))}
                </dl>
                <div className="mt-10 flex flex-wrap items-end justify-between gap-6 text-sm">
                  <p className="text-stone-700">Issued {longDate.format(new Date())}</p>
                  <div className="w-56 text-center">
                    <div className="h-10 border-b border-stone-500" aria-hidden="true" />
                    <p className="mt-1 font-semibold text-stone-900">Parish Priest</p>
                    <p className="text-xs text-stone-600">Signature and parish seal</p>
                  </div>
                </div>
                <p className="mt-6 text-center text-xs font-semibold text-brown">Draft. Not valid until signed by the parish priest.</p>
              </div>
            </article>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-ivory/50 px-6 py-4 sm:flex-row sm:justify-end print:hidden">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Close
            </button>
            <button type="button" onClick={() => window.print()} className={btnPrimary}>
              <Icon name="file" className="size-4.5" />
              Print draft
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
