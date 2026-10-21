import { useState } from 'react'
import { ApiError } from '../../api/client'
import { resendVerification } from '../../auth/authApi'
import { Button } from '../../components'

/** "Resend verification email" button with its own result message. */
export function ResendVerification({ email }: { email: string }) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function resend() {
    setSending(true)
    setMessage(null)
    try {
      setMessage((await resendVerification(email)).message)
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not resend the email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="resend">
      <Button variant="secondary" size="sm" onClick={resend} loading={sending}>
        Resend verification email
      </Button>
      {message && <p className="resend__message">{message}</p>}
    </div>
  )
}
