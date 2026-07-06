import { useEffect, useState, type ReactNode } from 'react'
import {
  THEME_STORAGE_KEY,
  ThemeProviderContext,
  type Theme,
} from '@/lib/theme-context'

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
}

/**
 * Provides light/dark/system theming. Applies the resolved theme by toggling
 * the `dark` class on <html> (matches the Tailwind v4 custom-variant in
 * index.css) and persists the choice to localStorage.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) ?? defaultTheme,
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme

    root.classList.add(resolved)
  }, [theme])

  const setTheme = (next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setThemeState(next)
  }

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
