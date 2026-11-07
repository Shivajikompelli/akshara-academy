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
