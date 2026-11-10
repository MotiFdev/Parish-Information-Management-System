import { useEffect } from 'react'
import bgImage from '../assets/bgimage.jpg'
import { Link } from '../components/Link'
import { Reveal } from '../components/Reveal'
import { Icon } from '../components/ui/Icon'
import { AnnouncementsSection } from '../features/parishioner/home/AnnouncementsSection'
import { EventsSection } from '../features/parishioner/home/EventsSection'
import { HistorySection } from '../features/parishioner/home/HistorySection'
import { useOfficeHours } from '../features/parishioner/officeHours'
import { massSchedule, parish } from '../features/parishioner/sampleData'
import { ParishionerLayout } from '../layouts/ParishionerLayout'
import { scrollToHash } from '../lib/router'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function ParishionerHome() {
  // A link like /home#history, opened fresh, arrives before the sections render.
  useEffect(() => {
    scrollToHash(window.location.hash)
  }, [])

  const sunday = massSchedule[0]
  const officeHours = useOfficeHours()

  // The artwork's sky is the same parchment as the nav bar, so the hero reads as
  // one continuous surface. On phones the church sits below the copy; from lg up
  // the copy occupies the empty left half of the image.
  const hero = (
    <section
      className="relative overflow-hidden border-b border-stone-300/50 bg-parchment bg-[length:175%_auto] bg-[position:82%_100%] bg-no-repeat sm:bg-[length:130%_auto] sm:bg-[position:100%_100%] lg:bg-cover lg:bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-parchment from-60% to-transparent sm:h-1/2 lg:inset-y-0 lg:right-auto lg:h-auto lg:w-3/5 lg:bg-gradient-to-r lg:from-parchment lg:from-40% xl:w-1/2"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-7xl px-4 pt-10 pb-[78vw] sm:px-6 sm:pt-14 sm:pb-[64vw] lg:min-h-[min(55.8vw,calc(100dvh-4rem))] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-xl lg:max-w-md xl:max-w-lg">
          <p className="font-serif text-xl font-semibold text-brown">{parish.name}</p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] font-bold text-forest sm:text-5xl xl:text-6xl">{greeting()}, and welcome.</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-700">
            Request certificates and book Mass intentions or blessings online, no account needed. Each request gets a reference number you can track until it is
            done.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/parishioner/requests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 font-semibold text-white shadow-sm hover:bg-forest-dark"
            >
              <Icon name="plus" />
              New record request
            </Link>
            <Link
              href="/parishioner/appointments"
              className="inline-flex items-center gap-2 rounded-xl border border-forest/25 bg-white/90 px-5 py-3 font-semibold text-forest hover:bg-white"
            >
              <Icon name="calendar" />
              Book appointment
            </Link>
          </div>

          <ul className="mt-7 flex flex-col items-start gap-2">
            <li className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm text-stone-700 shadow-sm">
              <Icon name="church" className="size-4 shrink-0 text-brown" />
              <span>
                Sunday Masses: <span className="font-semibold tabular-nums">{sunday.times.join(' · ')}</span>
              </span>
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm text-stone-700 shadow-sm">
              <Icon name="clock" className="size-4 shrink-0 text-brown" />
              <span>
                Parish office: <span className="font-semibold">{officeHours}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )

  return (
    <ParishionerLayout activeHref="/home" hero={hero}>
      {/* Stacked sections, each with its own heading, separated by whitespace and a rule. */}
      <Reveal>
        <section id="overview" aria-labelledby="overview-heading" className="scroll-mt-24">
          <h2 id="overview-heading" className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
            What you can do online
          </h2>
          <div className="mt-6">
            <Services />
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-14 lg:mt-16">
        <section id="events" aria-labelledby="events-heading" className="scroll-mt-24 border-t border-stone-300/70 pt-12 lg:pt-14">
          <h2 id="events-heading" className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
            Upcoming events
          </h2>
          <p className="mt-2 max-w-2xl text-stone-600">GKK and PYA-KKK activities across the parish, approved by the PPC.</p>
          <div className="mt-6">
            <EventsSection />
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-14 lg:mt-16">
        <section id="announcements" aria-labelledby="announcements-heading" className="scroll-mt-24 border-t border-stone-300/70 pt-12 lg:pt-14">
          <h2 id="announcements-heading" className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">
            Parish announcements
          </h2>
          <div className="mt-6">
            <AnnouncementsSection />
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-14 lg:mt-16">
        <section id="history" aria-label="Parish history" className="scroll-mt-24 border-t border-stone-300/70 pt-12 lg:pt-14">
          <HistorySection />
        </section>
      </Reveal>
    </ParishionerLayout>
  )
}

const services = [
  {
    icon: 'file' as const,
    title: 'Request a certificate',
    text: 'Baptismal, confirmation, marriage, and burial certificates, prepared by the parish office and signed by the priest.',
    href: '/parishioner/requests',
    cta: 'Start a request',
  },
  {
    icon: 'calendar' as const,
    title: 'Book an appointment',
    text: 'Mass intentions, house blessings, wedding pre-interviews, and counseling, at the church or your chapel.',
    href: '/parishioner/appointments',
    cta: 'Pick a time',
  },
  {
    icon: 'search' as const,
    title: 'Track a request',
    text: 'Enter the reference number you got to see where a request or appointment stands.',
    href: '/track',
    cta: 'Track it',
  },
]

function Services() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {services.map((s) => (
        <Link key={s.href} href={s.href} className="group flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 hover:border-forest/50 sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest-soft text-forest" aria-hidden="true">
            <Icon name={s.icon} className="size-5.5" />
          </span>
          <span className="min-w-0">
            <span className="block font-serif text-2xl font-semibold text-stone-900 group-hover:text-forest">{s.title}</span>
            <span className="mt-1 block text-stone-700">{s.text}</span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
              {s.cta}
              <Icon name="arrowRight" className="size-4" />
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
