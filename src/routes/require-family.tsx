import { Navigate, Outlet } from 'react-router-dom'
import { paths } from '@/config/paths'
import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/**
 * Gate for routes that require a family. Redirects users who haven't created or
 * joined a family yet to onboarding.
 */
export function RequireFamily() {
  const { data: family, isLoading } = useCurrentFamily()

  if (isLoading) return <FullScreenLoader />
  if (!family) return <Navigate to={paths.onboarding} replace />

  return <Outlet />
}
