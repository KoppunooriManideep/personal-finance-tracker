import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { ProtectedRoute } from '@/routes/protected-route'
import { RequireFamily } from '@/routes/require-family'
import { LoginPage } from '@/features/auth/components/login-page'
import { OnboardingPage } from '@/features/family/components/onboarding-page'
import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import { TransactionsPage } from '@/features/transactions/components/transactions-page'
import { AccountsPage } from '@/features/accounts/components/accounts-page'
import { CategoriesPage } from '@/features/categories/components/categories-page'
import { BudgetsPage } from '@/features/budgets/components/budgets-page'
import { SettingsPage } from '@/features/settings/components/settings-page'
import { paths } from '@/config/paths'

/**
 * Application router.
 *   - /login is public.
 *   - /onboarding is protected but rendered without the app shell.
 *   - All other routes are protected, require a family, and share the
 *     responsive RootLayout. The index route redirects to the dashboard.
 */
export const router = createBrowserRouter([
  { path: paths.login, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: paths.onboarding, element: <OnboardingPage /> },
      {
        element: <RequireFamily />,
        children: [
          {
            element: <RootLayout />,
            children: [
              {
                path: paths.home,
                element: <Navigate to={paths.dashboard} replace />,
              },
              { path: paths.dashboard, element: <DashboardPage /> },
              { path: paths.transactions, element: <TransactionsPage /> },
              { path: paths.accounts, element: <AccountsPage /> },
              { path: paths.categories, element: <CategoriesPage /> },
              { path: paths.budgets, element: <BudgetsPage /> },
              { path: paths.settings, element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
])
