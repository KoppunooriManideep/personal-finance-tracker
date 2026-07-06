import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { paths } from '@/config/paths'
import { FullScreenLoader } from '@/components/common/full-screen-loader'

/**
 * Gate for authenticated routes. Shows a loader while the session resolves,
 * then redirects to /login when there is no session (preserving the intended
 * destination in location state).
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  if (!session) {
    return <Navigate to={paths.login} replace state={{ from: location }} />
  }

  return <Outlet />
}
