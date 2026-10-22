// Loads the PayPal JS SDK once, set up for authorize-then-capture (intent=authorize).
// Only the public client ID is used here; every PayPal API call goes through our server.

/** Public (non-secret) client ID of the PayPal REST app. Must match the server's PAYPAL_CLIENT_ID. */
export const PAYPAL_CLIENT_ID = (import.meta.env.VITE_PAYPAL_CLIENT_ID ?? '').trim()

// The parts of the SDK we use. See developer.paypal.com/sdk/js/reference.
export type PayPalButtonsActions = { restart: () => Promise<void> }

export type PayPalButtonsOptions = {
  style?: Record<string, string | number>
  createOrder: () => Promise<string>
  onApprove: (data: { orderID: string }, actions: PayPalButtonsActions) => Promise<void>
  onCancel?: () => void
  onError?: (err: unknown) => void
}

export type PayPalButtons = {
  isEligible: () => boolean
  render: (container: HTMLElement) => Promise<void>
  close: () => Promise<void>
}

export type PayPalNamespace = { Buttons: (options: PayPalButtonsOptions) => PayPalButtons }

declare global {
  interface Window {
    paypal?: PayPalNamespace
  }
}

let loading: Promise<PayPalNamespace> | null = null

export function loadPayPalSdk(currency = 'USD'): Promise<PayPalNamespace> {
  if (loading) return loading
  loading = new Promise<PayPalNamespace>((resolve, reject) => {
    if (!PAYPAL_CLIENT_ID) {
      reject(new Error('VITE_PAYPAL_CLIENT_ID is not set'))
      return
    }
    const params = new URLSearchParams({
      'client-id': PAYPAL_CLIENT_ID,
      intent: 'authorize',
      currency,
      components: 'buttons',
    })
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?${params}`
    script.async = true
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK did not load')))
    script.onerror = () => reject(new Error('PayPal SDK did not load'))
    document.head.appendChild(script)
  }).catch((err) => {
    loading = null // let a later visit try again
    throw err
  })
  return loading
}
