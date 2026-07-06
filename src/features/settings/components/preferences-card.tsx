import { IndianRupee, Moon, Sun, Monitor } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'
import type { Theme } from '@/lib/theme-context'

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Local preferences. Currency is fixed to INR for India-only Phase 1. */
export function PreferencesCard() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferences</CardTitle>
        <CardDescription>Currency and appearance settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-md">
              <IndianRupee className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">Currency</p>
              <p className="text-muted-foreground text-sm">
                Indian Rupee, stored as paise
              </p>
            </div>
          </div>
          <span className="text-sm font-medium">INR</span>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const selected = theme === option.value
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'justify-center',
                    selected && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </Button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
