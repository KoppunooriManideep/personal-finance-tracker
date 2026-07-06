import { createContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

/**
 * Theme context shared between ThemeProvider and the useTheme hook.
 * Kept in its own file so provider/hook files each have a single concern
 * (and stay friendly to React Fast Refresh).
 */
export const ThemeProviderContext = createContext<
  ThemeProviderState | undefined
>(undefined)

export const THEME_STORAGE_KEY = 'fintrack-theme'
