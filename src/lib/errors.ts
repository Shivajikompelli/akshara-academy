/**
 * Central Error Taxonomy and Typed Error Hierarchy for Akshara Academy.
 * Ensures consistent codes, safe sanitized messages, and support tracing.
 */

export const ErrorCode = {
  // Authentication & Authorization (401 / 403)
  AUTH_UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',

  // Validation & Input (400 / 422)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  FUTURE_DATE_NOT_ALLOWED: 'FUTURE_DATE_NOT_ALLOWED',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource & State Conflicts (404 / 409)
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  DUPLICATE_ADMISSION_NO: 'DUPLICATE_ADMISSION_NO',
  FEE_AMOUNT_LOCKED: 'FEE_AMOUNT_LOCKED',
  ATTENDANCE_ALREADY_RECORDED: 'ATTENDANCE_ALREADY_RECORDED',
  CONSENT_MISSING: 'CONSENT_MISSING',

  // Network & Third-Party Provider (502 / 503 / 504 / Client)
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  WHATSAPP_API_UNAVAILABLE: 'WHATSAPP_API_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server & Unknown (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ErrorDetail {
  field?: string
  issue: string
}

export interface ApiErrorEnvelope {
  error: {
    code: ErrorCodeType | string
    message: string
    details?: ErrorDetail[]
    requestId: string
    retryable: boolean
    retryAfterSeconds?: number
  }
}

/**
 * Base Application Error class with typed metadata.
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType | string
  public readonly statusCode: number
  public readonly details?: ErrorDetail[]
  public readonly retryable: boolean
  public readonly retryAfterSeconds?: number
  public readonly isOperational: boolean

  constructor(params: {
    message: string
    code?: ErrorCodeType | string
    statusCode?: number
    details?: ErrorDetail[]
    retryable?: boolean
    retryAfterSeconds?: number
    cause?: unknown
  }) {
    super(params.message, { cause: params.cause })
    this.name = 'AppError'
    this.code = params.code || ErrorCode.INTERNAL_SERVER_ERROR
    this.statusCode = params.statusCode || 500
    this.details = params.details
    this.retryable = params.retryable ?? (this.statusCode >= 500 || this.statusCode === 429)
    this.retryAfterSeconds = params.retryAfterSeconds
    this.isOperational = true

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required to access this resource.', code: ErrorCodeType = ErrorCode.AUTH_UNAUTHENTICATED) {
    super({
      message,
      code,
      statusCode: code === ErrorCode.AUTH_FORBIDDEN || code === ErrorCode.AUTH_ACCOUNT_DISABLED ? 403 : 401,
      retryable: false,
    })
    this.name = 'AuthError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[], code: ErrorCodeType = ErrorCode.VALIDATION_FAILED) {
    super({
      message,
      code,
      statusCode: 400,
      details,
      retryable: false,
    })
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resourceName = 'Record', code: ErrorCodeType = ErrorCode.NOT_FOUND) {
    super({
      message: `${resourceName} not found.`,
      code,
      statusCode: 404,
      retryable: false,
    })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCodeType = ErrorCode.DUPLICATE_RECORD) {
    super({
      message,
      code,
      statusCode: 409,
      retryable: false,
    })
    this.name = 'ConflictError'
  }
}

export class ProviderError extends AppError {
  constructor(providerName: string, message?: string, retryable = true) {
    super({
      message: message || `${providerName} service is temporarily unavailable.`,
      code: ErrorCode.WHATSAPP_API_UNAVAILABLE,
      statusCode: 502,
      retryable,
    })
    this.name = 'ProviderError'
  }
}

export class NetworkTimeoutError extends AppError {
  constructor(message = 'The operation timed out. Please try again.') {
    super({
      message,
      code: ErrorCode.NETWORK_TIMEOUT,
      statusCode: 504,
      retryable: true,
    })
    this.name = 'NetworkTimeoutError'
  }
}

/**
 * Generate a friendly alphanumeric request correlation ID for support tracing.
 * Example: `req_a8f9c1`
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36).slice(-4)
  const randomPart = Math.random().toString(36).slice(2, 6)
  return `req_${timestamp}${randomPart}`
}

/**
 * Masks PII like phone numbers and email addresses in debug logs.
 */
export function maskSensitive(text: string): string {
  if (!text) return ''
  // Mask Indian phone (+919876543210 -> +91******3210)
  let result = text.replace(/(\+?91)?(\d{2})\d{4,6}(\d{4})/g, '$1$2******$3')
  // Mask email (user@example.com -> u***@example.com)
  result = result.replace(/([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, '$1***@$2')
  return result
}

