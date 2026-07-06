import { Banknote, CreditCard, Landmark, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AccountType } from '@/types/database.types'

/** Ordered list of the account types users can pick from. */
export const accountTypes = [
  'cash',
  'bank',
  'credit_card',
  'wallet',
] as const satisfies readonly AccountType[]

interface AccountTypeMeta {
  label: string
  icon: LucideIcon
  /** Tailwind classes for the icon badge (background + foreground). */
  badgeClassName: string
}

/** Presentation metadata (label + icon) for each account type. */
export const accountTypeMeta: Record<AccountType, AccountTypeMeta> = {
  cash: {
    label: 'Cash',
    icon: Banknote,
    badgeClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  bank: {
    label: 'Bank',
    icon: Landmark,
    badgeClassName: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  credit_card: {
    label: 'Credit Card',
    icon: CreditCard,
    badgeClassName: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  wallet: {
    label: 'Wallet',
    icon: Wallet,
    badgeClassName: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
}
