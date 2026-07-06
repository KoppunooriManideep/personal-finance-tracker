import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DashboardState {
  /** Null means the whole family view; otherwise filter by account owner. */
  selectedOwnerId: string | null
  setSelectedOwnerId: (ownerId: string | null) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      selectedOwnerId: null,
      setSelectedOwnerId: (ownerId) => set({ selectedOwnerId: ownerId }),
    }),
    {
      name: 'dashboard-view',
    },
  ),
)
