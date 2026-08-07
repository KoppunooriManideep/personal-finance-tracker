import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  createChitPayment,
  deleteChitPayment,
  updateChitPayment,
} from '@/features/chits/api/chit-payment-mutations'
import { chitPaymentsQueryKey } from '@/features/chits/hooks/use-chit-payments'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'

export interface SavePaymentValues {
  /** Present when editing an existing month; absent when recording a new one. */
  existingId?: string
  chitId: string
  monthNumber: number
  /** Net amount paid, in integer paise. */
  amountPaidPaise: number
  /** ISO date (YYYY-MM-DD) or null. */
  paymentDate: string | null
}

/** Create or update a single month's payment. */
export function useSaveChitPayment() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()

  return useMutation<void, Error, SavePaymentValues>({
    mutationFn: async (values) => {
      if (values.existingId) {
        await updateChitPayment({
          id: values.existingId,
          amountPaidPaise: values.amountPaidPaise,
          paymentDate: values.paymentDate,
        })
      } else {
        await createChitPayment({
          chitId: values.chitId,
          familyId: familyId!,
          monthNumber: values.monthNumber,
          amountPaidPaise: values.amountPaidPaise,
          paymentDate: values.paymentDate,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chitPaymentsQueryKey(familyId),
      })
    },
  })
}

/** Soft-delete (clear) a month's payment. */
export function useDeleteChitPayment() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteChitPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chitPaymentsQueryKey(familyId),
      })
    },
  })
}

export interface FillMonthsValues {
  chitId: string
  /** Month numbers to create a payment for (should be gaps only). */
  months: number[]
  amountPaidPaise: number
}

/** Bulk-create payments for a set of months (used by "fill remaining"). */
export function useFillChitMonths() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()

  return useMutation<void, Error, FillMonthsValues>({
    mutationFn: async (values) => {
      if (values.months.length === 0) return
      const rows = values.months.map((month) => ({
        id: crypto.randomUUID(),
        chit_id: values.chitId,
        family_id: familyId!,
        month_number: month,
        amount_paid: values.amountPaidPaise,
        payment_date: null,
      }))
      const { error } = await supabase.from('chit_payments').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chitPaymentsQueryKey(familyId),
      })
    },
  })
}
