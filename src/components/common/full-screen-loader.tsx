import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Full-viewport centered spinner used while auth/session is resolving. */
export function FullScreenLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-svh w-full items-center justify-center',
        className,
      )}
    >
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
