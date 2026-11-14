/**
 * Client-side script loader for Razorpay Checkout
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }

    // Already loaded
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      resolve(true)
    }
    script.onerror = () => {
      console.error('Failed to load Razorpay checkout script.')
      resolve(false)
    }
    document.body.appendChild(script)
  })
}

export interface RazorpayOrderResponse {
  orderId: string
  amount: number
  currency: string
  keyId: string
  isMock?: boolean
  message?: string
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}
