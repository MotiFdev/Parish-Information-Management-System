import { Link } from '../components/Link'
import { Reveal } from '../components/Reveal'
import { Icon } from '../components/ui/Icon'
import { PageBanner } from '../components/ui/PageBanner'
import { btnPrimary, cardClass } from '../components/ui/styles'
import { recordTypes } from '../features/parishioner/requests/recordTypes'
import { TrackForm } from '../features/parishioner/tracking/TrackForm'
import { ParishionerLayout } from '../layouts/ParishionerLayout'

export default function RequestsPage() {
  return (
    <ParishionerLayout
      activeHref="/parishioner/requests"
      hero={
        <PageBanner
          title="Record Requests"
          description="Request certificates, register a sacrament, or correct an entry. No account needed: you get a reference number to follow the request until it is released."
          actions={
            <Link href="/parishioner/requests/new" className={btnPrimary}>
              <Icon name="plus" />
              New request
            </Link>
          }
        />
      }
    >
      <Reveal>
        <section aria-labelledby="start-heading">
          <h2 id="start-heading" className="font-serif text-2xl font-semibold text-stone-900">
            Start a request
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {recordTypes.map((t) => (
              <Link
                key={t.type}
                href={`/parishioner/requests/new?type=${t.slug}`}
                className={`group flex flex-col p-4 transition-colors hover:border-forest/40 sm:p-5 ${cardClass}`}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-forest-soft text-forest">
                  <Icon name={t.icon} />
                </span>
                <span className="mt-3 font-semibold text-stone-900 group-hover:text-forest">{t.type}</span>
                <span className="mt-1 hidden text-sm leading-snug text-stone-600 sm:block">{t.blurb}</span>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-10">
        <section aria-labelledby="track-heading" className={`max-w-2xl p-5 sm:p-6 ${cardClass}`}>
          <h2 id="track-heading" className="font-serif text-2xl font-semibold text-stone-900">
            Already sent one?
          </h2>
          <p className="mt-1 mb-4 text-stone-600">See its status, read remarks from the office, and upload documents they ask for.</p>
          <TrackForm id="track-request" />
        </section>
      </Reveal>
    </ParishionerLayout>
  )
}
