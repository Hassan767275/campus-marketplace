import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface StyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

function buttonClass({ variant = 'primary', size = 'md', fullWidth }: StyleProps, extra?: string) {
  return ['btn', `btn--${variant}`, `btn--${size}`, fullWidth && 'btn--full', extra]
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps & { loading?: boolean }

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

/** A router link styled as a button, for navigation actions. */
export function ButtonLink({ variant, size, fullWidth, className, ...rest }: LinkProps & StyleProps) {
  return <Link className={buttonClass({ variant, size, fullWidth }, className)} {...rest} />
}
