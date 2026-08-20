import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Banknote, HandCoins, Landmark, Plus, RefreshCw, Trash2, WalletCards, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBalanceAdjustmentModal } from './components/AddBalanceAdjustmentModal'
import { createBalanceAdjustment, getBalanceAdjustments, getCashBalance, removeBalanceAdjustment } from './balanceService'
import type { BalanceAdjustment, BalanceAdjustmentInput, CashBalance } from './types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

export function BalanceModule() {
  const [summary, setSummary] = useState<CashBalance | null>(null)
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')

  const loadBalance = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [balance, balanceAdjustments] = await Promise.all([getCashBalance(), getBalanceAdjustments()])
      setSummary(balance)
      setAdjustments(balanceAdjustments)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the cash balance.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadBalance() }, [loadBalance])

  const adjustmentTotals = useMemo(() => adjustments.reduce((totals, item) => {
    totals[item.direction] += Number(item.amount)
    return totals
  }, { receivable: 0, payable: 0 }), [adjustments])

  async function addAdjustment(input: BalanceAdjustmentInput) {
    setSaving(true)
    setError('')
    try {
      const created = await createBalanceAdjustment(input)
      setAdjustments((current) => [created, ...current])
      setModalOpen(false)
      try { setSummary(await getCashBalance()) }
      catch { setError('The entry was saved, but the cash balance could not be refreshed. Use Refresh to try again.') }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not add the payment.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAdjustment(adjustment: BalanceAdjustment) {
    if (!window.confirm(`Delete the ${currency.format(Number(adjustment.amount))} entry for ${adjustment.name}?`)) return
    setDeletingId(adjustment.id)
    setError('')
    try {
      await removeBalanceAdjustment(adjustment.id)
      setAdjustments((current) => current.filter((item) => item.id !== adjustment.id))
      setSummary(await getCashBalance())
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete the payment.')
    } finally {
      setDeletingId(null)
    }
  }

  return <>
    <header>
      <div><p className="eyebrow">CASH POSITION</p><h1>Balance</h1><p>Your current cash balance across all company activity.</p></div>
      <button className="button secondary" disabled={loading} onClick={loadBalance}><RefreshCw size={16} /> Refresh</button>
    </header>

    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <section className="balance-hero">
      <div>
        <span>Available cash balance</span>
        <strong>{loading ? 'Loading…' : currency.format(Number(summary?.balance ?? 0))}</strong>
        <small>Cash sales + net owner funding + payments to receive − cash expenses − worker debts − salary cash − payments to pay</small>
      </div>
      <span className="balance-hero-icon"><WalletCards size={28} /></span>
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

    <section className="panel balance-adjustments-panel">
      <div className="panel-heading">
        <div><h3>Other payments</h3><p>Track amounts owed to and by the company</p></div>
        <button className="button primary compact-button" onClick={() => setModalOpen(true)}><Plus size={15} /> Add payment</button>
      </div>
      <div className="table-wrap balance-adjustments-table">
        <table>
          <thead><tr><th>Direction</th><th>Name</th><th>Description</th><th className="amount">Amount</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="empty">Loading payments…</td></tr> : adjustments.length === 0 ? <tr><td colSpan={5} className="empty">No other payments have been added.</td></tr> : adjustments.map((item) => <tr key={item.id}>
              <td><span className={`balance-direction ${item.direction}`}>{item.direction === 'receivable' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{item.direction === 'receivable' ? 'To receive' : 'To pay'}</span></td>
              <td><strong className="balance-adjustment-name">{item.name}</strong></td>
              <td className="balance-adjustment-description">{item.description || 'No description'}</td>
              <td className={`amount balance-adjustment-amount ${item.direction}`}><strong>{item.direction === 'receivable' ? '+' : '−'}{currency.format(Number(item.amount))}</strong></td>
              <td><button className="icon-button delete" disabled={deletingId === item.id} title="Delete payment" aria-label={`Delete payment for ${item.name}`} onClick={() => deleteAdjustment(item)}><Trash2 size={15} /></button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!loading && <div className="balance-adjustment-summary">
        <span><small>To receive</small><strong className="receivable">+{currency.format(adjustmentTotals.receivable)}</strong></span>
        <span><small>To pay</small><strong className="payable">−{currency.format(adjustmentTotals.payable)}</strong></span>
        <span><small>Net balance effect</small><strong>{currency.format(adjustmentTotals.receivable - adjustmentTotals.payable)}</strong></span>
      </div>}
    </section>

    {modalOpen && <AddBalanceAdjustmentModal saving={saving} onClose={() => setModalOpen(false)} onSubmit={addAdjustment} />}
  </>
}
