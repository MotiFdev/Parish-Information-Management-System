// Talks to the Laravel API with Sanctum's cookie session: the browser keeps
// the session cookie, and every write sends the XSRF-TOKEN cookie back as a
// header. The frontend and API must share a host name (both "localhost", not
// one "localhost" and one "127.0.0.1") or the cookies will not be sent.

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  /** Laravel validation errors, keyed by field. */
  readonly errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }

  /** First message for a field, or the general message. */
  field(name: string) {
    return this.errors[name]?.[0]
  }
}

function readCookie(name: string) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

let csrfReady: Promise<void> | null = null

/** Sets the XSRF-TOKEN cookie. Called once before the first write, and again after sign-out. */
export function ensureCsrfCookie(force = false) {
  if (force || !csrfReady || !readCookie('XSRF-TOKEN')) {
    csrfReady = fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: 'include' }).then((res) => {
      if (!res.ok) throw new ApiError(res.status, 'Could not start a secure session with the server.')
    })
    csrfReady.catch(() => (csrfReady = null))
  }
  return csrfReady
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T = unknown>(path: string, { method = 'GET', body }: { method?: Method; body?: unknown } = {}): Promise<T> {
  const write = method !== 'GET'
  if (write) await ensureCsrfCookie()

  const send = () => {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    // FormData (file uploads) sets its own multipart Content-Type with the boundary.
    const form = body instanceof FormData
    if (body !== undefined && !form) headers['Content-Type'] = 'application/json'
    const xsrf = readCookie('XSRF-TOKEN')
    if (write && xsrf) headers['X-XSRF-TOKEN'] = xsrf
    return fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
    })
  }

  let res: Response
  try {
    res = await send()
    // 419: the CSRF token expired (e.g. the session timed out). Refresh it once and retry.
    if (res.status === 419 && write) {
      await ensureCsrfCookie(true)
      res = await send()
    }
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }

  return parse<T>(res)
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.message || `Request failed (${res.status}).`, data.errors)
  return data as T
}

/**
 * Downloads a file the API builds (e.g. an export) and saves it under the
 * server's filename. Errors come back as ApiError like any other call.
 */
export async function apiDownload(path: string, fallbackName: string) {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { Accept: 'application/json, */*', 'X-Requested-With': 'XMLHttpRequest' } })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }
  if (!res.ok) return parse<never>(res)

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1]
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name ? decodeURIComponent(name) : fallbackName
  a.click()
  // Some browsers start the save after click() returns; give them a moment before freeing the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
