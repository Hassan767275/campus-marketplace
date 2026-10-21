import { Link, NavLink, Outlet } from 'react-router'
import { ButtonLink } from '../components'
import './layout.css'

const navItems = [
  { to: '/', label: 'Browse', end: true },
  { to: '/sell', label: 'Sell' },
  { to: '/me', label: 'My stuff' },
]

/** Shell shared by every page: header + nav on top, routed page below. */
export function AppLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__brand">
            Campus Marketplace
          </Link>
          <nav className="app-nav" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {/* Auth-aware state (current user, log out) comes with task 1.6. */}
          <div className="app-header__auth">
            <ButtonLink to="/login" variant="ghost" size="sm">
              Log in
            </ButtonLink>
            <ButtonLink to="/signup" size="sm">
              Sign up
            </ButtonLink>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
