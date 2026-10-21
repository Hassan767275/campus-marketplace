import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { ApiError } from '../../api/client'
import type { RedirectState } from '../../auth/redirect'
import { useAuth } from '../../auth/useAuth'
import { Alert, Button, Card, Input } from '../../components'
import { Page } from '../../layout/Page'
import { ResendVerification } from './ResendVerification'
import './auth.css'

type LoginLocationState = RedirectState & { email?: string }

export function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()
  const state = location.state as LoginLocationState | null

  const [email, setEmail] = useState(state?.email ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setUnverifiedEmail(null)
    try {
      // On success RedirectIfAuthenticated sends the user back to where they were headed.
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(email)
      setSubmitting(false)
    }
  }

  return (
    <Page title="Welcome back" description="Log in with your school email." width="narrow">
      <Card>
        <form className="auth-form" onSubmit={handleSubmit}>
          {state?.from && !error && <Alert>Log in to continue.</Alert>}
          {error && (
            <Alert tone="error">
              <span>{error}</span>
              {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
            </Alert>
          )}
          <Input
            label="School email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" fullWidth loading={submitting}>
            Log in
          </Button>
        </form>
      </Card>
      <p className="auth-switch">
        New here?{' '}
        <Link to="/signup" state={state?.from ? { from: state.from } : undefined}>
          Create an account
        </Link>
      </p>
    </Page>
  )
}
