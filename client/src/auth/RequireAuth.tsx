import { Navigate, Outlet, useLocation } from 'react-router'
import { safeRedirect, type RedirectState } from './redirect'
import { useAuth } from './useAuth'

/** Route guard: renders child routes for logged-in users, otherwise sends them to /login. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <p className="page-status" role="status">
        Loading…
      </p>
    )
  }
  if (status === 'anonymous') {
    const from = location.pathname + location.search + location.hash
    return <Navigate to="/login" replace state={{ from } satisfies RedirectState} />
  }
  return <Outlet />
}

/** For /login and /signup: logged-in users are sent on (back to where they were headed, or home). */
export function RedirectIfAuthenticated() {
  const { status } = useAuth()
  const location = useLocation()
  const from = (location.state as RedirectState | null)?.from

  if (status === 'loading') return null
  if (status === 'authenticated') return <Navigate to={safeRedirect(from)} replace />
  return <Outlet />
}
