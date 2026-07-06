import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  /** Tailwind size classes for the icon, defaults to h-6 w-6. */
  size?: string
  label?: string
}

/** Inline spinner for loading states within a section or button. */
export function LoadingSpinner({
  className,
  size = 'h-6 w-6',
  label = 'Loading…',
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <Loader2 className={cn('text-muted-foreground animate-spin', size)} />
      <span className="sr-only">{label}</span>
    </div>
  )
}
