/**
 * Accepts a 10-digit Indian mobile number (or with spaces, dashes, +91, 91, or 0 prefix).
 * Validates that the 10 digits start with 6, 7, 8, or 9.
 * Returns { isValid, phone: "+91XXXXXXXXXX", error }.
 */
export function parseAndFormatIndianPhone(raw: string): {
  isValid: boolean
  phone: string
  error?: string
} {
  if (!raw || !raw.trim()) {
    return { isValid: false, phone: '', error: 'Phone number is required.' }
  }

  // Strip spaces, dashes, dots, parentheses
  let cleaned = raw.trim().replace(/[\s\-().]/g, '')

  // Strip optional +91, 91 (if 12 digits), or 0 prefix
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3)
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1)
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2)
  }

  // Check if exactly 10 digits
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      phone: '',
      error: 'Phone number can only contain digits.',
    }
  }

  if (cleaned.length !== 10) {
    return {
      isValid: false,
      phone: '',
      error: `Phone number must be 10 digits (currently ${cleaned.length} digits).`,
    }
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(cleaned)) {
    return {
      isValid: false,
      phone: '',
      error: 'Indian mobile number must start with 6, 7, 8, or 9.',
    }
  }

  return {
    isValid: true,
    phone: `+91${cleaned}`,
  }
}

/**
 * Formats a currency value in Indian Rupees (e.g. ₹2,500).
 */
export function formatCurrency(amount: number | null | undefined): string {
  const value = typeof amount === 'number' ? amount : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Formats a date string (YYYY-MM-DD) into readable format (e.g. 5 Nov 2026).
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const [year, month, day] = dateStr.split('-')
    if (year && month && day) {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    }
    return dateStr
  } catch {
    return dateStr
  }
}

/**
 * Formats a period string (YYYY-MM-01) into Month Year (e.g. November 2026).
 */
export function formatPeriod(periodStr: string | null | undefined): string {
  if (!periodStr) return '-'
  try {
    const [year, month] = periodStr.split('-')
    if (year && month) {
      const date = new Date(parseInt(year), parseInt(month) - 1, 1)
      return date.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      })
    }
    return periodStr
  } catch {
    return periodStr
  }
}

/**
 * Returns today's date string (YYYY-MM-DD) in Asia/Kolkata (IST) timezone,
 * avoiding UTC midnight rollback issues.
 */
export function getTodayIST(): string {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffsetMs)
  return istDate.toISOString().split('T')[0]
}

/**
 * Returns current Year-Month string (YYYY-MM) in Asia/Kolkata (IST) timezone.
 */
export function getCurrentMonthIST(): string {
  return getTodayIST().slice(0, 7)
}

/**
 * Safely formats a calendar year, 1-based month, and day into YYYY-MM-DD
 * without converting through UTC (`toISOString()`), preventing -1 day shifts in IST.
 */
export function formatYYYYMMDD(year: number, month1Based: number, day: number): string {
  const y = String(year).padStart(4, '0')
  const m = String(month1Based).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Adds or subtracts calendar days from a YYYY-MM-DD string safely without UTC timezone shift.
 */
export function addDaysYYYYMMDD(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return dt.toISOString().split('T')[0]
}
