import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageLoader } from '../ui/Spinner'

/**
 * Wraps a route requiring authentication and optionally a specific account type.
 * Must be used as a layout route in React Router v6 — renders <Outlet /> for children.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>           — any logged-in user
 *   <Route element={<ProtectedRoute role="vendor" />}> — vendors only
 *   <Route element={<ProtectedRoute role="admin" />}>  — admins only
 */
export default function ProtectedRoute({ role }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  // Auth state still initializing
  if (loading) return <PageLoader />

  // Not logged in → send to login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Session exists but profile not yet fetched (race condition on fresh signup —
  // onAuthStateChange fires before the users table insert completes).
  // Wait instead of redirecting on a null profile.
  if (role && !profile) return <PageLoader />

  // Logged in but wrong account type → redirect to their home
  if (role && profile.account_type !== role) {
    const home = {
      customer: '/',
      vendor:   '/vendor/dashboard',
      admin:    '/admin',
    }
    return <Navigate to={home[profile.account_type] ?? '/login'} replace />
  }

  // Render matched child routes
  return <Outlet />
}
