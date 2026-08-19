import { Banknote, CalendarDays, History, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { emptySale, units } from './constants'
import { createSale, createSalePayment, getSales, removeSale, removeSalePayment } from './salesService'
import type { Sale, SaleInput, SalePaymentInput, SaleStatus } from './types'
import { AddPaymentModal } from './components/AddPaymentModal'
import { PaymentHistoryModal } from './components/PaymentHistoryModal'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const statusLabels: Record<SaleStatus, string> = { paid: 'Paid', partially_paid: 'Partially paid', unpaid: 'Unpaid' }

export function SalesModule() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<SaleInput>(emptySale)
  const [saving, setSaving] = useState(false)
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null)
  const [historySale, setHistorySale] = useState<Sale | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { getSales().then(setSales).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])
  const periods = useMemo(() => { const months = [...new Set(sales.map((sale) => sale.sale_date.slice(0, 7)).concat(currentMonth))].sort().reverse(); return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() } }, [sales])
  const filtered = useMemo(() => sales.filter((sale) => sale.sale_date.startsWith(period.split(':')[1]) && sale.product.toLowerCase().includes(search.toLowerCase())), [sales, search, period])
  const total = filtered.reduce((sum, sale) => sum + Number(sale.amount), 0)
  const paidTotal = filtered.reduce((sum, sale) => sum + Number(sale.paid_amount), 0)

  async function addSale(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    const amount = Number((form.quantity * form.unit_price).toFixed(2))
    const input = { ...form, amount }
    try { const sale = await createSale(input); setSales((current) => [sale, ...current]); setModalOpen(false); setForm(emptySale) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add the sale.') }
    finally { setSaving(false) }
  }

  async function addPayment(input: SalePaymentInput) {
    if (!paymentSale) return
    const remaining = Number(paymentSale.amount) - Number(paymentSale.paid_amount)
    if (input.payment_date > new Date().toISOString().slice(0, 10)) { setError('Payment date cannot be in the future.'); return }
    if (input.amount <= 0 || input.amount > remaining) { setError('Payment must be greater than zero and cannot exceed the remaining amount.'); return }
    setSaving(true); setError('')
    try { await createSalePayment(input); setSales(await getSales()); setPaymentSale(null) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add the payment.') }
    finally { setSaving(false) }
  }

  async function deletePayment(paymentId: string) {
    if (!window.confirm('Are you sure you want to delete this payment?')) return
    try { await removeSalePayment(paymentId); const updated = await getSales(); setSales(updated); setHistorySale((current) => current ? updated.find((sale) => sale.id === current.id) ?? null : null) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete the payment.') }
  }

  async function deleteSale(id: string) {
    if (!window.confirm('Are you sure you want to delete this sale?')) return
    try { await removeSale(id); setSales((current) => current.filter((sale) => sale.id !== id)) } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete the sale.') }
  }

  return <>
    <header><div><p className="eyebrow">COMPANY SALES</p><h1>Sales</h1><p>Record products and services sold by the company.</p></div><button className="button primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add sale</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>All sales</h3><p>Track company sales and payment status</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(e) => setPeriod(e.target.value)}><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." /></label><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Status</th><th className="amount">Paid amount</th><th className="amount">Total amount</th><th>Payments</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="empty">Loading sales…</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="empty">No sales for this period.</td></tr> : filtered.map((sale) => <tr key={sale.id}><td className="date-cell">{dateFormatter.format(new Date(`${sale.sale_date}T12:00:00`))}</td><td><div className="merchant"><span className="merchant-icon blue">{sale.product[0]}</span><div><strong>{sale.product}</strong><span>{currency.format(Number(sale.unit_price))} per {sale.unit}</span></div></div></td><td>{sale.quantity} {sale.unit}</td><td><span className={`status ${sale.status === 'paid' ? 'paid' : 'pending'}`}><i />{statusLabels[sale.status]}</span></td><td className="amount">{currency.format(Number(sale.paid_amount))}</td><td className="amount"><strong>{currency.format(Number(sale.amount))}</strong></td><td><div className="row-actions"><button className="icon-button payment" title="Add payment" disabled={sale.status === 'paid'} onClick={() => setPaymentSale(sale)}><Banknote size={15} /></button><button className="icon-button" title="Payment history" onClick={() => setHistorySale(sale)}><History size={15} /></button></div></td><td><button className="icon-button delete" title="Delete sale" onClick={() => deleteSale(sale.id)}><Trash2 size={15} /></button></td></tr>)}</tbody>{!loading && <tfoot><tr><td colSpan={4} className="total-label">Totals</td><td className="amount total-amount">{currency.format(paidTotal)}</td><td className="amount total-amount">{currency.format(total)}</td><td colSpan={2} /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {sales.length} sales <span>Updated just now</span></div>
    </section>
    {modalOpen && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}><div className="modal"><div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add a sale</h3><p>Record a product or service sold</p></div></div><button className="icon-button" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form onSubmit={addSale}><div className="form-grid">
      <label className="wide">Product sold<span>*</span><input autoFocus required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Product or service name" /></label>
      <label>Date<span>*</span><input type="date" required value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></label><label>Unit price<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.unit_price || ''} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} /></div></label>
      <label>Quantity<span>*</span><input type="number" min="0.001" step="0.001" required value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: e.target.value === '' ? 0 : Number(e.target.value) })} /></label><label>Unit<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      <div className="wide calculated-total"><span>Calculated total</span><strong>{currency.format(form.quantity * form.unit_price)}</strong><small>{form.quantity || 0} × {currency.format(form.unit_price || 0)}</small></div>
      </div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add sale'}</button></div></form></div></div>}
    {paymentSale && <AddPaymentModal sale={paymentSale} saving={saving} onClose={() => setPaymentSale(null)} onSubmit={addPayment} />}
    {historySale && <PaymentHistoryModal sale={historySale} onClose={() => setHistorySale(null)} onDelete={deletePayment} />}
  </>
}
