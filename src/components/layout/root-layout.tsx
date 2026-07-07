import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { AppHeader } from '@/components/layout/app-header'
import { TransactionFormDialog } from '@/features/transactions/components/transaction-form-dialog'
import { useAccounts } from '@/features/accounts/hooks/use-accounts'
import { useCategories } from '@/features/categories/hooks/use-categories'
import { useTransactionFormStore } from '@/stores/transaction-form-store'

/**
 * Responsive app shell shared by all authenticated routes:
 *   - desktop: fixed sidebar on the left
 *   - mobile: fixed bottom navigation
 *   - top: sticky header with family name + user/theme controls
 */
export function RootLayout() {
  const { isOpen, close } = useTransactionFormStore()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  return (
    <div className="bg-background min-h-svh">
      <Sidebar />
      <div className="flex min-h-svh flex-col md:pl-60">
        <AppHeader />
        <main className="flex-1 p-4 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <Toaster />

      <TransactionFormDialog
        open={isOpen}
        onOpenChange={(open) => !open && close()}
        accounts={accounts ?? []}
        categories={categories ?? []}
      />
    </div>
  )
}
