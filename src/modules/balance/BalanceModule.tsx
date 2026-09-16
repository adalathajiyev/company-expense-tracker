import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Banknote, ClipboardCheck, HandCoins, History, Landmark, Plus, RefreshCw, Trash2, WalletCards, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBalanceAdjustmentModal } from './components/AddBalanceAdjustmentModal'
import { BalanceAdjustmentHistoryModal } from './components/BalanceAdjustmentHistoryModal'
import { RecordBalanceAdjustmentSettlementModal } from './components/RecordBalanceAdjustmentSettlementModal'
import { createBalanceAdjustment, createBalanceAdjustmentSettlement, getBalanceAdjustments, getCashBalance, removeBalanceAdjustment, removeBalanceAdjustmentSettlement } from './balanceService'
import type { BalanceAdjustment, BalanceAdjustmentInput, BalanceAdjustmentSettlementInput, CashBalance } from './types'
import { createCashReconciliation, getCashAccounts } from '../cash-accounts/cashAccountService'
import { AddCashReconciliationModal } from '../cash-accounts/components/AddCashReconciliationModal'
import type { CashAccount, CashReconciliationInput } from '../cash-accounts/types'
import { formatDate } from '../../lib/businessDate'
import { calculateNetPosition } from './balanceCalculations'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

