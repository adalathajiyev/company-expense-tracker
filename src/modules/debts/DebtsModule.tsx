import { Banknote, CalendarDays, History, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AddDebtPaymentModal } from './components/AddDebtPaymentModal'
import { DebtPaymentHistoryModal } from './components/DebtPaymentHistoryModal'
import { createEmptyDebt } from './constants'
import { createDebt, createDebtPayment, getDebts, removeDebt, removeDebtPayment } from './debtService'
import type { Debt, DebtInput, DebtPaymentInput, DebtStatus } from './types'
import { formatDate, getBusinessMonth, isFutureBusinessDate } from '../../lib/businessDate'
import { sumMoney } from '../../lib/money'
import { DateInput } from '../../components/DateInput'
import { sortByEnteredDateDesc } from '../../lib/dateSort'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const statusLabels: Record<DebtStatus, string> = { paid: 'Paid', partially_paid: 'Partially paid', unpaid: 'Unpaid' }

export function DebtsModule() {
  const currentMonth = getBusinessMonth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('all')
  const [debtVisibility, setDebtVisibility] = useState<'outstanding' | 'all'>('outstanding')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<DebtInput>(createEmptyDebt)
  const [saving, setSaving] = useState(false)
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null)
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { getDebts().then((rows) => setDebts(sortByEnteredDateDesc(rows, (debt) => debt.debt_date, (debt) => debt.created_at))).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])
  const periods = useMemo(() => { const months = [...new Set(debts.map((debt) => debt.debt_date.slice(0, 7)).concat(currentMonth))].sort().reverse(); return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() } }, [debts, currentMonth])
  const filtered = useMemo(() => debts.filter((debt) => {
    const matchesPeriod = period === 'all' || debt.debt_date.startsWith(period.split(':')[1])
    const matchesVisibility = debtVisibility === 'all' || debt.status !== 'paid'
    const matchesSearch = `${debt.worker_name} ${debt.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesPeriod && matchesVisibility && matchesSearch
  }), [debts, search, period, debtVisibility])
  const total = sumMoney(filtered.map((debt) => Number(debt.amount)))
  const paidTotal = sumMoney(filtered.map((debt) => Number(debt.paid_amount)))
  const remainingTotal = sumMoney([total, -paidTotal])

  async function addDebt(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { const debt = await createDebt(form); setDebts((current) => sortByEnteredDateDesc([...current, debt], (item) => item.debt_date, (item) => item.created_at)); setModalOpen(false); setForm(createEmptyDebt()) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add the debt.') }
    finally { setSaving(false) }
  }

  async function addPayment(input: DebtPaymentInput) {
    if (!paymentDebt) return
    const remaining = Number(paymentDebt.amount) - Number(paymentDebt.paid_amount)
    if (isFutureBusinessDate(input.payment_date)) { setError('Payment date cannot be in the future.'); return }
    if (input.amount <= 0 || input.amount > remaining) { setError('Payment must be greater than zero and cannot exceed the remaining debt.'); return }
    setSaving(true); setError('')
    try {
      await createDebtPayment(input)
      setPaymentDebt(null)
      try { const rows = await getDebts(); setDebts(sortByEnteredDateDesc(rows, (debt) => debt.debt_date, (debt) => debt.created_at)) }
      catch { setError('Payment was saved, but the latest debt balances could not be refreshed. Reload the page to see it.') }
    }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add the debt payment.') }
    finally { setSaving(false) }
  }

  async function deletePayment(paymentId: string) {
    if (!window.confirm('Are you sure you want to delete this debt payment?')) return
    try { await removeDebtPayment(paymentId); const updated = sortByEnteredDateDesc(await getDebts(), (debt) => debt.debt_date, (debt) => debt.created_at); setDebts(updated); setHistoryDebt((current) => current ? updated.find((debt) => debt.id === current.id) ?? null : null) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete the debt payment.') }
  }

  async function deleteDebt(id: string) {
    if (!window.confirm('Are you sure you want to delete this debt and all its payments?')) return
    try { await removeDebt(id); setDebts((current) => current.filter((debt) => debt.id !== id)) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete the debt.') }
  }

  return <>
    <header><div><p className="eyebrow">WORKER DEBTS</p><h1>Debts</h1><p>Track money workers owe to the company and their repayments.</p></div><button className="button primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add debt</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>Worker debts</h3><p>Track original debt, repayments, and remaining balances</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">All dates</option><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workers or descriptions..." /></label><label className="filter payment-filter"><SlidersHorizontal size={16} /><select aria-label="Filter debts by payment status" value={debtVisibility} onChange={(e) => setDebtVisibility(e.target.value as 'outstanding' | 'all')}><option value="outstanding">Outstanding only</option><option value="all">All debts</option></select></label><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Worker / description</th><th>Status</th><th className="amount">Repaid</th><th className="amount">Remaining</th><th className="amount">Initial debt</th><th>Payments</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="empty">Loading debts…</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="empty">No debts match your filters.</td></tr> : filtered.map((debt) => <tr key={debt.id}><td className="date-cell">{formatDate(debt.debt_date)}</td><td><div className="merchant"><span className="merchant-icon orange">{debt.worker_name[0]}</span><div><strong>{debt.worker_name}</strong><span>{debt.description || 'No description'}</span></div></div></td><td><span className={`status ${debt.status === 'paid' ? 'paid' : 'pending'}`}><i />{statusLabels[debt.status]}</span></td><td className="amount">{currency.format(Number(debt.paid_amount))}</td><td className="amount"><strong>{currency.format(Number(debt.amount) - Number(debt.paid_amount))}</strong></td><td className="amount">{currency.format(Number(debt.amount))}</td><td><div className="row-actions"><button className="icon-button payment" title="Add payment" disabled={debt.status === 'paid'} onClick={() => setPaymentDebt(debt)}><Banknote size={15} /></button><button className="icon-button" title="Payment history" onClick={() => setHistoryDebt(debt)}><History size={15} /></button></div></td><td><button className="icon-button delete" title="Delete debt" onClick={() => deleteDebt(debt.id)}><Trash2 size={15} /></button></td></tr>)}</tbody>{!loading && <tfoot><tr><td colSpan={3} className="total-label">Totals</td><td className="amount total-amount">{currency.format(paidTotal)}</td><td className="amount total-amount">{currency.format(remainingTotal)}</td><td className="amount total-amount">{currency.format(total)}</td><td colSpan={2} /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {debts.length} debts <span>Updated just now</span></div>
    </section>
    {modalOpen && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}><div className="modal"><div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add worker debt</h3><p>Record money owed to the company</p></div></div><button className="icon-button" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form onSubmit={addDebt}><div className="form-grid">
      <label className="wide">Worker name<span>*</span><input autoFocus required value={form.worker_name} onChange={(e) => setForm({ ...form, worker_name: e.target.value })} placeholder="Worker's full name" /></label>
      <label>Date<span>*</span><DateInput required value={form.debt_date} onChange={(value) => setForm({ ...form, debt_date: value })} /></label><label>Initial debt<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })} placeholder="1000.00" /></div></label>
      <label className="wide">Description<textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Reason or details for this debt" /></label>
      </div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add debt'}</button></div></form></div></div>}
    {paymentDebt && <AddDebtPaymentModal debt={paymentDebt} saving={saving} onClose={() => setPaymentDebt(null)} onSubmit={addPayment} />}
    {historyDebt && <DebtPaymentHistoryModal debt={historyDebt} onClose={() => setHistoryDebt(null)} onDelete={deletePayment} />}
  </>
}
