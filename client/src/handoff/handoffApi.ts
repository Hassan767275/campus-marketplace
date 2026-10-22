import { api } from '../api/client'
import type { CheckoutOrder } from '../checkout/checkoutApi'

// Mirrors the server's QR handoff endpoints (server/src/orders/handoff.ts).

/** Seller: a fresh single-use handoff token for this order, valid for a few minutes. */
export function fetchHandoffToken(orderId: string) {
  return api<{ token: string; expiresAt: string }>(`/api/orders/${encodeURIComponent(orderId)}/handoff-token`, {
    method: 'POST',
  })
}

/** Buyer: redeem the token from the seller's QR code. The server captures the payment. */
export function scanHandoffToken(token: string) {
  return api<{ order: CheckoutOrder }>('/api/orders/handoff/scan', { method: 'POST', body: { token } })
}
