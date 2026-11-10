import type { ReactNode } from 'react'
import bgImage from '../assets/bgimage.jpg'
import logo from '../assets/parish-logo.jpg'
import { parish } from '../features/parishioner/sampleData'

/**
 * The parish background with one white card and the parish name on top, shared
 * by sign-in, sign-up, forgot password, and the set-password page.
 */
export function AuthCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="min-h-dvh bg-parchment bg-[length:190%_auto] bg-[position:80%_100%] bg-no-repeat sm:bg-[length:130%_auto] sm:bg-[position:100%_100%] lg:bg-cover lg:bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div
        className={`mx-auto flex min-h-dvh max-w-7xl items-start px-4 pt-8 sm:px-6 sm:pt-14 lg:items-center lg:px-8 lg:py-12 ${
          wide ? 'pb-16' : 'pb-[80vw] sm:pb-[60vw]'
        }`}
      >
        <div className={`w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-9 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="size-14 rounded-full bg-white object-cover ring-1 ring-gold/60" />
            <div>
              <p className="font-serif text-xl leading-tight font-semibold text-forest">{parish.shortName}</p>
              <p className="text-sm text-stone-500">Parish Information Management System</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
