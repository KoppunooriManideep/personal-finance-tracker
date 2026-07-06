import { Navigate } from 'react-router-dom'
import { Home, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { ModeToggle } from '@/components/layout/mode-toggle'
import { UserMenu } from '@/components/layout/user-menu'
import { paths } from '@/config/paths'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import { CreateFamilyForm } from '@/features/family/components/create-family-form'
import { JoinFamilyForm } from '@/features/family/components/join-family-form'

/**
 * First-login onboarding. Users either create a family (becoming owner) or join
 * one via invite code. Once a family exists they are redirected to the
 * dashboard. A slim top bar provides theme toggle + sign-out (the app shell is
 * intentionally not rendered before a family exists).
 */
export function OnboardingPage() {
  const { data: family, isLoading } = useCurrentFamily()

  if (isLoading) return <FullScreenLoader />
  if (family) return <Navigate to={paths.dashboard} replace />

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold tracking-tight">FinTrack</span>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <UserMenu />
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to FinTrack
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a family to start, or join one you've been invited to.
          </p>
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Home className="text-primary h-5 w-5 shrink-0" />
            <div className="text-left">
              <CardTitle className="text-base">Create a family</CardTitle>
              <CardDescription>You'll be the owner.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CreateFamilyForm />
          </CardContent>
        </Card>

        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" />
          OR
          <span className="bg-border h-px flex-1" />
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Users className="text-primary h-5 w-5 shrink-0" />
            <div className="text-left">
              <CardTitle className="text-base">Join a family</CardTitle>
              <CardDescription>Use an invite code.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <JoinFamilyForm />
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
