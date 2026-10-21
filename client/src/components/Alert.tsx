import type { ReactNode } from 'react'
import './Alert.css'

type AlertProps = {
  tone?: 'info' | 'success' | 'error'
  children: ReactNode
}

/** Inline message box for form errors and notices. Errors are announced to screen readers. */
export function Alert({ tone = 'info', children }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
