import { useState } from 'react'

interface Props {
  photoUrl?: string | null
  initials: string
  /** Tailwind size and text classes, e.g. "size-9 text-sm". */
  className?: string
}

/** The account's profile picture, or its initials when there is none or it fails to load. */
export function Avatar({ photoUrl, initials, className = 'size-9 text-sm' }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = photoUrl && failed !== photoUrl

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-forest font-semibold text-white ${className}`} aria-hidden="true">
      {showPhoto ? <img src={photoUrl} alt="" className="size-full object-cover" onError={() => setFailed(photoUrl)} /> : initials}
    </span>
  )
}
