import { Skeleton } from '@/components/ui/skeleton'
import { ModeToggle } from '@/components/layout/mode-toggle'
import { UserMenu } from '@/components/layout/user-menu'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

/** Sticky top header: current family name + theme toggle + account menu. */
export function AppHeader() {
  const { data: family, isLoading } = useCurrentFamily()

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 backdrop-blur">
      <div className="min-w-0">
        {isLoading ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <span className="truncate font-semibold tracking-tight">
            {family?.name ?? 'FinTrack'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
