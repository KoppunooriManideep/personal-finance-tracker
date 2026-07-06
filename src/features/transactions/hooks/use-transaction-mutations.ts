import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { rupeesToPaise } from '@/lib/money'
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '@/features/transactions/api/transaction-mutations'
import type { Transaction } from '@/features/transactions/api/transaction-queries'
import { transactionsQueryKey } from '@/features/transactions/hooks/use-transactions'
import { useCurrentFamily } from '@/features/family/hooks/use-current-family'
import type { TransactionFormValues } from '@/features/transactions/schema'
import { accountsQueryKey } from '@/features/accounts/hooks/use-accounts'
import type { AccountWithBalance } from '@/features/accounts/api/account-queries'

interface MutationContext {
  previousTransactions?: Transaction[]
  previousAccounts?: AccountWithBalance[]
}

function formToTransaction(
  values: TransactionFormValues,
  familyId: string,
  id = `optimistic-${crypto.randomUUID()}`,
): Transaction {
  const amount = rupeesToPaise(values.amount)
  const note = values.note?.trim() ? values.note.trim() : null

  if (values.type === 'transfer') {
    return {
      id,
      familyId,
      type: values.type,
      amount,
      occurredAt: localDateToUtcIso(values.occurredOn),
      note,
      accountId: null,
      categoryId: null,
      fromAccountId: values.fromAccountId!,
      toAccountId: values.toAccountId!,
      createdBy: null,
      creator: null,
    }
  }

  return {
    id,
    familyId,
    type: values.type,
    amount,
    occurredAt: localDateToUtcIso(values.occurredOn),
    note,
    accountId: values.accountId!,
    categoryId: values.categoryId!,
    fromAccountId: null,
    toAccountId: null,
    createdBy: null,
    creator: null,
  }
}

function sortByNewest(a: Transaction, b: Transaction) {
  return (
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() ||
    b.id.localeCompare(a.id)
  )
}

function localDateToUtcIso(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString()
}

function applyBalanceEffect(
  accounts: AccountWithBalance[] | undefined,
  transaction: Transaction,
  direction: 1 | -1,
) {
  if (!accounts) return accounts

  return accounts.map((account) => {
    let delta = 0

    if (transaction.type === 'income' && account.id === transaction.accountId) {
      delta += transaction.amount
    }
    if (transaction.type === 'expense' && account.id === transaction.accountId) {
      delta -= transaction.amount
    }
    if (
      transaction.type === 'transfer' &&
      account.id === transaction.fromAccountId
    ) {
      delta -= transaction.amount
    }
    if (
      transaction.type === 'transfer' &&
      account.id === transaction.toAccountId
    ) {
      delta += transaction.amount
    }

    return delta === 0
      ? account
      : { ...account, currentBalance: account.currentBalance + delta * direction }
  })
}

/** Create a transaction with optimistic list and account-balance updates. */
export function useCreateTransaction() {
  const { user } = useAuth()
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const txKey = transactionsQueryKey(familyId)
  const accountKey = accountsQueryKey(familyId)

  return useMutation<Transaction, Error, TransactionFormValues, MutationContext>({
    mutationFn: (values) => {
      const transaction = formToTransaction(values, familyId!)
      return createTransaction({
        familyId: familyId!,
        userId: user!.id,
        type: transaction.type,
        amountPaise: transaction.amount,
        occurredAt: transaction.occurredAt,
        note: transaction.note,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        fromAccountId: transaction.fromAccountId,
        toAccountId: transaction.toAccountId,
      })
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: txKey })
      await queryClient.cancelQueries({ queryKey: accountKey })

      const previousTransactions = queryClient.getQueryData<Transaction[]>(txKey)
      const previousAccounts =
        queryClient.getQueryData<AccountWithBalance[]>(accountKey)
      const optimistic = formToTransaction(values, familyId!)

      queryClient.setQueryData<Transaction[]>(txKey, (old) =>
        [optimistic, ...(old ?? [])].sort(sortByNewest),
      )
      queryClient.setQueryData<AccountWithBalance[]>(accountKey, (old) =>
        applyBalanceEffect(old, optimistic, 1),
      )

      return { previousTransactions, previousAccounts }
    },
    onError: (_error, _values, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(txKey, context.previousTransactions)
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(accountKey, context.previousAccounts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: txKey })
      queryClient.invalidateQueries({ queryKey: accountKey })
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] })
    },
  })
}

/** Update a transaction, reversing the previous cached effect optimistically. */
export function useUpdateTransaction() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const txKey = transactionsQueryKey(familyId)
  const accountKey = accountsQueryKey(familyId)

  return useMutation<
    void,
    Error,
    { id: string; previous: Transaction; values: TransactionFormValues },
    MutationContext
  >({
    mutationFn: ({ id, values }) => {
      const transaction = formToTransaction(values, familyId!, id)
      return updateTransaction({
        id,
        type: transaction.type,
        amountPaise: transaction.amount,
        occurredAt: transaction.occurredAt,
        note: transaction.note,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        fromAccountId: transaction.fromAccountId,
        toAccountId: transaction.toAccountId,
      })
    },
    onMutate: async ({ id, previous, values }) => {
      await queryClient.cancelQueries({ queryKey: txKey })
      await queryClient.cancelQueries({ queryKey: accountKey })

      const previousTransactions = queryClient.getQueryData<Transaction[]>(txKey)
      const previousAccounts =
        queryClient.getQueryData<AccountWithBalance[]>(accountKey)
      const next = formToTransaction(values, familyId!, id)

      queryClient.setQueryData<Transaction[]>(txKey, (old) =>
        (old ?? [])
          .map((transaction) => (transaction.id === id ? next : transaction))
          .sort(sortByNewest),
      )
      queryClient.setQueryData<AccountWithBalance[]>(accountKey, (old) =>
        applyBalanceEffect(applyBalanceEffect(old, previous, -1), next, 1),
      )

      return { previousTransactions, previousAccounts }
    },
    onError: (_error, _values, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(txKey, context.previousTransactions)
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(accountKey, context.previousAccounts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: txKey })
      queryClient.invalidateQueries({ queryKey: accountKey })
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] })
    },
  })
}

/** Soft-delete a transaction and reverse its cached account-balance effect. */
export function useDeleteTransaction() {
  const { data: family } = useCurrentFamily()
  const familyId = family?.id
  const queryClient = useQueryClient()
  const txKey = transactionsQueryKey(familyId)
  const accountKey = accountsQueryKey(familyId)

  return useMutation<void, Error, Transaction, MutationContext>({
    mutationFn: (transaction) => deleteTransaction(transaction.id),
    onMutate: async (transaction) => {
      await queryClient.cancelQueries({ queryKey: txKey })
      await queryClient.cancelQueries({ queryKey: accountKey })

      const previousTransactions = queryClient.getQueryData<Transaction[]>(txKey)
      const previousAccounts =
        queryClient.getQueryData<AccountWithBalance[]>(accountKey)

      queryClient.setQueryData<Transaction[]>(txKey, (old) =>
        (old ?? []).filter((item) => item.id !== transaction.id),
      )
      queryClient.setQueryData<AccountWithBalance[]>(accountKey, (old) =>
        applyBalanceEffect(old, transaction, -1),
      )

      return { previousTransactions, previousAccounts }
    },
    onError: (_error, _transaction, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(txKey, context.previousTransactions)
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(accountKey, context.previousAccounts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: txKey })
      queryClient.invalidateQueries({ queryKey: accountKey })
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] })
    },
  })
}
