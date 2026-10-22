import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import type { CheckoutOrder } from '../../checkout/checkoutApi'
import { Alert, Button, ButtonLink, Card, Textarea } from '../../components'
import { scanHandoffToken } from '../../handoff/handoffApi'
import { useQrScanner } from '../../handoff/useQrScanner'
import { Page } from '../../layout/Page'
import { formatPrice } from '../../listings/format'
import './handoff.css'

// Buyer's side of the handoff: scan the seller's QR code to release the
// payment. The server checks the code and that this logged-in buyer owns the
// order, then captures. Pasting the code is a fallback for devices without a camera.

type State =
  | { status: 'scanning' }
  | { status: 'submitting' }
  | { status: 'done'; order: CheckoutOrder }
  | { status: 'error'; message: string }

export function ScanPage() {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<State>({ status: 'scanning' })
  const [pasted, setPasted] = useState('')

  const submit = useCallback(async (token: string) => {
    setState({ status: 'submitting' })
    try {
      // Tokens never contain whitespace; pasted ones can pick up line breaks.
      const { order } = await scanHandoffToken(token.replace(/\s+/g, ''))
      setState({ status: 'done', order })
    } catch (err) {
      setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not check that code.' })
    }
  }, [])

  const camera = useQrScanner(video, state.status === 'scanning', submit)

  function onPaste(e: FormEvent) {
    e.preventDefault()
    if (pasted.trim()) void submit(pasted)
  }

  return (
    <Page title="Scan handoff code" description="Scan the seller's QR code when you get the item." width="narrow">
      <Card>
        <div className="stack">
          {state.status === 'done' && (
            <>
              <Alert tone="success">
                Payment complete: {formatPrice(state.order.amountCents, state.order.currency)} released to the seller. Enjoy!
              </Alert>
              <ButtonLink to="/me">Go to my stuff</ButtonLink>
            </>
          )}
          {state.status === 'error' && (
            <>
              <Alert tone="error">{state.message}</Alert>
              <Button onClick={() => setState({ status: 'scanning' })}>Scan again</Button>
            </>
          )}
          {state.status === 'submitting' && <p className="text-muted">Checking the code…</p>}

          <div className="scan__viewport" hidden={state.status !== 'scanning'}>
            <video ref={video} className="scan__video" muted playsInline />
            {camera === 'starting' && <p className="scan__overlay">Starting camera…</p>}
            {camera === 'denied' && (
              <p className="scan__overlay">Camera access was blocked. Allow it in your browser settings, or paste the code below.</p>
            )}
            {camera === 'unavailable' && <p className="scan__overlay">No camera available. Paste the code below.</p>}
          </div>

          {state.status === 'scanning' && (
            <form className="stack" onSubmit={onPaste}>
              <Textarea
                label="Or paste the code"
                rows={3}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <Button type="submit" variant="secondary" disabled={!pasted.trim()}>
                Submit code
              </Button>
            </form>
          )}
        </div>
      </Card>
    </Page>
  )
}
