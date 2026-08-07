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
  chits: '/chits',
  chitDetail: '/chits/:id',
  categories: '/categories',
  budgets: '/budgets',
  reports: '/reports',
  recurring: '/recurring',
  settings: '/settings',
} as const

export type AppPath = (typeof paths)[keyof typeof paths]

/** Build the URL for a single chit's detail page. */
export const chitDetailPath = (id: string) => `/chits/${id}`
