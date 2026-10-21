import { useParams } from 'react-router'
import { ButtonLink, Card } from '../components'
import { Page } from '../layout/Page'

// Placeholder pages so routing and layout can be checked end to end.
// Each is replaced by its real page in a later task (noted below).

export function BrowsePage() {
  // Task 1.7
  return (
    <Page
      title="Browse"
      description="Find things other students are selling."
      actions={<ButtonLink to="/sell">Post a listing</ButtonLink>}
    >
      <Card>
        <p className="text-muted">Listings grid and filters go here.</p>
      </Card>
    </Page>
  )
}

export function ListingDetailPage() {
  // Tasks 1.7 and 1.8
  const { listingId } = useParams()
  return (
    <Page title="Listing">
      <Card>
        <p className="text-muted">
          Details and chat for listing <code>{listingId}</code> go here.
        </p>
      </Card>
    </Page>
  )
}

export function SellPage() {
  // Task 1.7
  return (
    <Page title="Post a listing" width="narrow">
      <Card>
        <p className="text-muted">Listing form with photo upload goes here.</p>
      </Card>
    </Page>
  )
}

export function MyStuffPage() {
  // Task 1.8
  return (
    <Page title="My stuff">
      <Card title="My listings">
        <p className="text-muted">Your listings go here.</p>
      </Card>
      <Card title="My orders">
        <p className="text-muted">Your orders go here.</p>
      </Card>
    </Page>
  )
}
