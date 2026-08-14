import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * AI feature preferences. `insightsEnabled` is an explicit OPT-IN for the
 * Dashboard AI insights / Q&A, which send spending aggregates (amounts) to
 * Google Gemini. Off by default; persisted per device.
 */
interface AiState {
  insightsEnabled: boolean
  setInsightsEnabled: (enabled: boolean) => void
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      insightsEnabled: false,
      setInsightsEnabled: (enabled) => set({ insightsEnabled: enabled }),
    }),
    { name: 'ai-preferences' },
  ),
)
