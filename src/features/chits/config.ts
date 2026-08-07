import { CheckCircle2, Coins } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChitStatus } from '@/types/database.types'

/** Icon + badge styling for a chit card. */
export const chitIcon: LucideIcon = Coins
export const chitBadgeClassName =
  'bg-amber-500/10 text-amber-600 dark:text-amber-400'

interface ChitStatusMeta {
  label: string
  icon: LucideIcon
  /** Tailwind classes for a small status pill. */
  badgeClassName: string
}

/** Presentation metadata for each chit status. */
export const chitStatusMeta: Record<ChitStatus, ChitStatusMeta> = {
  active: {
    label: 'Active',
    icon: Coins,
    badgeClassName: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClassName: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
}
