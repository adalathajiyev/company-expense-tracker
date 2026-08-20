import { CalendarDays, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { canDeleteOwnedRecord, hasFullAccess, type AppRole } from '../access/types'
import type { Customer } from '../customers/types'
import { createEmptySale, paymentMethods, units } from './constants'
import { createSale, getSalesWorkspace, removeSale, updateSaleCustomer } from './salesService'
import type { Sale, SaleInput, SalePaymentMethod, SaleStatus } from './types'
import { getBusinessMonth } from '../../lib/businessDate'
import { roundMoney, sumMoney } from '../../lib/money'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const statusLabels: Record<SaleStatus, string> = { paid: 'Paid', partially_paid: 'Partially paid', unpaid: 'Unpaid' }
const bankTransferOnly = ['Bank transfer'] as const satisfies readonly SalePaymentMethod[]

interface Props { role: AppRole; currentUserId: string }

export function SalesModule({ role, currentUserId }: Props) {
  const currentMonth = getBusinessMonth()
  const isOfficeAccountant = role === 'office_accountant'
  const canReassignSales = hasFullAccess(role)
  const allowedPaymentMethods: readonly SalePaymentMethod[] = isOfficeAccountant ? bankTransferOnly : paymentMethods
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [form, setForm] = useState<SaleInput>(createEmptySale)
  const [saving, setSaving] = useState(false)
  const [reassigningId, setReassigningId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadWorkspace = useCallback(async () => {
    const workspace = await getSalesWorkspace()
    setCustomers(workspace.customers)
    setSales(workspace.sales)
  }, [])

  useEffect(() => {
    loadWorkspace()
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [loadWorkspace])

  const periods = useMemo(() => {
    const months = [...new Set(sales.map((sale) => sale.sale_date.slice(0, 7)).concat(currentMonth))].sort().reverse()
    return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() }
  }, [sales, currentMonth])

  const filtered = useMemo(() => {
    const periodValue = period.split(':')[1]
    const query = search.trim().toLowerCase()
    return sales.filter((sale) => sale.sale_date.startsWith(periodValue)
      && (!query || sale.product.toLowerCase().includes(query) || sale.customer_name.toLowerCase().includes(query)))
  }, [sales, search, period])

  const total = sumMoney(filtered.map((sale) => Number(sale.amount)))
  const paidTotal = sumMoney(filtered.map((sale) => Number(sale.paid_amount)))

  async function addSale(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const amount = roundMoney(form.quantity * form.unit_price)
    const input = { ...form, amount }

    if (!input.customer_id) {
      setSaving(false)
      setError('Select a customer before adding the sale.')
      return
    }
    if (isOfficeAccountant && input.payment_method !== 'Bank transfer') {
      setSaving(false)
      setError('Office accountants can only add bank transfer sales.')
      return
    }

    try {
      await createSale(input)
      setSaleModalOpen(false)
      setForm({ ...createEmptySale(), customer_id: customers[0]?.id ?? '', payment_method: allowedPaymentMethods[0] ?? 'Cash' })
      try { await loadWorkspace() }
      catch { setError('Sale was saved, but the latest sales list could not be refreshed. Reload the page to see it.') }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add the sale.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSale(sale: Sale) {
    if (Number(sale.paid_amount) > 0) {
      setError('A sale with allocated payments cannot be deleted. Delete or correct its customer payment first.')
      return
    }
    if (!window.confirm('Are you sure you want to delete this sale?')) return

    try {
      await removeSale(sale.id)
      setSales((current) => current.filter((item) => item.id !== sale.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the sale.')
    }
  }

  async function reassignSale(sale: Sale, customerId: string) {
    if (sale.customer_id === customerId) return
    setReassigningId(sale.id)
    setError('')
    try {
      await updateSaleCustomer(sale.id, customerId)
      await loadWorkspace()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not reassign the sale.')
    } finally {
      setReassigningId(null)
    }
  }

  function openSaleModal() {
    if (customers.length === 0) {
      setError('Add a customer from the Customers tab before recording the first sale.')
      return
    }
    const selectedCustomerId = customers.some((customer) => customer.id === form.customer_id) ? form.customer_id : customers[0].id
    setForm({ ...createEmptySale(), customer_id: selectedCustomerId, payment_method: allowedPaymentMethods[0] ?? 'Cash' })
    setSaleModalOpen(true)
  }

  return <>
    <header><div><p className="eyebrow">COMPANY SALES</p><h1>Sales</h1><p>Record sales and monitor payment status from customer allocations.</p></div><button className="button primary" onClick={openSaleModal}><Plus size={17} /> Add sale</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <section className="panel">
      <div className="panel-heading"><div><h3>All sales</h3><p>Manage receipts and allocations from the Customers tab</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or customers..." /></label><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap sales-table"><table><thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Quantity</th><th>Method</th><th>Status</th><th>Created by</th><th className="amount">Allocated</th><th className="amount">Total</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={10} className="empty">Loading sales…</td></tr> : filtered.length === 0 ? <tr><td colSpan={10} className="empty">No sales for this period.</td></tr> : filtered.map((sale) => {
        const ownedDelete = canDeleteOwnedRecord(role, currentUserId, sale.created_by)
        const canDelete = ownedDelete && Number(sale.paid_amount) === 0
        const canReassign = canReassignSales && sale.payment_allocations.every((allocation) => allocation.payment.allocations.length === 1)
        return <tr key={sale.id}>
          <td className="date-cell">{dateFormatter.format(new Date(`${sale.sale_date}T12:00:00`))}</td>
          <td>{canReassignSales ? <select className="table-select" title={canReassign ? 'Reassign sale and its single-sale payments' : 'This sale has a payment shared with another sale'} aria-label={`Customer for ${sale.product}`} disabled={reassigningId === sale.id || !canReassign} value={sale.customer_id} onChange={(event) => reassignSale(sale, event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select> : <strong className="customer-name">{sale.customer_name}</strong>}</td>
          <td><div className="merchant"><span className="merchant-icon blue">{sale.product[0]}</span><div><strong>{sale.product}</strong><span>{currency.format(Number(sale.unit_price))} per {sale.unit}</span></div></div></td>
          <td>{sale.quantity} {sale.unit}</td>
          <td><span className={`category ${sale.payment_method === 'Cash' ? 'green' : 'blue'}`}>{sale.payment_method}</span></td>
          <td><span className={`status ${sale.status === 'paid' ? 'paid' : 'pending'}`}><i />{statusLabels[sale.status]}</span></td>
          <td className="creator-cell">{sale.created_by_email}</td>
          <td className="amount">{currency.format(Number(sale.paid_amount))}</td>
          <td className="amount"><strong>{currency.format(Number(sale.amount))}</strong></td>
          <td><button className="icon-button delete" disabled={!canDelete} title={!ownedDelete ? 'Only the creator or an Admin can delete this sale' : Number(sale.paid_amount) > 0 ? 'Sales with allocated payments cannot be deleted' : 'Delete sale'} onClick={() => deleteSale(sale)}><Trash2 size={15} /></button></td>
        </tr>
      })}</tbody>{!loading && <tfoot><tr><td colSpan={7} className="total-label">Totals</td><td className="amount total-amount">{currency.format(paidTotal)}</td><td className="amount total-amount">{currency.format(total)}</td><td /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {sales.length} sales <span>Payment status updates from Customers</span></div>
    </section>

    {saleModalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSaleModalOpen(false)}><div className="modal"><div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add a sale</h3><p>Record a product or service sold</p></div></div><button type="button" className="icon-button" onClick={() => setSaleModalOpen(false)}><X size={19} /></button></div><form onSubmit={addSale}><div className="form-grid">
      <label className="wide">Customer<span>*</span><select autoFocus required value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}><option value="" disabled>Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      <label className="wide">Product sold<span>*</span><input required value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} placeholder="Product or service name" /></label>
      <label>Date<span>*</span><input type="date" required value={form.sale_date} onChange={(event) => setForm({ ...form, sale_date: event.target.value })} /></label><label>Unit price<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.unit_price || ''} onChange={(event) => setForm({ ...form, unit_price: Number(event.target.value) })} /></div></label>
      <label>Quantity<span>*</span><input type="number" min="0.001" step="0.001" required value={form.quantity || ''} onChange={(event) => setForm({ ...form, quantity: event.target.value === '' ? 0 : Number(event.target.value) })} /></label><label>Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      <label className="wide">Expected payment method<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value as SalePaymentMethod })}>{allowedPaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
      <div className="wide calculated-total"><span>Calculated total</span><strong>{currency.format(form.quantity * form.unit_price)}</strong><small>{form.quantity || 0} × {currency.format(form.unit_price || 0)}</small></div>
      </div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setSaleModalOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add sale'}</button></div></form></div></div>}
  </>
}
