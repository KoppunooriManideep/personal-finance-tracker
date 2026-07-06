import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client. Conservative defaults suited to a finance app
 * where data changes infrequently within a session.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
