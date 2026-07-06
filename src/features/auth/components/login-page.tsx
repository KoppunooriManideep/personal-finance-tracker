import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { paths } from '@/config/paths'
import { GoogleIcon } from '@/features/auth/components/google-icon'
import { FullScreenLoader } from '@/components/common/full-screen-loader'

/**
 * Google-only sign-in screen. If the user is already authenticated they are
 * redirected home.
 */
export function LoginPage() {
  const { session, loading, signInWithGoogle } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to={paths.home} replace />

  const handleSignIn = async () => {
    try {
      setSubmitting(true)
      await signInWithGoogle()
      // On success the browser redirects to Google; nothing else to do.
    } catch (error) {
      setSubmitting(false)
      toast.error('Could not sign in with Google. Please try again.')
      console.error(error)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to FinTrack</CardTitle>
          <CardDescription>
            Track your family's income, expenses and budgets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            variant="outline"
            onClick={handleSignIn}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            Continue with Google
          </Button>
          <p className="text-muted-foreground mt-4 text-center text-xs">
            By continuing you agree to our terms and privacy policy.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
