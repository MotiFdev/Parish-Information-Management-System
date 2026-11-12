import { Reveal } from '../components/Reveal'
import { ErrorState, LoadingState } from '../components/ui/DataState'
import { Icon } from '../components/ui/Icon'
import { cardClass, inputClass } from '../components/ui/styles'
import { nextFiesta } from '../features/parishioner/chapels/fiesta'
import { OfficerAvatar } from '../features/parishioner/chapels/OfficerAvatar'
import { usePublicChapels } from '../features/parishioner/chapels/publicChapelsApi'
import { byRank, ministries, type Chapel, type Officer, type SonaOption } from '../features/community/chapels/chapelsData'
import { ParishionerLayout } from '../layouts/ParishionerLayout'
import { navigate, useLocation } from '../lib/router'

const PATH = '/parishioner/chapels'
const council = ['President', 'V-President', 'Secretary', 'Treasurer', 'Auditor']
const longDate = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
const tel = (n: string) => `tel:${n.replace(/\s/g, '')}`

function fiestaNote(text: string) {
  const next = nextFiesta(text)
  if (!next) return null
  return next.days === 0 ? 'Today' : next.days === 1 ? 'Tomorrow' : `${longDate.format(next.date)}, in ${next.days} days`
}

// Parishioners see officers' names, positions, and ministries. Ages and
// personal numbers stay in the staff directory; only the president's number is
// shown, because chapel Masses and intentions are arranged through them.

