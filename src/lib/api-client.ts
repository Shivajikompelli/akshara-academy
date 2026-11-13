import { AppError, ErrorCode, type ApiErrorEnvelope } from './errors'

export type Result<T, E = AppError> =
  | { success: true; data: T; error?: never }
  | { success: false; error: E; data?: never }

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}

/**
 * Resilient HTTP client for Akshara Academy client-side screens & hooks.
 * Features:
 * - Offline pre-flight detection (`navigator.onLine`)
 * - Request timeouts via `AbortController`
 * - Automatic exponential backoff with jitter on idempotent / retryable requests
 * - Uniform error normalization into typed `AppError`
 * - Automatic 401 session expiration dispatch
 */
export async function apiClient<T>(
  url: string,
  options: RequestOptions = {}
): Promise<Result<T>> {
  const {
    timeoutMs = 12000,
    retries = options.method === 'GET' || !options.method ? 2 : 0,
    retryDelayMs = 400,
    ...fetchOptions
  } = options

  // 1. Offline pre-flight check
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      error: new AppError({
        message: 'You are currently offline. Please check your internet connection.',
        code: ErrorCode.NETWORK_OFFLINE,
        statusCode: 0,
        retryable: true,
      }),
    }
  }

  let attempt = 0
  let currentDelay = retryDelayMs

  while (attempt <= retries) {
    attempt++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      })

      clearTimeout(timer)

      // Handle 204 No Content
      if (res.status === 204) {
        return { success: true, data: undefined as unknown as T }
      }

      // Check Content-Type for CSV / Blob downloads vs JSON
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('text/csv') || contentType.includes('image/')) {
        if (!res.ok) {
          throw new AppError({
            message: 'File generation failed on the server.',
            statusCode: res.status,
          })
        }
        const blobData = await res.blob()
        return { success: true, data: blobData as unknown as T }
      }

      const json = await res.json().catch(() => null)

      if (res.ok) {
        return { success: true, data: json as T }
      }

      // Normalized error parsing
      const errEnvelope = json as ApiErrorEnvelope | null
      const errCode = errEnvelope?.error?.code || (res.status === 401 ? ErrorCode.AUTH_UNAUTHENTICATED : ErrorCode.UNKNOWN_ERROR)
      const errMsg = errEnvelope?.error?.message || (json?.error && typeof json.error === 'string' ? json.error : `Request failed with status ${res.status}`)
      const isRetryable = errEnvelope?.error?.retryable ?? (res.status >= 500 || res.status === 429)

      // 401 Session expired handling: trigger custom global event so navbar / app can redirect gracefully
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('akshara:auth-expired'))
      }

      // Decide if retry should happen for retryable status codes
      if (isRetryable && attempt <= retries) {
        const jitter = Math.random() * 200
        await new Promise((resolve) => setTimeout(resolve, currentDelay + jitter))
        currentDelay *= 1.5
        continue
      }

      return {
        success: false,
        error: new AppError({
          message: errMsg,
          code: errCode,
          statusCode: res.status,
          details: errEnvelope?.error?.details,
          retryable: isRetryable,
          retryAfterSeconds: errEnvelope?.error?.retryAfterSeconds,
        }),
      }
    } catch (fetchErr: unknown) {
      clearTimeout(timer)

      const isAbort = (fetchErr as Error)?.name === 'AbortError'
      const isTimeout = isAbort

      if (attempt <= retries) {
        const jitter = Math.random() * 200
        await new Promise((resolve) => setTimeout(resolve, currentDelay + jitter))
        currentDelay *= 1.5
        continue
      }

      return {
        success: false,
        error: new AppError({
          message: isTimeout
            ? 'The connection timed out. Please try again.'
            : 'Unable to reach the server. Please verify your connection.',
          code: isTimeout ? ErrorCode.NETWORK_TIMEOUT : ErrorCode.NETWORK_OFFLINE,
          statusCode: isTimeout ? 504 : 0,
          retryable: true,
          cause: fetchErr,
        }),
      }
    }
  }

  return {
    success: false,
    error: new AppError({
      message: 'Request could not be completed after several attempts.',
      code: ErrorCode.UNKNOWN_ERROR,
      statusCode: 500,
      retryable: true,
    }),
  }
}

