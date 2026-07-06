import {
  Baby,
  Banknote,
  Bike,
  Book,
  Briefcase,
  Brush,
  Bus,
  Cake,
  Car,
  CircleDollarSign,
  CircleMinus,
  CirclePlus,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  PiggyBank,
  Plane,
  Plug,
  Receipt,
  RotateCcw,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Smartphone,
  Sparkles,
  Tag,
  Train,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Registry mapping stored icon names (kebab-case, matching the seeded Indian
 * defaults) to their lucide-react components. Categories persist only the icon
 * *name* string; this map resolves it back to a renderable component.
 */
export const categoryIcons = {
  baby: Baby,
  banknote: Banknote,
  bike: Bike,
  book: Book,
  briefcase: Briefcase,
  brush: Brush,
  bus: Bus,
  cake: Cake,
  car: Car,
  'circle-dollar-sign': CircleDollarSign,
  'circle-minus': CircleMinus,
  'circle-plus': CirclePlus,
  clapperboard: Clapperboard,
  coffee: Coffee,
  coins: Coins,
  'credit-card': CreditCard,
  dog: Dog,
  dumbbell: Dumbbell,
  fuel: Fuel,
  gamepad: Gamepad2,
  gift: Gift,
  'graduation-cap': GraduationCap,
  'hand-heart': HandHeart,
  'heart-pulse': HeartPulse,
  home: Home,
  landmark: Landmark,
  laptop: Laptop,
  music: Music,
  'piggy-bank': PiggyBank,
  plane: Plane,
  plug: Plug,
  receipt: Receipt,
  'rotate-ccw': RotateCcw,
  scissors: Scissors,
  'shield-check': ShieldCheck,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  smartphone: Smartphone,
  sparkles: Sparkles,
  tag: Tag,
  train: Train,
  'trending-up': TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  wrench: Wrench,
  zap: Zap,
} satisfies Record<string, LucideIcon>

export type CategoryIconName = keyof typeof categoryIcons

/** Ordered list of icon names offered in the picker. */
export const categoryIconNames = Object.keys(
  categoryIcons,
) as CategoryIconName[]

/** Fallback icon used when a category has no icon or an unknown name. */
export const fallbackCategoryIcon: LucideIcon = Tag

/** Type guard for persisted icon names before putting them into forms. */
export function isCategoryIconName(
  name: string | null | undefined,
): name is CategoryIconName {
  return Boolean(name && name in categoryIcons)
}

/** Resolve a stored icon name to a component, falling back to a generic tag. */
export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  if (isCategoryIconName(name)) {
    return categoryIcons[name]
  }
  return fallbackCategoryIcon
}
