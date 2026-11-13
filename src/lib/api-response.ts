import { NextResponse, type NextRequest } from 'next/server'
import {
  AppError,
  ErrorCode,
  generateRequestId,
  maskSensitive,
  type ApiErrorEnvelope,
  type ErrorCodeType,
} from './errors'

/**
 * Standard Success Response envelope with correlation headers.
 */
export function apiSuccess<T>(data: T, status = 200, headersInit?: HeadersInit) {
  const res = NextResponse.json(data, { status, headers: headersInit })
  return res
}

/**
 * Maps arbitrary caught errors (Postgres errors, Auth errors, Network errors, raw exceptions)
 * into a safe, normalized ApiErrorEnvelope without leaking internals.
 */
export function apiError(
  err: unknown,
  req?: NextRequest,
  customRequestId?: string
): NextResponse<ApiErrorEnvelope> {
  const requestId =
    customRequestId ||
    req?.headers.get('x-request-id') ||
    generateRequestId()

  let statusCode = 500
  let code: ErrorCodeType | string = ErrorCode.INTERNAL_SERVER_ERROR
  let message = 'An unexpected server error occurred. Please try again.'
  let details = undefined
  let retryable = false
  let retryAfterSeconds = undefined

  if (err instanceof AppError) {
    statusCode = err.statusCode
    code = err.code
    message = err.message
    details = err.details
    retryable = err.retryable
    retryAfterSeconds = err.retryAfterSeconds
  } else if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    const pgCode = String(errorObj.code || '')
    const rawMsg = String(errorObj.message || '')

    // Map common PostgreSQL / Supabase constraint error codes
    if (pgCode === '23505' || rawMsg.includes('duplicate key') || rawMsg.includes('unique')) {
      statusCode = 409
      retryable = false
      if (rawMsg.includes('students_admission_no_key') || rawMsg.includes('admission_no')) {
        code = ErrorCode.DUPLICATE_ADMISSION_NO
        message = 'This admission number is already assigned to another student.'
      } else if (rawMsg.includes('message_log_dedupe') || rawMsg.includes('message_log_payment_dedupe')) {
        code = ErrorCode.DUPLICATE_RECORD
        message = 'A message or receipt for this record has already been logged today.'
      } else {
        code = ErrorCode.DUPLICATE_RECORD
        message = 'A conflicting record already exists in the system.'
      }
    } else if (pgCode === '23503' || rawMsg.includes('foreign key')) {
      statusCode = 404
      code = ErrorCode.NOT_FOUND
      message = 'Referenced student or fee record could not be found.'
    } else if (rawMsg.includes('Amount due cannot be edited after payments')) {
      statusCode = 409
      code = ErrorCode.FEE_AMOUNT_LOCKED
      message = 'Amount due cannot be edited after payments have been recorded.'
    } else if (rawMsg.includes('AbortError') || rawMsg.includes('timeout')) {
      statusCode = 504
      code = ErrorCode.NETWORK_TIMEOUT
      message = 'The external service timed out. Please try again.'
      retryable = true
    }
  }

  // Safe structured server log (masked, contains requestId)
  const logDetails = {
    requestId,
    code,
    statusCode,
    path: req?.nextUrl.pathname || 'unknown',
    method: req?.method || 'unknown',
    message: maskSensitive(err instanceof Error ? err.message : String(err)),
  }
  if (statusCode >= 500) {
    console.error('[API_ERROR_5XX]', logDetails)
  } else {
    console.warn('[API_ERROR_4XX]', logDetails)
  }

  const envelope: ApiErrorEnvelope = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId,
      retryable,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
  }

  const headers: Record<string, string> = {
    'x-request-id': requestId,
  }
  if (retryAfterSeconds) {
    headers['Retry-After'] = String(retryAfterSeconds)
  }

  return NextResponse.json(envelope, { status: statusCode, headers })
}

