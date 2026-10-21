import { useEffect, type ReactNode } from 'react'
import './layout.css'

type PageProps = {
  title: string
  description?: ReactNode
  /** Rendered beside the title, e.g. a primary action. */
  actions?: ReactNode
  /** Narrow pages suit forms (login, post a listing). */
  width?: 'default' | 'narrow'
  children: ReactNode
}

/** Page container: consistent width, padding and heading for every route. */
export function Page({ title, description, actions, width = 'default', children }: PageProps) {
  useEffect(() => {
    document.title = `${title} · Campus Marketplace`
  }, [title])

  return (
    <div className={width === 'narrow' ? 'page page--narrow' : 'page'}>
      <div className="page__header">
        <div className="page__heading">
          <h1>{title}</h1>
          {description && <p className="text-muted">{description}</p>}
        </div>
        {actions && <div className="page__actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
