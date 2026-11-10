import type { AnnouncementCategory } from '../../parishioner/sampleData'

// Types and helpers for the staff Announcements page (backend Staff\AnnouncementController).
// Scheduled is a Published post whose publish time has not come yet.
export const announcementStatuses = ['Draft', 'Scheduled', 'Published', 'Archived'] as const
export type AnnouncementStatus = (typeof announcementStatuses)[number]

export const categories: AnnouncementCategory[] = ['Parish', 'Liturgy', 'Sacraments', 'Chapels']

export interface Notice {
  id: string
  title: string
  category: AnnouncementCategory
  status: AnnouncementStatus
  /** Sanitized HTML from the editor. */
  body: string
  pinned: boolean
  /** When it went live (Published, Archived) or will go live (Scheduled); null for drafts. */
  publishAt: string | null
  author: string
  updatedAt: string
}

/* ---------- Rich text ---------- */

const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'H3', 'UL', 'OL', 'LI', 'A'])
const RENAME: Record<string, string> = { B: 'STRONG', I: 'EM', DIV: 'P', H1: 'H3', H2: 'H3', H4: 'H3' }

/**
 * Keeps only the formatting the toolbar can make. Anything else (pasted
 * styles, scripts, images) is unwrapped to its text. The server must sanitize
 * again; this only keeps the preview honest.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walk = (node: Element, out: Element) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) out.append(child.textContent ?? '')
      else if (child instanceof Element) {
        const tag = RENAME[child.tagName] ?? child.tagName
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(tag)) continue
        if (!ALLOWED.has(tag)) {
          walk(child, out)
          continue
        }
        const el = doc.createElement(tag)
        if (tag === 'A') {
          const href = child.getAttribute('href') ?? ''
          if (!/^(https?:|mailto:|tel:)/i.test(href)) {
            walk(child, out)
            continue
          }
          el.setAttribute('href', href)
          el.setAttribute('rel', 'noopener noreferrer')
          el.setAttribute('target', '_blank')
        }
        walk(child, el)
        // Empty paragraphs and list items are left behind by Enter; they carry nothing.
        if (['P', 'H3', 'LI'].includes(tag) && !el.textContent?.trim()) continue
        out.append(el)
      }
    }
  }
  const clean = doc.createElement('div')
  walk(doc.body, clean)
  return clean.innerHTML
}

/** The text of a body, with a space where one block ends and the next begins. */
export const plainText = (html: string) =>
  (new DOMParser().parseFromString(html.replace(/<(\/p|\/li|\/h3|\/div|br)/gi, ' <$1'), 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim()

/* ---------- Dates (Manila time, as the parish works in it) ---------- */

const TZ = 'Asia/Manila'
const fmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
const fmtDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })
export const whenLabel = (iso: string) => fmt.format(new Date(iso))
export const dateLabel = (iso: string) => fmtDate.format(new Date(iso))

/** Splits an instant into the Manila date and time an input shows. */
export const toManilaInputs = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString()
  return { date: d.slice(0, 10), time: d.slice(11, 16) }
}
export const fromManilaInputs = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`).toISOString()
