import { createBrowserRouter } from 'react-router'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './pages/NotFoundPage'
import {
  BrowsePage,
  ListingDetailPage,
  LoginPage,
  MyStuffPage,
  SellPage,
  SignupPage,
} from './pages/placeholders'

// Every page renders inside AppLayout. Add new routes as children here.
// Unknown paths also render inside the layout (vercel.json rewrites all paths to index.html).
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <BrowsePage /> },
      { path: '/listings/:listingId', element: <ListingDetailPage /> },
      { path: '/sell', element: <SellPage /> },
      { path: '/me', element: <MyStuffPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
