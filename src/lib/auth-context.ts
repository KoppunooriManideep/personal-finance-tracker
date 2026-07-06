import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  /** Current Supabase session, or null when signed out. */
  session: Session | null
  /** Convenience accessor for the signed-in user. */
  user: User | null
  /** True while the initial session is being resolved. */
  loading: boolean
  /** Start the Google OAuth redirect flow. */
  signInWithGoogle: () => Promise<void>
  /** Sign the current user out. */
  signOut: () => Promise<void>
}

/**
 * Auth context shared between AuthProvider and the useAuth hook.
 * Split from the provider so each file has a single concern.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
