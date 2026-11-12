import { useState } from 'react'
import type { Officer } from '../../community/chapels/chapelsData'
import { initials } from './officerPhoto'

const sizes = { sm: 'size-9 text-sm', md: 'size-12 text-lg', lg: 'size-20 text-2xl', xl: 'size-24 text-3xl' }

/** The officer's uploaded picture, or their initials when there is none or it fails to load. */
export function OfficerAvatar({ officer, size = 'md', tone = 'light' }: { officer: Pick<Officer, 'name' | 'photo'>; size?: keyof typeof sizes; tone?: 'light' | 'dark' }) {
  const [failed, setFailed] = useState<string | null>(null)
  const ring = tone === 'dark' ? 'ring-2 ring-white/30' : 'ring-1 ring-stone-200'
  const photo = officer.photo && failed !== officer.photo ? officer.photo : null

  if (!photo) {
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
      src={photo}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(photo)}
      className={`shrink-0 rounded-full bg-stone-200 object-cover ${sizes[size]} ${ring}`}
    />
  )
}
