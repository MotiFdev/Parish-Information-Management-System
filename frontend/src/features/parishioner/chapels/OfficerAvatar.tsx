import { useState } from 'react'
import type { Officer } from '../../community/chapels/chapelsData'
import { initials, officerPhoto } from './officerPhoto'

const sizes = { sm: 'size-9 text-sm', md: 'size-12 text-lg', lg: 'size-20 text-2xl' }

/** Officer portrait, falling back to initials while offline or if the image fails. */
export function OfficerAvatar({ officer, size = 'md', tone = 'light' }: { officer: Officer; size?: keyof typeof sizes; tone?: 'light' | 'dark' }) {
  const [failed, setFailed] = useState(false)
  const ring = tone === 'dark' ? 'ring-2 ring-white/30' : 'ring-1 ring-stone-200'

  if (failed) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full font-serif font-semibold ${sizes[size]} ${tone === 'dark' ? 'bg-white/15 text-white' : 'bg-brown-soft text-brown'}`}
      >
        {initials(officer.name)}
      </span>
    )
  }

  return (
    <img
      src={officerPhoto(officer)}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-stone-200 object-cover ${sizes[size]} ${ring}`}
    />
  )
}
