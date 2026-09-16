import type { CashAccount } from './types'

export function sortCashAccountsMainFirst(accounts: readonly CashAccount[]) {
  return [...accounts].sort((left, right) => {
    const leftRank = left.account_type === 'main' ? 0 : 1
    const rightRank = right.account_type === 'main' ? 0 : 1
    return leftRank - rightRank
  })
}

export function getDefaultTransferAccountIds(accounts: readonly CashAccount[]) {
  const activeAccounts = sortCashAccountsMainFirst(accounts.filter((account) => account.is_active))
  const source = activeAccounts.find((account) => account.account_type === 'main') ?? activeAccounts[0]
  const destination = activeAccounts.find((account) => account.id !== source?.id)

  return {
    fromAccountId: source?.id ?? '',
    toAccountId: destination?.id ?? '',
  }
}
