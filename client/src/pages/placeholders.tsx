import { Card } from '../components'
import { Page } from '../layout/Page'

// Placeholder pages so routing and layout can be checked end to end.
// Each is replaced by its real page in a later task (noted below).

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
