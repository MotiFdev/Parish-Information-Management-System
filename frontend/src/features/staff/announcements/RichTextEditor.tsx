import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../../../components/ui/Icon'
import { inputClass } from '../../../components/ui/styles'

interface Props {
  id: string
  labelledBy: string
  describedBy?: string
  initialHtml: string
  invalid?: boolean
  onChange: (html: string) => void
}

type Tool = { key: string; label: string; icon: IconName; shortcut?: string; active: boolean }

// A small editor on the browser's own contenteditable. execCommand is
// deprecated but still the only built-in way to format a selection; when the
// backend arrives this can be swapped for a maintained editor without
// changing the HTML it stores (the sanitizer defines the allowed tags).
export function RichTextEditor({ id, labelledBy, describedBy, initialHtml, invalid, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const saved = useRef<Range | null>(null)
  const [state, setState] = useState({ bold: false, italic: false, ul: false, ol: false, h3: false, link: false })
  const [linking, setLinking] = useState<{ url: string; error?: string } | null>(null)

  useEffect(() => {
    if (box.current) box.current.innerHTML = initialHtml || '<p><br></p>'
    // New lines become paragraphs rather than the browser's default divs.
    document.execCommand('defaultParagraphSeparator', false, 'p')
    // Only the first render seeds the content; after that the DOM is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const update = () => {
      const sel = document.getSelection()
      if (!sel?.anchorNode || !box.current?.contains(sel.anchorNode)) return
      const el = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement
      setState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        h3: !!el?.closest('h3'),
        link: !!el?.closest('a'),
      })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  const emit = () => box.current && onChange(box.current.innerHTML)
  const exec = (cmd: string, value?: string) => {
    box.current?.focus()
    document.execCommand(cmd, false, value)
    emit()
  }

  const tools: Tool[] = [
    { key: 'bold', label: 'Bold', icon: 'bold', shortcut: 'Ctrl+B', active: state.bold },
    { key: 'italic', label: 'Italic', icon: 'italic', shortcut: 'Ctrl+I', active: state.italic },
    { key: 'h3', label: 'Heading', icon: 'heading', active: state.h3 },
    { key: 'ul', label: 'Bulleted list', icon: 'list', active: state.ul },
    { key: 'ol', label: 'Numbered list', icon: 'listOrdered', active: state.ol },
    { key: 'link', label: state.link ? 'Remove link' : 'Add link', icon: 'link', active: state.link },
    { key: 'clear', label: 'Clear formatting', icon: 'eraser', active: false },
  ]

  const run = (key: string) => {
    if (key === 'bold' || key === 'italic') return exec(key)
    if (key === 'h3') return exec('formatBlock', state.h3 ? 'P' : 'H3')
    if (key === 'ul') return exec('insertUnorderedList')
    if (key === 'ol') return exec('insertOrderedList')
    if (key === 'clear') {
      exec('removeFormat')
      return exec('formatBlock', 'P')
    }
    if (state.link) return exec('unlink')
    // Remember the selection; focus moves to the address field next.
    const sel = document.getSelection()
    saved.current = sel && sel.rangeCount && box.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
    setLinking({ url: 'https://' })
  }

  const addLink = () => {
    if (!linking) return
    const url = linking.url.trim()
    if (!/^(https?:\/\/[^\s.]+\.[^\s]+|mailto:\S+@\S+|tel:[\d+ ]+)$/i.test(url)) return setLinking({ url, error: 'Enter a full web address, such as https://facebook.com/parish.' })
    box.current?.focus()
    const sel = document.getSelection()
    if (saved.current && sel) {
      sel.removeAllRanges()
      sel.addRange(saved.current)
    }
    // With nothing selected, the address itself becomes the link text.
    if (!saved.current || saved.current.collapsed) {
      const safe = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
      document.execCommand('insertHTML', false, `<a href="${safe}">${safe}</a>&nbsp;`)
    } else {
      document.execCommand('createLink', false, url)
      sel?.collapseToEnd()
    }
    emit()
    setLinking(null)
  }

  // Roving focus inside the toolbar: one Tab stop, arrows move between tools.
  const onToolbarKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    e.preventDefault()
    buttons.forEach((b, n) => (b.tabIndex = n === next ? 0 : -1))
    buttons[next].focus()
  }

  return (
    <div className={`overflow-hidden rounded-lg border bg-white focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/35 ${invalid ? 'border-red-500' : 'border-stone-300'}`}>
      <div role="toolbar" aria-label="Formatting" aria-controls={id} onKeyDown={onToolbarKey} className="flex flex-wrap gap-0.5 border-b border-stone-200 bg-ivory/60 p-1">
        {tools.map((t, n) => (
          <button
            key={t.key}
            type="button"
            tabIndex={n === 0 ? 0 : -1}
            // Keeps the text selection while the button is pressed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.key)}
            aria-label={t.label}
            aria-pressed={t.key === 'clear' ? undefined : t.active}
            aria-keyshortcuts={t.shortcut?.replace('Ctrl', 'Control')}
            title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
            className={`grid size-11 shrink-0 place-items-center rounded-md ${t.active ? 'bg-forest text-white' : 'text-stone-700 hover:bg-stone-200/70'} ${t.key === 'clear' ? 'sm:ml-auto' : ''}`}
          >
            <Icon name={t.icon} className="size-4.5" />
          </button>
        ))}
      </div>

      {linking && (
        <div className="border-b border-stone-200 bg-white px-3 py-2.5">
          <label htmlFor={`${id}-url`} className="mb-1 block text-sm font-medium text-stone-700">
            Link address
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${id}-url`}
              autoFocus
              type="url"
              value={linking.url}
              onChange={(e) => setLinking({ url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLink()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  setLinking(null)
                  box.current?.focus()
                }
              }}
              aria-invalid={linking.error ? true : undefined}
              aria-describedby={linking.error ? `${id}-url-error` : undefined}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button type="button" onClick={addLink} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-forest px-4 font-semibold text-white hover:bg-forest-dark sm:flex-none">
                Add link
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinking(null)
                  box.current?.focus()
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 font-semibold text-stone-700 hover:bg-stone-100 sm:flex-none"
              >
                Cancel
              </button>
            </div>
          </div>
          {linking.error && (
            <p id={`${id}-url-error`} className="mt-1.5 text-sm text-red-700">
              {linking.error}
            </p>
          )}
        </div>
      )}

      <div
        ref={box}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        // Pasted text arrives plain, so Word and web styles never reach a notice.
        onPaste={(e) => {
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
          emit()
        }}
        className="notice-body min-h-56 px-4 py-3 text-[15px] leading-relaxed text-stone-800 focus:outline-none"
      />
    </div>
  )
}
