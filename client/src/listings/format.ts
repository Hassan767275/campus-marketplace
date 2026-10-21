import type { ListingCategory } from '@campus/shared'

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  TEXTBOOKS: 'Textbooks',
  ELECTRONICS: 'Electronics',
  FURNITURE: 'Furniture',
  CLOTHING: 'Clothing',
  KITCHEN: 'Kitchen',
  SPORTS: 'Sports',
  TICKETS: 'Tickets',
  OTHER: 'Other',
}

export function formatPrice(cents: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

/**
 * Parses a dollar amount typed by a person ("12", "12.5", "$1,200.00") into
 * integer cents without going through floating point. Returns null if invalid.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '')
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** Cents as a plain dollar string for form fields, e.g. 1250 → "12.50", 1200 → "12". */
export function centsToDollarInput(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}
