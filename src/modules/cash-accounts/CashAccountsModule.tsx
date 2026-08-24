import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, ClipboardCheck, Plus, RefreshCw, WalletCards, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDate } from '../../lib/businessDate'
import type { AppRole } from '../access/types'
import { hasFullAccess } from '../access/types'
import { AddCashAccountModal } from './components/AddCashAccountModal'
import { AddCashReconciliationModal } from './components/AddCashReconciliationModal'
import { AddCashTransferModal } from './components/AddCashTransferModal'
import { createCashAccount, createCashReconciliation, createCashTransfer, getCashAccounts, getCashAccountUsers, getCashLedger, getCashReconciliations } from './cashAccountService'
import type { CashAccount, CashAccountInput, CashAccountUser, CashLedgerEntry, CashReconciliation, CashReconciliationInput, CashTransferInput } from './types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const accountTypeLabels = { main: 'Main cash', project: 'Project cash', employee_float: 'Employee float' } as const

interface Props { role: AppRole }

export function CashAccountsModule({ role }: Props) {
  const privileged = hasFullAccess(role)
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [entries, setEntries] = useState<CashLedgerEntry[]>([])
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>([])
  const [users, setUsers] = useState<CashAccountUser[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [reconciliationAccount, setReconciliationAccount] = useState<CashAccount | null>(null)
  const [error, setError] = useState('')

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextAccounts, nextEntries, nextReconciliations, nextUsers] = await Promise.all([
        getCashAccounts(),
        getCashLedger(),
        getCashReconciliations(),
        privileged ? getCashAccountUsers() : Promise.resolve([]),
      ])
      setAccounts(nextAccounts)
      setEntries(nextEntries)
      setReconciliations(nextReconciliations)
      setUsers(nextUsers)
      setSelectedAccountId((current) => nextAccounts.some((account) => account.id === current) ? current : nextAccounts[0]?.id ?? '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load cash accounts.')
    } finally {
      setLoading(false)
    }
  }, [privileged])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  const visibleTotal = useMemo(() => accounts.reduce((sum, account) => sum + Number(account.balance), 0), [accounts])
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null
  const selectedEntries = entries.filter((entry) => entry.account_id === selectedAccountId)
  const selectedReconciliations = reconciliations.filter((item) => item.account_id === selectedAccountId)

  async function save(action: () => Promise<void>, success: () => void) {
    setSaving(true)
    setError('')
    try {
      await action()
      success()
      await loadWorkspace()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the cash account change.')
    } finally {
      setSaving(false)
    }
  }

  function addAccount(input: CashAccountInput) {
    return save(async () => { await createCashAccount(input) }, () => setAccountModalOpen(false))
  }

  function addTransfer(input: CashTransferInput) {
    return save(async () => { await createCashTransfer(input) }, () => setTransferModalOpen(false))
  }

  function addReconciliation(input: CashReconciliationInput) {
    return save(async () => { await createCashReconciliation(input) }, () => setReconciliationAccount(null))
  }

  return <>
    <header><div><p className="eyebrow">CASH CUSTODY</p><h1>Cash accounts</h1><p>Track cash held by the accountant, procurement, and every project lead.</p></div><div className="header-actions"><button className="button secondary" disabled={loading} onClick={() => void loadWorkspace()}><RefreshCw size={16} /> Refresh</button>{privileged && <button className="button secondary" disabled={accounts.filter((account) => account.is_active).length < 2} onClick={() => setTransferModalOpen(true)}><ArrowRightLeft size={16} /> Transfer</button>}{privileged && <button className="button primary" onClick={() => setAccountModalOpen(true)}><Plus size={16} /> Add account</button>}</div></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <section className="cash-account-summary">
      <div><span>{privileged ? 'Total company cash across accounts' : 'Cash assigned to your accounts'}</span><strong>{loading ? 'Loading…' : currency.format(visibleTotal)}</strong><small>Internal transfers do not change this total</small></div><span className="balance-hero-icon"><WalletCards size={27} /></span>
    </section>

    <section className="cash-account-grid">
      {loading ? <div className="cash-account-empty">Loading accounts…</div> : accounts.length === 0 ? <div className="cash-account-empty">No cash account is assigned to you.</div> : accounts.map((account) => <button key={account.id} className={`cash-account-card ${selectedAccountId === account.id ? 'selected' : ''}`} onClick={() => setSelectedAccountId(account.id)}>
        <span><small>{accountTypeLabels[account.account_type]}</small><i className={account.is_active ? 'active' : ''}>{account.is_active ? 'Active' : 'Inactive'}</i></span>
        <strong>{account.name}</strong>
        <b>{currency.format(Number(account.balance))}</b>
        <small>{account.custodian_email ?? 'No application custodian'}{account.last_activity_date ? ` · Last activity ${formatDate(account.last_activity_date)}` : ''}</small>
      </button>)}
    </section>

    {selectedAccount && <section className="panel cash-ledger-panel">
      <div className="panel-heading"><div><h3>{selectedAccount.name} ledger</h3><p>{selectedAccount.description || 'All cash movements assigned to this account'}</p></div><button className="button secondary compact-button" onClick={() => setReconciliationAccount(selectedAccount)}><ClipboardCheck size={15} /> Reconcile</button></div>
      <div className="table-wrap cash-ledger-table"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Recorded by</th><th className="amount">Movement</th><th className="amount">Direction</th></tr></thead><tbody>
        {selectedEntries.length === 0 ? <tr><td colSpan={6} className="empty">No cash movements for this account.</td></tr> : selectedEntries.map((entry) => <tr key={entry.entry_key}><td className="date-cell">{formatDate(entry.transaction_date)}</td><td><span className={`category ${entry.kind === 'transfer' ? 'blue' : entry.direction === 'inflow' ? 'green' : 'orange'}`}>{entry.kind.replace(/_/g, ' ')}</span></td><td className="cash-ledger-description">{entry.description}</td><td className="creator-cell">{entry.created_by_email ?? 'System record'}</td><td className={`amount cash-entry-${entry.direction}`}><strong>{entry.direction === 'inflow' ? '+' : '−'}{currency.format(Number(entry.amount))}</strong></td><td className="amount">{entry.direction === 'inflow' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</td></tr>)}
      </tbody></table></div>
      <div className="panel-footer">{selectedEntries.length} ledger {selectedEntries.length === 1 ? 'entry' : 'entries'} <span>Current balance: {currency.format(Number(selectedAccount.balance))}</span></div>
    </section>}

    {selectedAccount && <section className="panel cash-reconciliation-panel"><div className="panel-heading"><div><h3>Reconciliation history</h3><p>Expected ledger balance compared with physically counted cash</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Recorded by</th><th>Notes</th><th className="amount">Expected</th><th className="amount">Counted</th><th className="amount">Difference</th></tr></thead><tbody>{selectedReconciliations.length === 0 ? <tr><td colSpan={6} className="empty">This account has not been reconciled yet.</td></tr> : selectedReconciliations.map((item) => <tr key={item.id}><td className="date-cell">{formatDate(item.reconciliation_date)}</td><td className="creator-cell">{item.created_by_email}</td><td>{item.notes || 'No notes'}</td><td className="amount">{currency.format(Number(item.expected_balance))}</td><td className="amount">{currency.format(Number(item.counted_balance))}</td><td className={`amount ${Number(item.variance) === 0 ? 'cash-balanced' : 'negative-amount'}`}><strong>{Number(item.variance) > 0 ? '+' : ''}{currency.format(Number(item.variance))}</strong></td></tr>)}</tbody></table></div></section>}

    {accountModalOpen && <AddCashAccountModal users={users} saving={saving} onClose={() => setAccountModalOpen(false)} onSubmit={addAccount} />}
    {transferModalOpen && <AddCashTransferModal accounts={accounts} saving={saving} onClose={() => setTransferModalOpen(false)} onSubmit={addTransfer} />}
    {reconciliationAccount && <AddCashReconciliationModal account={reconciliationAccount} saving={saving} onClose={() => setReconciliationAccount(null)} onSubmit={addReconciliation} />}
  </>
}
