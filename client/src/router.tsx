import { createBrowserRouter } from 'react-router'
import { RedirectIfAuthenticated, RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { BrowsePage } from './pages/listings/BrowsePage'
import { ListingDetailPage } from './pages/listings/ListingDetailPage'
import { SellPage } from './pages/listings/SellPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { MyStuffPage } from './pages/me/MyStuffPage'

// Every page renders inside AppLayout. Add new routes as children here:
// public pages at the top level, logged-in-only pages under RequireAuth.
// Unknown paths also render inside the layout (vercel.json rewrites all paths to index.html).
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <BrowsePage /> },
      { path: '/listings/:listingId', element: <ListingDetailPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/sell', element: <SellPage /> },
          { path: '/me', element: <MyStuffPage /> },
        ],
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
