import { create } from 'zustand'

interface TransactionFormState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useTransactionFormStore = create<TransactionFormState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
