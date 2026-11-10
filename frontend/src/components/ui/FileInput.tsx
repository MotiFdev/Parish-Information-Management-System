import { MAX_UPLOAD_MB } from '../../lib/upload'
import { Icon } from './Icon'

interface Props {
  id: string
  fileName?: string
  invalid?: boolean
  disabled?: boolean
  onChange: (file: File) => void
}

export function FileInput({ id, fileName, invalid, disabled, onChange }: Props) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15 hover:border-forest/50 hover:bg-forest-soft/40 ${
        invalid ? 'border-red-400 bg-red-50/50' : fileName ? 'border-forest/40 bg-forest-soft/40' : 'border-stone-300 bg-stone-50/60'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <Icon name={fileName ? 'paperclip' : 'upload'} className={`size-5 shrink-0 ${fileName ? 'text-forest' : 'text-stone-400'}`} />
      <span className={`min-w-0 flex-1 truncate text-sm ${fileName ? 'font-medium text-stone-800' : 'text-stone-500'}`}>
        {fileName ?? `PDF, JPG or PNG, up to ${MAX_UPLOAD_MB} MB`}
      </span>
      <span className="shrink-0 text-sm font-semibold text-forest">{fileName ? 'Replace' : 'Choose file'}</span>
      <input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
          // Let the same file be chosen again after an error.
          e.target.value = ''
        }}
      />
    </label>
  )
}
