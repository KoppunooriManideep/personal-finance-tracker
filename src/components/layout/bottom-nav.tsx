import { NavLink } from 'react-router-dom'
import { navItems } from '@/config/nav'
import { cn } from '@/lib/utils'

/** Fixed bottom navigation for mobile (hidden on desktop — see Sidebar). */
export function BottomNav() {
  return (
    <nav className="bg-card fixed inset-x-0 bottom-0 z-30 border-t md:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}
      >
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
