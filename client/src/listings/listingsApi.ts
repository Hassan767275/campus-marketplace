import type { ListingCategory, ListingStatus } from '@campus/shared'
import { api } from '../api/client'

// Mirrors the server's public listing shape (server/src/routes/listings.ts).
export type Listing = {
  id: string
  title: string
  description: string
  category: ListingCategory
  priceCents: number
  currency: string
  photoUrls: string[] | null
  status: ListingStatus
  createdAt: string
  updatedAt: string
  seller: { id: string; displayName: string }
}

export type ListingFilters = {
  categories?: ListingCategory[]
  minPriceCents?: number
  maxPriceCents?: number
}

export type ListingInput = {
  title: string
  description: string
  category: ListingCategory
  priceCents: number
}

export function fetchListings(filters: ListingFilters, cursor?: string | null, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filters.categories?.length) params.set('category', filters.categories.join(','))
  if (filters.minPriceCents !== undefined) params.set('minPriceCents', String(filters.minPriceCents))
  if (filters.maxPriceCents !== undefined) params.set('maxPriceCents', String(filters.maxPriceCents))
  if (cursor) params.set('cursor', cursor)
  const query = params.toString()
  return api<{ listings: Listing[]; nextCursor: string | null }>(`/api/listings${query ? `?${query}` : ''}`, { signal })
}

export function fetchListing(id: string, signal?: AbortSignal) {
  return api<{ listing: Listing }>(`/api/listings/${encodeURIComponent(id)}`, { signal })
}

export function createListing(input: ListingInput) {
  return api<{ listing: Listing }>('/api/listings', { method: 'POST', body: input })
}

/** One photo per request; the server appends it to the listing. */
export function uploadListingPhoto(id: string, photo: File) {
  return api<{ listing: Listing }>(`/api/listings/${encodeURIComponent(id)}/photos`, { method: 'POST', body: photo })
}
