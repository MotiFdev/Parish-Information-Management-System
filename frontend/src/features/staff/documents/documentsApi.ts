import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api'
import type { DocFile, DocLink, FileType, LinkChoice, LinkTargets } from './documentsData'

// The staff Documents page (backend Staff\DocumentController).

interface ApiDocument {
  id: string
  name: string
  file_type: FileType
  size_kb: number
  uploaded_by: string
  uploaded_at: string
  link: { kind: DocLink['kind']; target_id: string | null; label: string | null; type?: DocLink['type']; title: string; detail: string | null }
  movable: boolean
}

export interface DocumentsState {
  files: DocFile[]
  targets: LinkTargets
}

const toFile = (d: ApiDocument): DocFile => ({
  id: d.id,
  name: d.name,
  fileType: d.file_type,
  sizeKb: d.size_kb,
  uploadedBy: d.uploaded_by,
  uploadedAt: d.uploaded_at,
  link: { kind: d.link.kind, targetId: d.link.target_id, label: d.link.label, type: d.link.type, title: d.link.title, detail: d.link.detail },
  movable: d.movable,
})

/** Every file, newest first; `put` adds or replaces one without reloading. */
export function useDocuments() {
  const [attempt, setAttempt] = useState(0)
  // Tagged with the request it answers, so a retry shows loading without resetting state in the effect.
  const [result, setResult] = useState<{ attempt: number; value: DocumentsState | 'error' } | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ data: ApiDocument[]; targets: LinkTargets }>('/api/secretary/documents')
      .then((r) => !cancelled && setResult({ attempt, value: { files: r.data.map(toFile), targets: r.targets } }))
      .catch(() => !cancelled && setResult({ attempt, value: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const state: DocumentsState | 'loading' | 'error' = result?.attempt === attempt ? result.value : 'loading'
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const put = useCallback((files: DocFile[]) => {
    setResult((r) => {
      if (!r || r.value === 'error') return r
      const ids = new Set(files.map((f) => f.id))
      const rest = r.value.files.filter((f) => !ids.has(f.id))
      const all = [...files, ...rest].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      return { ...r, value: { ...r.value, files: all } }
    })
  }, [])

  return { state, reload, put }
}

const linkBody = (c: LinkChoice) => ({
  link: c.kind,
  target_id: c.kind === 'none' ? null : c.targetId,
  label: c.kind === 'request' || c.kind === 'parishioner' ? c.label : null,
})

const problem = (e: unknown, fallback: string) =>
  e instanceof ApiError && (e.status === 422 || e.status === 409) ? (e.field('file') ?? e.field('target_id') ?? e.field('label') ?? e.message) : fallback

/** Uploads one file with its link; resolves with the saved file, or the reason it was refused. */
export async function uploadDocument(file: File, c: LinkChoice): Promise<DocFile | string> {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(linkBody(c))) if (v) form.append(k, v)
  try {
    return toFile((await api<{ data: ApiDocument }>('/api/secretary/documents', { method: 'POST', body: form })).data)
  } catch (e) {
    return problem(e, 'This file could not be uploaded. Try again.')
  }
}

/** Files a document somewhere else; resolves with the saved file, or the reason it was refused. */
export async function relinkDocument(id: string, c: LinkChoice): Promise<DocFile | string> {
  try {
    return toFile((await api<{ data: ApiDocument }>(`/api/secretary/documents/${id}/link`, { method: 'PATCH', body: linkBody(c) })).data)
  } catch (e) {
    return problem(e, 'The link could not be saved. Try again.')
  }
}
