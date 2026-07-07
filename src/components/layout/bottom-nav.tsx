import { NavLink } from 'react-router-dom'
import {
  ArrowLeftRight,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Wallet,
} from 'lucide-react'
import { paths } from '@/config/paths'
import { useTransactionFormStore } from '@/stores/transaction-form-store'
import { cn } from '@/lib/utils'

/** Fixed bottom navigation for mobile (hidden on desktop — see Sidebar). */
export function BottomNav() {
  const { open } = useTransactionFormStore()

  const items = [
    { label: 'Dashboard', to: paths.dashboard, icon: LayoutDashboard },
    { label: 'Transactions', to: paths.transactions, icon: ArrowLeftRight },
    { label: 'Add', to: '', icon: Plus, isPlus: true },
    { label: 'Accounts', to: paths.accounts, icon: Wallet },
    { label: 'Budgets', to: paths.budgets, icon: PiggyBank },
  ]

  return (
    <nav className="bg-card fixed inset-x-0 bottom-0 z-30 border-t md:hidden h-16">
      <div className="grid grid-cols-5 items-center justify-items-center h-full">
        {items.map((item) => {
          const Icon = item.icon
          if (item.isPlus) {
            return (
              <button
                key="plus"
                type="button"
                onClick={open}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                aria-label="Add transaction"
              >
                <Plus className="h-4 w-4" />
              </button>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
