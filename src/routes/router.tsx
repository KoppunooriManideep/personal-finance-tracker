import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { ProtectedRoute } from '@/routes/protected-route'
import { RequireFamily } from '@/routes/require-family'
import { LoginPage } from '@/features/auth/components/login-page'
import { OnboardingPage } from '@/features/family/components/onboarding-page'
import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import { TransactionsPage } from '@/features/transactions/components/transactions-page'
import { AccountsPage } from '@/features/accounts/components/accounts-page'
import { ChitsPage } from '@/features/chits/components/chits-page'
import { ChitDetailPage } from '@/features/chits/components/chit-detail-page'
import { InvestmentsPage } from '@/features/investments/components/investments-page'
import { GoldPage } from '@/features/investments/components/gold-page'
import { MarketPage } from '@/features/investments/components/market-page'
import { PfPage } from '@/features/investments/components/pf-page'
import { CategoriesPage } from '@/features/categories/components/categories-page'
import { BudgetsPage } from '@/features/budgets/components/budgets-page'
import { ReportsPage } from '@/features/reports/components/reports-page'
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
              { path: paths.chits, element: <ChitsPage /> },
              { path: paths.chitDetail, element: <ChitDetailPage /> },
              { path: paths.investments, element: <InvestmentsPage /> },
              { path: paths.investmentsGold, element: <GoldPage /> },
              {
                path: paths.investmentsStocks,
                element: <MarketPage kind="stock" />,
              },
              {
                path: paths.investmentsMutualFunds,
                element: <MarketPage kind="mutual_fund" />,
              },
              { path: paths.investmentsPf, element: <PfPage /> },
              { path: paths.categories, element: <CategoriesPage /> },
              { path: paths.budgets, element: <BudgetsPage /> },
              { path: paths.reports, element: <ReportsPage /> },
              { path: paths.settings, element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
])
