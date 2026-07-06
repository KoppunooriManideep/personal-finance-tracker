import { useContext } from 'react'
import { ThemeProviderContext } from '@/lib/theme-context'

/** Access the current theme and setter. Must be used within <ThemeProvider>. */
export function useTheme() {
  const context = useContext(ThemeProviderContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
