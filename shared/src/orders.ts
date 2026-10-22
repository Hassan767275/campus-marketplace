// Order money and timing rules shared by the API and the client.
// See CLAUDE.md "Payment model" and "PayPal limits".

/** Buyer and seller must meet within this long after authorizing, or the order is voided. Equals PayPal's 3-day honor period. */
export const HANDOFF_WINDOW_HOURS = 72;
export const HANDOFF_WINDOW_MS = HANDOFF_WINDOW_HOURS * 60 * 60 * 1000;

/** PayPal authorizations expire 29 days after they're made. */
export const AUTHORIZATION_VALID_DAYS = 29;

/** Platform fee in basis points (1000 = 10%), kept back from the seller's payout. */
export const PLATFORM_FEE_BPS = 1000;

/** Platform fee for a sale, in integer cents, rounded down so the seller never gets less than their share. */
export function platformFeeCents(amountCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RangeError(`amountCents must be a positive integer, got ${amountCents}`);
  }
  return Math.floor((amountCents * PLATFORM_FEE_BPS) / 10_000);
}