function Hero({
  chapel,
  president,
  chapels,
  sonas,
  onChoose,
}: {
  chapel: Chapel
  president?: Officer
  chapels: Chapel[]
  sonas: SonaOption[]
  onChoose: (id: string) => void
}) {
  const sona = sonas.find((s) => s.id === chapel.sonaId)
  const fiesta = chapel.fiesta ? fiestaNote(chapel.fiesta) : null

  return (
    <section aria-labelledby="pc-name" className="border-b border-stone-300/50 bg-parchment">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:px-8 lg:py-14">
        <div className="min-w-0">
          <p className="font-serif text-xl font-semibold text-brown">Chapels & Officers</p>
          <h1 id="pc-name" tabIndex={-1} className="mt-2 font-serif text-4xl leading-[1.05] font-bold text-forest sm:text-5xl xl:text-6xl">
            {chapel.name}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-stone-700">
            {sona?.name}
          </p>

          {/* The two facts people ask the office about most: who the chapel honours, and when the fiesta is. */}
          <dl className="mt-7 grid max-w-xl gap-x-10 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-stone-600">Patron</dt>
              <dd className="font-serif text-2xl font-semibold text-stone-900">{chapel.patron || 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-stone-600">Fiesta</dt>
              <dd className="font-serif text-2xl font-semibold text-stone-900">{chapel.fiesta || 'Not recorded'}</dd>
              {fiesta && <dd className="text-sm text-stone-700">{fiesta}</dd>}
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            {president?.contact && (
              <a href={tel(president.contact)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest px-5 py-3 font-semibold text-white shadow-sm hover:bg-forest-dark">
                <Icon name="phone" className="size-4.5" />
                Call the chapel president
              </a>
            )}
            {chapel.contact && (
              <a href={tel(chapel.contact)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-forest/25 bg-white/90 px-5 py-3 font-semibold text-forest hover:bg-white">
                <Icon name="church" className="size-4.5" />
                Call the chapel
              </a>
            )}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <label htmlFor="pc-chapel" className="block font-semibold text-stone-900">
            Viewing another chapel?
          </label>
          <p className="mt-0.5 text-sm text-stone-600">Choose any chapel in the parish.</p>
          <select id="pc-chapel" value={chapel.id} onChange={(e) => onChoose(e.target.value)} className={`${inputClass} mt-3 font-semibold`}>
            {sonas.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {chapels
                  .filter((c) => c.sonaId === s.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {chapel.fbAccount && (
            <p className="mt-4 border-t border-stone-100 pt-3 text-sm text-stone-700">
              On Facebook: <span className="font-semibold text-stone-900">{chapel.fbAccount}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default function ChapelsPage() {
  const { state, retry } = usePublicChapels()
  const { query } = useLocation()
  const directory = typeof state === 'object' ? state : null
  const chapels = directory?.chapels ?? []
  const sonas = directory?.sonas ?? []
  const term = directory?.term ?? new Date().getFullYear()
  // ?chapel= picks the chapel; otherwise the first one in Sona order.
  const firstChapel = sonas.flatMap((s) => chapels.filter((c) => c.sonaId === s.id))[0]
  const chapel = chapels.find((c) => c.id === query.get('chapel')) ?? firstChapel
  const officers = chapel ? (directory?.officers ?? []).filter((o) => o.chapelId === chapel.id).sort(byRank) : []
  const president = officers.find((o) => o.position === 'President')
  const councilRest = officers.filter((o) => council.includes(o.position) && o !== president)
  const byMinistry = ministries.map((m) => ({ ministry: m, people: officers.filter((o) => o.ministry === m && !council.includes(o.position)) })).filter((g) => g.people.length)
  const others = officers.filter((o) => !council.includes(o.position) && !o.ministry)

  const choose = (id: string, scroll = false) => {
    const p = new URLSearchParams(query)
    p.set('chapel', id)
    navigate(`${PATH}${p.size ? `?${p}` : ''}`, { replace: true })
    if (scroll) {
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      document.getElementById('pc-name')?.focus({ preventScroll: true })
    }
  }

  const hero = chapel ? (
    <Hero chapel={chapel} president={president} chapels={chapels} sonas={sonas} onChoose={(id) => choose(id)} />
  ) : (
    <section className="border-b border-stone-300/50 bg-parchment">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <h1 className="font-serif text-4xl font-bold text-forest sm:text-5xl">Chapels & Officers</h1>
      </div>
    </section>
  )

  return (
    <ParishionerLayout activeHref={PATH} hero={hero}>
      {state === 'loading' || state === 'error' ? (
        <div className={cardClass}>{state === 'loading' ? <LoadingState what="the chapels" variant="list" /> : <ErrorState what="the chapels" onRetry={retry} />}</div>
      ) : !chapel ? (
        <div className={`${cardClass} px-5 py-12 text-center`}>
          <p className="font-semibold text-stone-800">No chapels are listed yet</p>
          <p className="mt-1 text-sm text-stone-600">Chapels appear here once the PPC approves them. For now, contact the parish office.</p>
        </div>
      ) : (
        <>
          <Reveal>
            <section aria-labelledby="pc-council">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="pc-council" className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
                  Chapel council
                </h2>
                <p className="text-stone-600">Serving in {term}</p>
              </div>

              {officers.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-10 text-center text-stone-600">
                  The {term} officer list for {chapel.name} has not been posted yet.
                </p>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* The president is the chapel's contact person, so they get the one dark panel on the page. */}
                  {president && (
                    <article className="flex flex-col rounded-2xl bg-forest p-6 text-white md:row-span-2">
                      <OfficerAvatar officer={president} size="lg" tone="dark" />
                      <p className="mt-5 text-sm font-semibold text-gold-soft">Chapel president</p>
                      <h3 className="mt-1 font-serif text-3xl leading-tight font-semibold">{president.name}</h3>
                      <p className="mt-3 leading-relaxed text-white/85">Arrange chapel Masses, intentions, and activities with the president.</p>
                      {president.contact && (
                        <a href={tel(president.contact)} className="mt-auto inline-flex min-h-11 items-center gap-2 self-start pt-6 font-semibold text-white underline-offset-4 hover:underline">
                          <Icon name="phone" className="size-4.5" />
                          {president.contact}
                        </a>
                      )}
                    </article>
                  )}
                  {councilRest.map((o) => (
                    <div key={o.id} className={`${cardClass} flex items-center gap-4 p-5`}>
                      <OfficerAvatar officer={o} />
                      <div className="min-w-0">
                        <p className="font-semibold break-words text-stone-900">{o.name}</p>
                        <p className="text-sm text-stone-600">{o.position}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </Reveal>

          {(byMinistry.length > 0 || others.length > 0) && (
            <Reveal className="mt-14 lg:mt-16">
              <section aria-labelledby="pc-ministries">
                <h2 id="pc-ministries" className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
                  Ministries
                </h2>
                <p className="mt-1 max-w-2xl text-stone-600">The people who lead each part of chapel life. Ask them about joining.</p>
                <ul className="mt-6 grid gap-x-10 border-t border-stone-300/70 sm:grid-cols-2 lg:grid-cols-3">
                  {[...byMinistry, ...(others.length ? [{ ministry: 'Other officers', people: others }] : [])].map((g) => (
                    <li key={g.ministry} className="border-b border-stone-300/70 py-5">
                      <h3 className="font-serif text-xl font-semibold text-forest">{g.ministry}</h3>
                      <ul className="mt-3 space-y-3">
                        {g.people.map((o) => (
                          <li key={o.id} className="flex items-center gap-3">
                            <OfficerAvatar officer={o} size="sm" />
                            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                              <span className="font-medium break-words text-stone-900">{o.name}</span>
                              <span className="text-sm text-stone-600">{o.position}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}

          <Reveal className="mt-14 lg:mt-16">
            <section aria-labelledby="pc-all">
              <h2 id="pc-all" className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
                Chapels of the parish
              </h2>
              <p className="mt-1 max-w-2xl text-stone-600">
                {chapels.length} chapels across {sonas.length} Sonas. Choose one to see its council and contacts.
              </p>
              {/* One even grid in Sona order; most Sonas have a single chapel, so per-Sona rows would leave gaps. */}
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sonas.flatMap((s) => chapels.filter((c) => c.sonaId === s.id)).map((c) => {
                  const current = c.id === chapel.id
                  const fiesta = nextFiesta(c.fiesta)
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => choose(c.id, true)}
                        aria-current={current ? 'true' : undefined}
                        className={`flex h-full min-h-11 w-full flex-col rounded-2xl border p-5 text-left transition-colors ${
                          current ? 'border-forest bg-forest-soft' : 'border-stone-200 bg-white hover:border-forest/50'
                        }`}
                      >
                        <span className="flex w-full items-start justify-between gap-2 text-xs font-semibold text-brown">
                          {sonas.find((s) => s.id === c.sonaId)?.name}
                        </span>
                        <span className="mt-1.5 font-serif text-xl leading-snug font-semibold text-stone-900">{c.name}</span>
                        <span className="text-sm text-stone-600">Patron: {c.patron}</span>
                        <span className="mt-auto pt-3 text-sm text-stone-700">
                          Fiesta: {c.fiesta || 'Not recorded'}
                          {fiesta && fiesta.days <= 30 && <span className="font-semibold text-brown"> · {fiesta.days === 0 ? 'today' : `in ${fiesta.days} days`}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-8 text-sm text-stone-600">Is something here out of date? Tell the parish office and they will correct it.</p>
            </section>
          </Reveal>
        </>
      )}
    </ParishionerLayout>
  )
}
