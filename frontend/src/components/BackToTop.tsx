import { useEffect, useState } from 'react'
import { Icon } from './ui/Icon'

// Appears once the reader is more than a screen down; long pages (Home, the
// booking form) are otherwise a long thumb-scroll back to the nav.
export function BackToTop({ hidden = false }: { hidden?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible || hidden) return null

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }}
      className="grid size-12 place-items-center rounded-full border border-stone-300 bg-white text-forest shadow-lg transition-colors hover:bg-forest-soft"
    >
      <Icon name="arrowUp" />
    </button>
  )
}
