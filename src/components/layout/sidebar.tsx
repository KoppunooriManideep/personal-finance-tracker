import { NavLink } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { navItems } from '@/config/nav'
import { cn } from '@/lib/utils'

/** Persistent desktop sidebar (hidden on mobile — see BottomNav). */
export function Sidebar() {
  return (
    <aside className="bg-card fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
          <Wallet className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">FinTrack</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
