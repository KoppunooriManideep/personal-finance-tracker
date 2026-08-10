import { Coins, Gem, RectangleHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GoldForm } from '@/types/database.types'

/** Icon + badge styling for gold cards. */
export const goldIcon: LucideIcon = Gem
export const goldBadgeClassName =
  'bg-amber-500/10 text-amber-600 dark:text-amber-400'

/** The three gold forms, with display labels and icons. */
export const GOLD_FORMS: { value: GoldForm; label: string; icon: LucideIcon }[] =
  [
    { value: 'coin', label: 'Coin', icon: Coins },
    { value: 'bar', label: 'Bar', icon: RectangleHorizontal },
    { value: 'jewellery', label: 'Jewellery', icon: Gem },
  ]

export function formLabel(form: GoldForm): string {
  return GOLD_FORMS.find((f) => f.value === form)?.label ?? form
}

/** Icon per form, indexed (not called) so it can be read during render. */
export const FORM_ICONS: Record<GoldForm, LucideIcon> = {
  coin: Coins,
  bar: RectangleHorizontal,
  jewellery: Gem,
}

/** Common Indian gold purities, mapped to fineness (parts-per-thousand). */
export const PURITY_PRESETS: { fineness: number; label: string }[] = [
  { fineness: 999, label: '24K (999)' },
  { fineness: 995, label: '24K (995)' },
  { fineness: 916, label: '22K (916)' },
  { fineness: 875, label: '21K (875)' },
  { fineness: 833, label: '20K (833)' },
  { fineness: 750, label: '18K (750)' },
  { fineness: 585, label: '14K (585)' },
]

/** Human label for a fineness, falling back to the raw ppt when uncommon. */
export function finenessLabel(fineness: number): string {
  return (
    PURITY_PRESETS.find((p) => p.fineness === fineness)?.label ??
    `${fineness} fineness`
  )
}

/** Short karat label for chips/breakdowns, e.g. 916 → "22K", 999 → "24K". */
export function karatLabel(fineness: number): string {
  return `${Math.round((fineness / 999) * 24)}K`
}

/** Distinct-ish gold-toned palette for allocation slices. */
export const ALLOCATION_COLORS = [
  '#d4a017',
  '#b8860b',
  '#e6b325',
  '#8b6914',
  '#f0c419',
  '#a0741b',
  '#c9962b',
]

/** Format integer milligrams as grams, e.g. 8000 → "8.000 g". */
export function formatGrams(mg: number): string {
  return `${(mg / 1000).toLocaleString('en-IN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} g`
}
