import type { ComponentType } from 'react'
import {
  ArrowLeftRight,
  Coins,
  FileBarChart,
  Gem,
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

/** Primary navigation shown in the desktop sidebar. */
export const navItems: NavItem[] = [
  { label: 'Dashboard', to: paths.dashboard, icon: LayoutDashboard },
  { label: 'Transactions', to: paths.transactions, icon: ArrowLeftRight },
  { label: 'Accounts', to: paths.accounts, icon: Wallet },
  { label: 'Chits', to: paths.chits, icon: Coins },
  { label: 'Investments', to: paths.investments, icon: Gem },
  { label: 'Budgets', to: paths.budgets, icon: PiggyBank },
  { label: 'Reports', to: paths.reports, icon: FileBarChart },
  { label: 'Categories', to: paths.categories, icon: Tags },
  { label: 'Settings', to: paths.settings, icon: Settings },
]

/**
 * App features surfaced in the mobile bottom-nav "More" sheet. Add new
 * feature entries here — the sheet renders whatever is in this list.
 */
export const moreNavItems: NavItem[] = [
  { label: 'Chits', to: paths.chits, icon: Coins },
  { label: 'Investments', to: paths.investments, icon: Gem },
  { label: 'Budgets', to: paths.budgets, icon: PiggyBank },
  { label: 'Reports', to: paths.reports, icon: FileBarChart },
  { label: 'Categories', to: paths.categories, icon: Tags },
]
