import { expireSession, getToken } from '../auth/session'
import { apiConfig } from './config'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const NETWORK_ERROR = 'Cannot reach the server. Check your connection and try again.'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const { detail, message } = data as { detail?: unknown; message?: unknown }
    if (typeof detail === 'string') return detail
    if (typeof message === 'string') return message
  }
  return fallback
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${apiConfig.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR)
  }

  if (!response.ok) {
    if (response.status === 401 && headers.Authorization) expireSession()
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new ApiError(response.status, errorMessage(data, response.statusText || 'Request failed'))
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function apiUpload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiConfig.baseUrl}${path}`)
    xhr.setRequestHeader('Accept', 'application/json')
    for (const [key, value] of Object.entries(authHeaders())) xhr.setRequestHeader(key, value)
    xhr.responseType = 'json'

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onerror = () => reject(new ApiError(0, NETWORK_ERROR))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as T)
      else {
        if (xhr.status === 401) expireSession()
        reject(new ApiError(xhr.status, errorMessage(xhr.response, xhr.statusText || 'Upload failed')))
      }
    }
    xhr.send(form)
  })
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
