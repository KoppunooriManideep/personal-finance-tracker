import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Wallet,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { paths } from '@/config/paths'
import { moreNavItems } from '@/config/nav'
import { useTransactionFormStore } from '@/stores/transaction-form-store'
import { cn } from '@/lib/utils'

/** Routes reachable from the "More" sheet — used to keep "More" highlighted. */
const moreRoutes = moreNavItems.map((item) => item.to)

/** Fixed bottom navigation for mobile (hidden on desktop — see Sidebar). */
export function BottomNav() {
  const { open } = useTransactionFormStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = moreRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  const goTo = (to: string) => {
    setMoreOpen(false)
    navigate(to)
  }

  return (
    <>
      <nav
        className="bg-card fixed inset-x-0 bottom-0 z-30 border-t md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid h-16 grid-cols-5 items-center justify-items-center">
          <NavItem to={paths.dashboard} label="Dashboard" icon={LayoutDashboard} />
          <NavItem
            to={paths.transactions}
            label="Transactions"
            icon={ArrowLeftRight}
          />

          <button
            type="button"
            onClick={open}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Add transaction"
          >
            <Plus className="h-4 w-4" />
          </button>

          <NavItem to={paths.accounts} label="Accounts" icon={Wallet} />

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors cursor-pointer',
              moreActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[70dvh] gap-0 rounded-t-2xl p-0"
        >
          <SheetTitle className="sr-only">More</SheetTitle>
          <div className="flex justify-center pt-3 pb-1">
            <span
              aria-hidden
              className="h-1.5 w-10 rounded-full bg-muted-foreground/30"
            />
          </div>
          <div
            className="overflow-y-auto px-3 pt-2"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              {moreNavItems.map(({ label, to, icon: Icon }) => {
                const active =
                  pathname === to || pathname.startsWith(`${to}/`)
                return (
                  <button
                    key={to}
                    type="button"
                    onClick={() => goTo(to)}
                    className={cn(
                      'flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition-colors cursor-pointer',
                      active ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium leading-tight',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

interface NavItemProps {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

function NavItem({ to, label, icon: Icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium transition-colors cursor-pointer',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  )
}
