import { useLocation } from './router'

// Design phase only: `?preview=loading|empty|error` renders the data views in
// that state so each one can be reviewed before the API exists.
export type PreviewState = 'ready' | 'loading' | 'empty' | 'error'

export const previewStates: PreviewState[] = ['ready', 'loading', 'empty', 'error']

export function usePreviewState(): PreviewState {
  const { query } = useLocation()
  const state = query.get('preview')
  return previewStates.includes(state as PreviewState) ? (state as PreviewState) : 'ready'
}

export function withPreview(state: PreviewState) {
  const url = new URL(window.location.href)
  if (state === 'ready') url.searchParams.delete('preview')
  else url.searchParams.set('preview', state)
  return url.pathname + url.search
}
