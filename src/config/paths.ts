/**
 * Centralized route paths. Reference these instead of hardcoding strings so
 * routing stays refactor-safe as the app grows.
 */
export const paths = {
  home: '/',
  login: '/login',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  transactions: '/transactions',
  accounts: '/accounts',
  categories: '/categories',
  budgets: '/budgets',
  recurring: '/recurring',
  settings: '/settings',
} as const

export type AppPath = (typeof paths)[keyof typeof paths]
