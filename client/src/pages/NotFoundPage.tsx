import { ButtonLink, Card } from '../components'
import { Page } from '../layout/Page'

export function NotFoundPage() {
  return (
    <Page title="Page not found" width="narrow">
      <Card>
        <div className="stack">
          <p className="text-muted">That page doesn't exist or has moved.</p>
          <div>
            <ButtonLink to="/" variant="secondary">
              Back to browse
            </ButtonLink>
          </div>
        </div>
      </Card>
    </Page>
  )
}
