export const inputClass =
  'block w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-800 placeholder:text-stone-400 focus:border-forest focus:ring-2 focus:ring-forest/35 focus:outline-none focus-visible:outline-none [&:is(input,textarea):read-only]:bg-stone-50 [&:is(input,textarea):read-only]:text-stone-600 aria-invalid:border-red-500'

export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-5 py-2.5 font-semibold text-white transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50'

export const btnSecondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest/25 bg-white px-5 py-2.5 font-semibold text-forest transition-colors hover:bg-forest-soft'

// Flat on purpose: the border separates cards from the ivory page. Shadow is
// kept for surfaces that float above content (menus, toast, login card).
export const cardClass = 'rounded-2xl border border-stone-200 bg-white'

// Filter and choice chips. 44px tall so they work as thumb targets.
export const chipClass = (selected: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
    selected ? 'bg-forest text-white' : 'border border-stone-300 bg-white text-stone-700 hover:border-forest/50 hover:text-forest'
  }`

// Only for actions that lock someone out or remove something; red keeps them
// from looking like the routine forest-green primary.
export const btnDanger =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50'
