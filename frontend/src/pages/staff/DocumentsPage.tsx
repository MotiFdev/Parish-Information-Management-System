import { useState } from 'react'
import { DocumentViewer, type ViewableFile } from '../../components/DocumentViewer'
import { useToast } from '../../components/toast/toastContext'
import { ErrorState, LoadingState } from '../../components/ui/DataState'
import { Icon } from '../../components/ui/Icon'
import { Pagination } from '../../components/ui/Pagination'
import { inputClass } from '../../components/ui/styles'
import { LinkDialog, UploadDialog } from '../../features/staff/documents/DocDialogs'
import { relinkDocument, uploadDocument, useDocuments } from '../../features/staff/documents/documentsApi'
import { folderLabels, formatSize, type DocFile, type FileType, type Folder, type LinkTargets } from '../../features/staff/documents/documentsData'
import { DropZone } from '../../features/staff/documents/DropZone'
import { StaffLayout } from '../../layouts/StaffLayout'
import { api } from '../../lib/api'

const PATH = '/secretary/documents'
const PAGE_SIZE = 12
const folders: Folder[] = ['all', 'none', 'register', 'request', 'parishioner']
const dateFormat = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila',
})
const cellLabel = 'block text-xs text-stone-500 lg:hidden'
const viewLabel = (f: DocFile) => (f.link.kind === 'register' ? 'Register scan' : f.link.kind === 'none' ? 'Unfiled scan' : (f.link.label ?? 'Document'))
const noTargets: LinkTargets = { entries: [], requests: [], parishioners: [] }

