import type { ComponentType } from 'react'
import {
  ArrowLeftRight,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Tags,
  Wallet,
  type LucideProps,
} from 'lucide-react'
import { paths } from '@/config/paths'

export interface NavItem {
  label: string
  to: string
  icon: ComponentType<LucideProps>
}

/** Primary navigation shown in the desktop sidebar and mobile bottom bar. */
export const navItems: NavItem[] = [
  { label: 'Dashboard', to: paths.dashboard, icon: LayoutDashboard },
  { label: 'Transactions', to: paths.transactions, icon: ArrowLeftRight },
  { label: 'Accounts', to: paths.accounts, icon: Wallet },
  { label: 'Categories', to: paths.categories, icon: Tags },
  { label: 'Budgets', to: paths.budgets, icon: PiggyBank },
  { label: 'Settings', to: paths.settings, icon: Settings },
]
