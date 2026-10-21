import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { ApiError } from '../../api/client'
import { signup } from '../../auth/authApi'
import type { RedirectState } from '../../auth/redirect'
import { Alert, Button, ButtonLink, Card, Input } from '../../components'
import { Page } from '../../layout/Page'
import { ResendVerification } from './ResendVerification'
import './auth.css'

// Same limits as the server (server/src/routes/auth.ts).
const MIN_PASSWORD = 8
const MAX_PASSWORD = 128
const MAX_DISPLAY_NAME = 50

export function SignupPage() {
  const location = useLocation()
  const from = (location.state as RedirectState | null)?.from

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { user } = await signup({ displayName: displayName.trim(), email, password })
      setSignedUpEmail(user.email)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (signedUpEmail) {
    return (
      <Page title="Check your email" width="narrow">
        <Card>
          <div className="auth-form">
            <Alert tone="success">
              We sent a verification link to <strong>{signedUpEmail}</strong>. Open it, then log in.
            </Alert>
            <ButtonLink to="/login" state={{ email: signedUpEmail, from }} fullWidth>
              Go to login
            </ButtonLink>
            <div className="auth-form__secondary">
              <span className="text-muted">Didn't get it?</span>
              <ResendVerification email={signedUpEmail} />
            </div>
          </div>
        </Card>
      </Page>
    )
  }

  return (
    <Page title="Join your campus marketplace" description="Buy and sell with students at your school." width="narrow">
      <Card>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <Alert tone="error">{error}</Alert>}
          <Input
            label="Display name"
            hint="Shown to buyers and sellers."
            autoComplete="nickname"
            required
            maxLength={MAX_DISPLAY_NAME}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="School email"
            hint="Only school email addresses can sign up."
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            hint={`At least ${MIN_PASSWORD} characters.`}
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            maxLength={MAX_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" fullWidth loading={submitting}>
            Create account
          </Button>
        </form>
      </Card>
      <p className="auth-switch">
        Already have an account?{' '}
        <Link to="/login" state={from ? { from } : undefined}>
          Log in
        </Link>
      </p>
    </Page>
  )
}
