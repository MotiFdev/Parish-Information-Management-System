import bgImage from '../../../assets/bgimage.jpg'
import { cardClass } from '../../../components/ui/styles'
import { parish } from '../sampleData'
import { carmelGroups, carmelIntro, shjpHistory } from './historyContent'

export function HistorySection() {
  return (
    <section className={`overflow-hidden ${cardClass}`}>
      <div className="grid lg:grid-cols-5">
        <div className="p-6 sm:p-8 lg:col-span-3 lg:p-10">
          <h2 className="font-serif text-3xl leading-tight font-semibold text-stone-900 sm:text-4xl">Our parish history</h2>
          <h3 className="mt-6 font-serif text-2xl font-semibold text-forest">SHJP History</h3>

          {/* A timeline because the story is told year by year. */}
          <ol lang="ceb" className="mt-6">
            {shjpHistory.map((period, i) => (
              <li key={period.label} className="relative grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
                <p className="font-serif text-xl font-bold text-brown sm:pt-0.5 sm:text-right">{period.label}</p>
                <div className={`relative border-l-2 border-forest-soft pl-6 ${i < shjpHistory.length - 1 ? 'pb-8' : ''}`}>
                  <span
                    className="absolute top-2 -left-[7px] size-3 rounded-full bg-forest ring-4 ring-white"
                    aria-hidden="true"
                  />
                  {period.paragraphs.map((p) => (
                    <p key={p.slice(0, 24)} className="mb-3 leading-relaxed text-stone-700 last:mb-0">
                      {p}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-stone-100 lg:col-span-2 lg:border-t-0 lg:border-l">
          {/* Drawing and facts stay in view together while the long timeline scrolls past. */}
          <div className="lg:sticky lg:top-16">
            <div
              className="h-64 bg-parchment bg-cover bg-[position:72%_60%] sm:h-80 lg:h-[26rem]"
              style={{ backgroundImage: `url(${bgImage})` }}
              role="img"
              aria-label="Drawing of the parish church and bell tower"
            />
            <dl className="grid grid-cols-2 gap-4 bg-white p-6 sm:p-8">
              <div>
                <dt className="text-sm font-semibold text-stone-600">Patron</dt>
                <dd className="mt-1 font-serif text-lg font-semibold text-forest">{parish.patron}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-stone-600">Feast day</dt>
                <dd className="mt-1 font-serif text-lg font-semibold text-forest">{parish.feastDay}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div lang="ceb" className="border-t border-stone-200 bg-ivory/50 p-6 sm:p-8 lg:p-10">
        <h3 className="font-serif text-2xl font-semibold text-forest">
          Kasaysayan sa Our Lady of Mt. Carmel and Carmelites Order
        </h3>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-stone-700">{carmelIntro}</p>

        <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {carmelGroups.map((group) => (
            <section key={group.title}>
              <h4 lang="en" className="font-serif text-xl font-semibold text-stone-900">
                {group.title}
              </h4>
              <dl className="mt-3 space-y-4">
                {group.items.map((item) => (
                  <div key={item.term}>
                    <dt lang="en" className="font-semibold text-brown">
                      {item.term}
                    </dt>
                    {item.text.map((t) => (
                      <dd key={t.slice(0, 24)} className="mt-1 leading-relaxed text-stone-700">
                        {t}
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
