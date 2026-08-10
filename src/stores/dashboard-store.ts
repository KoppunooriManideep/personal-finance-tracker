import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Which lens the Dashboard is showing: monthly cash-flow vs net worth. */
export type DashboardView = 'spending' | 'networth'

interface DashboardState {
  /** Null means the whole family view; otherwise filter by account owner. */
  selectedOwnerId: string | null
  setSelectedOwnerId: (ownerId: string | null) => void
  /** Persisted so the Dashboard reopens on the last-used lens. */
  view: DashboardView
  setView: (view: DashboardView) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      selectedOwnerId: null,
      setSelectedOwnerId: (ownerId) => set({ selectedOwnerId: ownerId }),
      view: 'spending',
      setView: (view) => set({ view }),
    }),
    {
      name: 'dashboard-view',
    },
  ),
)
