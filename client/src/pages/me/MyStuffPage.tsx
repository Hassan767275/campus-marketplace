import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { ListingStatus } from '@campus/shared'
import { ApiError } from '../../api/client'
import { Alert, ButtonLink, Card } from '../../components'
import { Page } from '../../layout/Page'
import { CATEGORY_LABELS, formatPrice } from '../../listings/format'
import { fetchMyListings, type Listing } from '../../listings/listingsApi'
import './me.css'

const STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: 'For sale',
  RESERVED: 'Reserved',
  SOLD: 'Sold',
  REMOVED: 'Removed',
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; listings: Listing[] }

export function MyStuffPage() {
  return (
    <Page title="My stuff" actions={<ButtonLink to="/sell">Post a listing</ButtonLink>}>
      <MyListings />
      <Card title="My orders">
        {/* Filled in once checkout exists (Phase 2). */}
        <p className="text-muted">No orders yet. Things you buy or sell will show up here.</p>
      </Card>
    </Page>
  )
}

function MyListings() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchMyListings(controller.signal)
      .then(({ listings }) => setState({ status: 'ready', listings }))
      .catch((err) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load your listings.' })
      })
    return () => controller.abort()
  }, [])

  return (
    <Card title="My listings">
      {state.status === 'loading' && <p className="text-muted">Loading your listings…</p>}
      {state.status === 'error' && <Alert tone="error">{state.message}</Alert>}
      {state.status === 'ready' && state.listings.length === 0 && (
        <p className="text-muted">
          You haven't posted anything yet. <Link to="/sell">Post your first listing</Link>.
        </p>
      )}
      {state.status === 'ready' && state.listings.length > 0 && (
        <ul className="my-listings">
          {state.listings.map((listing) => {
            const photo = listing.photoUrls?.[0]
            return (
              <li key={listing.id}>
                <Link to={`/listings/${listing.id}`} className="my-listing">
                  <span className="my-listing__photo">{photo && <img src={photo} alt="" loading="lazy" />}</span>
                  <span className="my-listing__info">
                    <span className="my-listing__title">{listing.title}</span>
                    <span className="my-listing__meta">
                      {formatPrice(listing.priceCents, listing.currency)} · {CATEGORY_LABELS[listing.category]}
                    </span>
                  </span>
                  <span className={`my-listing__status my-listing__status--${listing.status.toLowerCase()}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
