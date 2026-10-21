import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode
  /** Rendered on the right of the card header, e.g. a button. */
  actions?: ReactNode
  footer?: ReactNode
}

export function Card({ title, actions, footer, className, children, ...rest }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {(title || actions) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
      {footer && <footer className="card__footer">{footer}</footer>}
    </section>
  )
}