export function BalanceModule() {
  const [summary, setSummary] = useState<CashBalance | null>(null)
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [settlementAdjustment, setSettlementAdjustment] = useState<BalanceAdjustment | null>(null)
  const [historyAdjustmentId, setHistoryAdjustmentId] = useState<string | null>(null)
  const [deletingSettlementId, setDeletingSettlementId] = useState<string | null>(null)
  const [reconciliationOpen, setReconciliationOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadBalance = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [balance, balanceAdjustments, accountBalances] = await Promise.all([getCashBalance(), getBalanceAdjustments(), getCashAccounts()])
      setSummary(balance)
      setAdjustments(balanceAdjustments)
      setCashAccounts(accountBalances)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the cash balance.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadBalance() }, [loadBalance])

  const adjustmentTotals = useMemo(() => adjustments.reduce((totals, item) => {
    totals[item.direction] += item.remaining_amount
    return totals
  }, { receivable: 0, payable: 0 }), [adjustments])
  const mainCashAccount = cashAccounts.find((account) => account.account_type === 'main') ?? null
  const historyAdjustment = adjustments.find((item) => item.id === historyAdjustmentId) ?? null
  const physicalCash = Number(summary?.balance ?? 0)
  const netPosition = calculateNetPosition(physicalCash, adjustmentTotals.receivable, adjustmentTotals.payable)

  async function addAdjustment(input: BalanceAdjustmentInput) {
    setSaving(true)
    setError('')
    try {
      await createBalanceAdjustment(input)
      setModalOpen(false)
      await loadBalance()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not add the payment.')
    } finally {
      setSaving(false)
    }
  }

  async function recordSettlement(input: BalanceAdjustmentSettlementInput) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createBalanceAdjustmentSettlement(input)
      setSettlementAdjustment(null)
      setNotice('Settlement recorded successfully.')
      await loadBalance()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not record the settlement.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSettlement(settlementId: string) {
    if (!window.confirm('Delete this settlement? The related physical cash balance will be reversed.')) return
    setDeletingSettlementId(settlementId)
    setError('')
    setNotice('')
    try {
      await removeBalanceAdjustmentSettlement(settlementId)
      setNotice('Settlement deleted successfully.')
      await loadBalance()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the settlement.')
    } finally {
      setDeletingSettlementId(null)
    }
  }

  async function deleteAdjustment(adjustment: BalanceAdjustment) {
    if (adjustment.settlements.length > 0) return
    if (!window.confirm(`Delete the ${currency.format(Number(adjustment.amount))} entry for ${adjustment.name}?`)) return
    setDeletingId(adjustment.id)
    setError('')
    try {
      await removeBalanceAdjustment(adjustment.id)
      setAdjustments((current) => current.filter((item) => item.id !== adjustment.id))
      await loadBalance()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the payment.')
    } finally {
      setDeletingId(null)
    }
  }

  async function reconcileMainCash(input: CashReconciliationInput) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createCashReconciliation(input)
      setReconciliationOpen(false)
      setNotice(`Main cash was reconciled for ${formatDate(input.reconciliation_date)}.`)
      await loadBalance()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not reconcile the main cash account.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <header>
      <div><p className="eyebrow">CASH POSITION</p><h1>Balance</h1><p>Your current cash balance across all company activity.</p></div>
      <button className="button secondary" disabled={loading} onClick={loadBalance}><RefreshCw size={16} /> Refresh</button>
    </header>

    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    {notice && <div className="error-banner success-banner">{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}

    <section className="balance-hero">
      <div>
        <span>Current physical cash</span>
        <strong>{loading ? 'Loading…' : currency.format(physicalCash)}</strong>
        <small>Cash physically held across your accounts, including cash issued or received when an obligation was created.</small>
      </div>
      <span className="balance-hero-icon"><WalletCards size={28} /></span>
    </section>

    <section className="balance-position-grid">
      <article><span>Outstanding receivables</span><strong className="receivable">+{currency.format(adjustmentTotals.receivable)}</strong><small>Money still expected by the company</small></article>
      <article><span>Outstanding payables</span><strong className="payable">−{currency.format(adjustmentTotals.payable)}</strong><small>Money the company still needs to pay</small></article>
      <article><span>Net financial position</span><strong>{currency.format(netPosition)}</strong><small>Physical cash + receivables − payables</small></article>
    </section>

    <section className="balance-breakdown">
      <article><span className="balance-item-icon incoming"><ArrowUpRight size={19} /></span><div><p>Cash sales received</p><strong>{currency.format(Number(summary?.cash_sales ?? 0))}</strong><small>Paid amount from cash sales</small></div></article>
      <span className="balance-operator">+</span>
      <article><span className="balance-item-icon funding"><Landmark size={19} /></span><div><p>Net owner funding</p><strong>{currency.format(Number(summary?.owner_funding ?? 0))}</strong><small>Incoming minus outgoing owner cash</small></div></article>
      <span className="balance-operator">−</span>
      <article><span className="balance-item-icon outgoing"><ArrowDownRight size={19} /></span><div><p>Cash expenses</p><strong>{currency.format(Number(summary?.cash_expenses ?? 0))}</strong><small>Expenses paid in cash</small></div></article>
      <span className="balance-operator">−</span>
      <article><span className="balance-item-icon debt"><HandCoins size={19} /></span><div><p>Remaining worker debts</p><strong>{currency.format(Number(summary?.remaining_debts ?? 0))}</strong><small>Initial debts minus repayments</small></div></article>
      <span className="balance-operator">−</span>
      <article><span className="balance-item-icon salary"><Banknote size={19} /></span><div><p>Unallocated salary cash</p><strong>{currency.format(Number(summary?.cash_salary_payments ?? 0))}</strong><small>Cash not yet posted as salary expenses</small></div></article>
    </section>

    <p className="balance-note">Cash salary payments reduce the balance immediately. Closing a month moves the allocated amount into Expenses while carried-forward credit remains here, so it is never counted twice.</p>

    <section className="panel balance-cash-accounts-panel">
      <div className="panel-heading"><div><h3>Cash allocation</h3><p>Where the company’s physical cash is currently held</p></div><button className="button secondary compact-button" disabled={loading || saving || !mainCashAccount} title={mainCashAccount ? 'Compare Main Cash with the physically counted amount' : 'The Main Cash account is not configured'} onClick={() => setReconciliationOpen(true)}><ClipboardCheck size={15} /> Reconcile main cash</button></div>
      <div className="cash-allocation-grid">{loading ? <span className="cash-allocation-empty">Loading cash accounts…</span> : cashAccounts.length === 0 ? <span className="cash-allocation-empty">No cash accounts are configured.</span> : cashAccounts.map((account) => <article key={account.id}><span><strong>{account.name}</strong><small>{account.custodian_email ?? 'No application custodian'}</small></span><b>{currency.format(Number(account.balance))}</b></article>)}</div>
      {!loading && cashAccounts.length > 0 && <div className="panel-footer">{cashAccounts.length} cash {cashAccounts.length === 1 ? 'account' : 'accounts'} <span>Total allocated: {currency.format(cashAccounts.reduce((sum, account) => sum + Number(account.balance), 0))}</span></div>}
    </section>

    <section className="panel balance-adjustments-panel">
      <div className="panel-heading">
        <div><h3>Receivables and payables</h3><p>Initial amounts move Main Cash; settlements record money returned or repaid</p></div>
        <button className="button primary compact-button" onClick={() => setModalOpen(true)}><Plus size={15} /> Add obligation</button>
      </div>
      <div className="table-wrap balance-adjustments-table">
        <table>
          <thead><tr><th>Direction</th><th>Name</th><th>Description</th><th>Status</th><th className="amount">Settled / total</th><th className="amount">Remaining</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="empty">Loading obligations…</td></tr> : adjustments.length === 0 ? <tr><td colSpan={7} className="empty">No receivables or payables have been added.</td></tr> : adjustments.map((item) => <tr key={item.id}>
              <td><span className={`balance-direction ${item.direction}`}>{item.direction === 'receivable' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{item.direction === 'receivable' ? 'To receive' : 'To pay'}</span></td>
              <td><strong className="balance-adjustment-name">{item.name}</strong></td>
              <td className="balance-adjustment-description">{item.description || 'No description'}</td>
              <td><span className={`balance-adjustment-status ${item.status}`}>{item.status === 'partially_paid' ? 'Partially settled' : item.status === 'settled' ? 'Settled' : 'Outstanding'}</span></td>
              <td className="amount"><strong>{currency.format(item.settled_amount)}</strong><small className="balance-total-amount"> / {currency.format(item.amount)}</small></td>
              <td className={`amount balance-adjustment-amount ${item.direction}`}><strong>{currency.format(item.remaining_amount)}</strong></td>
              <td><div className="row-actions">
                <button className="icon-button payment" disabled={item.remaining_amount <= 0} title={item.remaining_amount > 0 ? `Record ${item.direction === 'receivable' ? 'receipt' : 'payment'}` : 'Fully settled'} aria-label={`Record settlement for ${item.name}`} onClick={() => setSettlementAdjustment(item)}><Banknote size={15} /></button>
                <button className="icon-button" title="View settlement history" aria-label={`View settlement history for ${item.name}`} onClick={() => setHistoryAdjustmentId(item.id)}><History size={15} /></button>
                <button className="icon-button delete" disabled={deletingId === item.id || item.settlements.length > 0} title={item.settlements.length > 0 ? 'Delete settlements before deleting this obligation' : 'Delete obligation'} aria-label={`Delete obligation for ${item.name}`} onClick={() => deleteAdjustment(item)}><Trash2 size={15} /></button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!loading && <div className="balance-adjustment-summary">
        <span><small>To receive</small><strong className="receivable">+{currency.format(adjustmentTotals.receivable)}</strong></span>
        <span><small>To pay</small><strong className="payable">−{currency.format(adjustmentTotals.payable)}</strong></span>
        <span><small>Net position effect</small><strong>{currency.format(adjustmentTotals.receivable - adjustmentTotals.payable)}</strong></span>
      </div>}
    </section>

    {modalOpen && <AddBalanceAdjustmentModal saving={saving} onClose={() => setModalOpen(false)} onSubmit={addAdjustment} />}
    {settlementAdjustment && <RecordBalanceAdjustmentSettlementModal adjustment={settlementAdjustment} cashAccounts={cashAccounts} saving={saving} onClose={() => setSettlementAdjustment(null)} onSubmit={recordSettlement} />}
    {historyAdjustment && <BalanceAdjustmentHistoryModal adjustment={historyAdjustment} cashAccounts={cashAccounts} deletingId={deletingSettlementId} onClose={() => setHistoryAdjustmentId(null)} onDelete={deleteSettlement} />}
    {reconciliationOpen && mainCashAccount && <AddCashReconciliationModal account={mainCashAccount} saving={saving} onClose={() => setReconciliationOpen(false)} onSubmit={reconcileMainCash} />}
  </>
}
