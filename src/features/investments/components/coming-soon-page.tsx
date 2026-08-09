import { Link } from 'react-router-dom'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { paths } from '@/config/paths'

interface ComingSoonPageProps {
  title: string
  description: string
  icon: LucideIcon
}

/** Placeholder detail page for an asset class we haven't built yet. */
export function ComingSoonPage({ title, description, icon }: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={paths.investments}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Investments
      </Link>

      <EmptyState icon={icon} title={`${title} · Coming soon`} description={description} />
    </div>
  )
}
