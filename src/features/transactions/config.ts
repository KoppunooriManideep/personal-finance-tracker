import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  type LucideIcon,
} from 'lucide-react'
import type { TransactionType } from '@/types/database.types'

interface TransactionTypeMeta {
  label: string
  icon: LucideIcon
  amountClassName: string
  badgeClassName: string
}

export const transactionTypeMeta: Record<TransactionType, TransactionTypeMeta> =
  {
    income: {
      label: 'Income',
      icon: ArrowUpCircle,
      amountClassName: 'text-emerald-600 dark:text-emerald-400',
      badgeClassName: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    expense: {
      label: 'Expense',
      icon: ArrowDownCircle,
      amountClassName: 'text-rose-600 dark:text-rose-400',
      badgeClassName: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    },
    transfer: {
      label: 'Transfer',
      icon: ArrowLeftRight,
      amountClassName: 'text-sky-600 dark:text-sky-400',
      badgeClassName: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    },
  }