export default function DocumentsPage() {
  const { toast } = useToast()
  const { state, reload, put } = useDocuments()
  const [folder, setFolder] = useState<Folder>('all')
  const [search, setSearch] = useState('')
  const [fileType, setFileType] = useState<FileType | ''>('')
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<ViewableFile | null>(null)
  const [linking, setLinking] = useState<DocFile | null>(null)
  const [uploading, setUploading] = useState<File[] | null>(null)

  const ready = typeof state === 'object'
  const all = ready ? state.files : []
  const targets = ready ? state.targets : noTargets
  const count = (f: Folder) => (f === 'all' ? all.length : all.filter((x) => x.link.kind === f).length)
  const q = search.trim().toLowerCase()
  const filtered = all
    .filter((f) => (folder === 'all' || f.link.kind === folder) && (!fileType || f.fileType === fileType))
    .filter((f) => {
      if (!q) return true
      return [f.name, f.link.title, f.link.detail ?? '', f.uploadedBy].some((v) => v.toLowerCase().includes(q))
    })
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const pick = (f: Folder) => {
    setFolder(f)
    setPage(0)
  }

  const view = async (f: DocFile) => {
    const base = { label: viewLabel(f), file: f.name }
    setViewing({ ...base, loading: true })
    try {
      const { url } = await api<{ url: string }>(`/api/documents/${f.id}/link`)
      setViewing((v) => (v?.file === f.name ? { ...base, url } : v))
    } catch {
      setViewing((v) => (v?.file === f.name ? { ...base, error: 'The file could not be opened. Close this and try again.' } : v))
    }
  }

  return (
    <StaffLayout activeHref={PATH}>
      <h1 className="font-serif text-4xl font-semibold text-stone-900">Documents</h1>
      <p className="mt-1 max-w-2xl text-stone-600">
        Scanned register pages and the files parishioners upload. Link each file to the record it belongs to so it shows up there.
      </p>

      <div className="mt-6">
        <DropZone onFiles={setUploading} disabled={!ready} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Folders: a list on wide screens, a dropdown on phones. */}
        <nav aria-label="Folders" className="hidden lg:block">
          <ul className="space-y-1">
            {folders.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  aria-current={folder === f ? 'true' : undefined}
                  onClick={() => pick(f)}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-semibold ${
                    folder === f ? 'bg-forest text-white' : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  {folderLabels[f]}
                  {ready && (
                    <span className={`tabular-nums ${folder === f ? 'text-white/85' : f === 'none' && count(f) ? 'text-brown' : 'text-stone-500'}`}>
                      {count(f)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] lg:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_10rem] lg:col-span-1 lg:grid-cols-1">
              <select aria-label="Folder" value={folder} onChange={(e) => pick(e.target.value as Folder)} className={`${inputClass} lg:hidden`}>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {folderLabels[f]}
                    {ready ? ` (${count(f)})` : ''}
                  </option>
                ))}
              </select>
              <div className="relative">
                <label htmlFor="doc-search" className="sr-only">
                  Search files
                </label>
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-stone-500" />
                <input
                  id="doc-search"
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  placeholder="File name, person, or request number"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
            <select
              aria-label="File type"
              value={fileType}
              onChange={(e) => {
                setFileType(e.target.value as FileType | '')
                setPage(0)
              }}
              className={`${inputClass} max-lg:hidden`}
            >
              <option value="">All types</option>
              <option value="PDF">PDF</option>
              <option value="JPG">JPG</option>
              <option value="PNG">PNG</option>
            </select>
          </div>

          <section aria-label="Files" className="mt-3 rounded-2xl border border-stone-200 bg-white">
            {!ready ? (
              state === 'loading' ? (
                <LoadingState what="documents" variant="table" />
              ) : (
                <ErrorState what="documents" help="If it keeps happening, tell the system administrator." onRetry={reload} />
              )
            ) : filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-semibold text-stone-800">
                  {all.length === 0 ? 'No documents yet' : folder === 'none' && !q ? 'Every file is linked' : 'No files match'}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {all.length === 0
                    ? 'Upload scanned register pages above; files parishioners attach to requests appear here too.'
                    : 'Try another folder or a shorter search.'}
                </p>
              </div>
            ) : (
              <>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-stone-200 text-stone-600 max-lg:sr-only">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">
                        File
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Linked to
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Uploaded
                      </th>
                      <th scope="col" className="px-5 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((f) => {
                      const d = f.link
                      return (
                        <tr key={f.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-2.5 max-lg:px-5 max-lg:py-4">
                          <td className="lg:px-5 lg:py-3 max-lg:col-span-2">
                            <span className="flex items-start gap-3">
                              <Icon name="file" className="mt-0.5 size-5 shrink-0 text-stone-500" />
                              <span className="min-w-0">
                                <span className="block font-semibold break-all text-stone-900">{f.name}</span>
                                <span className="block text-xs text-stone-600">
                                  {f.fileType} · {formatSize(f.sizeKb)}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="lg:px-3 lg:py-3">
                            <span className={cellLabel}>Linked to</span>
                            <span className={`block ${f.link.kind === 'none' ? 'font-semibold text-brown' : 'text-stone-900'}`}>{d.title}</span>
                            {d.detail && <span className="block text-xs text-stone-600">{d.detail}</span>}
                          </td>
                          <td className="lg:px-3 lg:py-3">
                            <span className={cellLabel}>Uploaded</span>
                            <span className="block text-stone-800">{dateFormat.format(new Date(f.uploadedAt))}</span>
                            <span className="block text-xs text-stone-600">by {f.uploadedBy}</span>
                          </td>
                          <td className="lg:px-5 lg:py-2 max-lg:col-span-2">
                            <div className="flex gap-2 lg:justify-end">
                              <button
                                type="button"
                                onClick={() => void view(f)}
                                aria-label={`View ${f.name}`}
                                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 font-semibold text-stone-700 hover:border-forest/50 hover:text-forest lg:flex-none"
                              >
                                <Icon name="eye" className="size-4" />
                                View
                              </button>
                              {f.movable ? (
                                <button
                                  type="button"
                                  onClick={() => setLinking(f)}
                                  aria-label={`${f.link.kind === 'none' ? 'Link' : 'Change link for'} ${f.name}`}
                                  className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 font-semibold lg:flex-none ${
                                    f.link.kind === 'none' ? 'bg-forest text-white hover:bg-forest-dark' : 'text-forest hover:bg-forest-soft'
                                  }`}
                                >
                                  {f.link.kind === 'none' ? 'Link' : 'Change link'}
                                </button>
                              ) : (
                                <span className="inline-flex min-h-11 flex-1 items-center justify-center px-3 text-xs text-stone-600 lg:flex-none lg:max-w-32 lg:text-right">
                                  Stays with its request
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun={['file', 'files']} />
              </>
            )}
          </section>
        </div>
      </div>

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      <LinkDialog
        file={linking}
        targets={targets}
        onClose={() => setLinking(null)}
        onSave={async (choice) => {
          if (!linking) return
          const saved = await relinkDocument(linking.id, choice)
          if (typeof saved === 'string') return saved
          put([saved])
          toast(saved.link.kind === 'none' ? `${saved.name} is no longer linked.` : `${saved.name} linked to ${saved.link.title}.`)
          setLinking(null)
        }}
      />
      <UploadDialog
        files={uploading}
        targets={targets}
        upload={uploadDocument}
        onClose={() => setUploading(null)}
        onDone={(saved, failed) => {
          if (saved.length) {
            put(saved)
            setFolder('all')
            setSearch('')
            setPage(0)
          }
          if (failed) {
            toast(
              `${saved.length ? `Uploaded ${saved.length}. ` : ''}${failed} ${failed === 1 ? 'file was' : 'files were'} not uploaded; see the reason under each one.`,
            )
            return
          }
          setUploading(null)
          toast(`Uploaded ${saved.length} ${saved.length === 1 ? 'file' : 'files'}.`)
        }}
      />
    </StaffLayout>
  )
}
