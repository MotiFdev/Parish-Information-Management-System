import { useRef, useState, type DragEvent } from 'react'
import { Icon } from '../../../components/ui/Icon'
import { ACCEPT, MAX_KB, formatSize } from './documentsData'

// The drag-and-drop uploader from section 4.3. Dropping is a shortcut; the
// "Choose files" button is a real file input, so keyboards and phones work too.
export function DropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    const files = [...e.dataTransfer.files]
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors sm:flex-row sm:text-left ${
        over ? 'border-forest bg-forest-soft' : 'border-stone-300 bg-white'
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-soft text-forest" aria-hidden="true">
        <Icon name="upload" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-stone-900">{over ? 'Drop to upload' : 'Drag scans or files here'}</p>
        <p className="text-sm text-stone-600">PDF, JPG, or PNG, up to {formatSize(MAX_KB)} each. You choose what each file is linked to next.</p>
      </div>
      <input
        ref={input}
        id="doc-upload-input"
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-forest/25 bg-white px-5 font-semibold text-forest hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        Choose files
      </button>
    </div>
  )
}
