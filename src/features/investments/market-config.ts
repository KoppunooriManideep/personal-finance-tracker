import { LineChart, PieChart, type LucideIcon } from 'lucide-react'
import { paths } from '@/config/paths'
import type { MarketHoldingKind } from '@/types/database.types'

interface MarketKindMeta {
  label: string
  singular: string
  icon: LucideIcon
  color: string
  path: string
  /** Word for a unit of quantity. */
  unit: string
}

export const MARKET_KIND_META: Record<MarketHoldingKind, MarketKindMeta> = {
  stock: {
    label: 'Stocks',
    singular: 'Stock',
    icon: LineChart,
    color: '#3b82f6',
    path: paths.investmentsStocks,
    unit: 'shares',
  },
  mutual_fund: {
    label: 'Mutual Funds',
    singular: 'Fund',
    icon: PieChart,
    color: '#8b5cf6',
    path: paths.investmentsMutualFunds,
    unit: 'units',
  },
}

/** Format a (possibly fractional) quantity in the Indian locale. */
export function formatQty(quantity: number): string {
  return quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })
}
