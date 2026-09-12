import { Banknote, CalendarDays, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { canDeleteOwnedRecord, type AppRole } from '../access/types'
import type { Customer } from '../customers/types'
import { paymentMethods, saleCategories } from './constants'
import { createSale, getSalesWorkspace, removeSale, updateSale } from './salesService'
import type { Sale, SaleCategory, SaleInput, SalePaymentMethod, SaleStatus } from './types'
import { formatDate, getBusinessMonth } from '../../lib/businessDate'
import { sumMoney } from '../../lib/money'
import { sortByEnteredDateDesc } from '../../lib/dateSort'
import { calculateSaleAmount, isSaleTotalBelowAllocated } from './saleCalculations'
import { SaleModal } from './components/SaleModal'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const preciseCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN', minimumFractionDigits: 2, maximumFractionDigits: 6 })
const quantityFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const statusLabels: Record<SaleStatus, string> = { paid: 'Paid', partially_paid: 'Partially paid', unpaid: 'Unpaid' }
const bankTransferOnly = ['Bank transfer'] as const satisfies readonly SalePaymentMethod[]

interface Props { role: AppRole; currentUserId: string }

export function SalesModule({ role, currentUserId }: Props) {
  const currentMonth = getBusinessMonth()
  const isOfficeAccountant = role === 'office_accountant'
  const allowedPaymentMethods: readonly SalePaymentMethod[] = isOfficeAccountant ? bankTransferOnly : paymentMethods
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'All categories' | SaleCategory>('All categories')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'All payment methods' | SalePaymentMethod>('All payment methods')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [saleModal, setSaleModal] = useState<'new' | Sale | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadWorkspace = useCallback(async () => {
    const workspace = await getSalesWorkspace()
    setCustomers(workspace.customers)
    setSales(sortByEnteredDateDesc(workspace.sales, (sale) => sale.sale_date, (sale) => sale.created_at))
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
      && (categoryFilter === 'All categories' || sale.category === categoryFilter)
      && (paymentMethodFilter === 'All payment methods' || sale.payment_method === paymentMethodFilter)
      && (!query || `${sale.product} ${sale.customer_name} ${sale.category} ${sale.description ?? ''}`.toLowerCase().includes(query)))
  }, [sales, search, period, categoryFilter, paymentMethodFilter])

  const total = sumMoney(filtered.map((sale) => Number(sale.amount)))
  const paidTotal = sumMoney(filtered.map((sale) => Number(sale.paid_amount)))

  async function saveSale(input: SaleInput) {
    const editingSale = saleModal === 'new' ? null : saleModal
    const calculatedAmount = calculateSaleAmount(input.quantity, input.unit_price)
    setSaving(true)
    setError('')

    if (!input.customer_id || !input.product.trim()) {
      setSaving(false)
      setError('Customer and product are required.')
      return
    }
    if (!calculatedAmount) {
      setSaving(false)
      setError('Quantity and unit price must be greater than zero, use no more than 6 decimal places, and produce a total of at least ₼0.01.')
      return
    }
    if (editingSale && isSaleTotalBelowAllocated(calculatedAmount, Number(editingSale.paid_amount))) {
      setSaving(false)
      setError(`The sale total cannot be less than the ${currency.format(Number(editingSale.paid_amount))} already allocated.`)
      return
    }
    if (isOfficeAccountant && input.payment_method !== 'Bank transfer') {
      setSaving(false)
      setError('Office accountants can only use bank transfer sales.')
      return
    }

    try {
      if (editingSale) await updateSale(editingSale.id, input)
      else await createSale(input)
      setSaleModal(null)
      try { await loadWorkspace() }
      catch { setError('The sale was saved, but the latest sales list could not be refreshed. Reload the page to see it.') }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Could not ${editingSale ? 'update' : 'add'} the sale.`)
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

  function openSaleModal() {
    if (customers.length === 0) {
      setError('Add a customer from the Customers tab before recording the first sale.')
      return
    }
    setSaleModal('new')
  }

  return <>
    <header><div><p className="eyebrow">COMPANY SALES</p><h1>Sales</h1><p>Record sales and monitor payment status from customer allocations.</p></div><button className="button primary" onClick={openSaleModal}><Plus size={17} /> Add sale</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <section className="panel">
      <div className="panel-heading"><div><h3>All sales</h3><p>Manage receipts and allocations from the Customers tab</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, customers, descriptions, or categories..." /></label><label className="filter"><Tags size={16} /><select aria-label="Filter sales by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'All categories' | SaleCategory)}><option>All categories</option>{saleCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="filter payment-filter"><Banknote size={16} /><select aria-label="Filter sales by payment method" value={paymentMethodFilter} onChange={(event) => setPaymentMethodFilter(event.target.value as 'All payment methods' | SalePaymentMethod)}><option>All payment methods</option>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap sales-table"><table><thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Description</th><th>Category</th><th>Quantity</th><th>Method</th><th>Status</th><th>Created by</th><th className="amount">Allocated</th><th className="amount">Total</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={12} className="empty">Loading sales…</td></tr> : filtered.length === 0 ? <tr><td colSpan={12} className="empty">No sales for this period.</td></tr> : filtered.map((sale) => {
        const ownedDelete = canDeleteOwnedRecord(role, currentUserId, sale.created_by)
        const canDelete = ownedDelete && Number(sale.paid_amount) === 0
        const canEdit = role === 'admin' || role === 'main_accountant'
        return <tr key={sale.id}>
          <td className="date-cell">{formatDate(sale.sale_date)}</td>
          <td><strong className="customer-name">{sale.customer_name}</strong></td>
          <td><div className="merchant"><span className="merchant-icon blue">{sale.product[0]}</span><div><strong>{sale.product}</strong><span>{preciseCurrency.format(Number(sale.unit_price))} per {sale.unit}</span></div></div></td>
          <td className="sale-description" title={sale.description ?? undefined}>{sale.description || 'No description'}</td>
          <td><span className="category blue">{sale.category}</span></td>
          <td>{quantityFormatter.format(Number(sale.quantity))} {sale.unit}</td>
          <td><span className={`category ${sale.payment_method === 'Cash' ? 'green' : 'blue'}`}>{sale.payment_method}</span></td>
          <td><span className={`status ${sale.status === 'paid' ? 'paid' : 'pending'}`}><i />{statusLabels[sale.status]}</span></td>
          <td className="creator-cell">{sale.created_by_email}</td>
          <td className="amount">{currency.format(Number(sale.paid_amount))}</td>
          <td className="amount"><strong>{currency.format(Number(sale.amount))}</strong></td>
          <td><div className="row-actions"><button className="icon-button" disabled={!canEdit} title={canEdit ? 'Edit sale' : 'Only an Admin or Main Accountant can edit sales'} onClick={() => setSaleModal(sale)}><Pencil size={15} /></button><button className="icon-button delete" disabled={!canDelete} title={!ownedDelete ? 'Only the creator or an Admin can delete this sale' : Number(sale.paid_amount) > 0 ? 'Sales with allocated payments cannot be deleted' : 'Delete sale'} onClick={() => deleteSale(sale)}><Trash2 size={15} /></button></div></td>
        </tr>
      })}</tbody>{!loading && <tfoot><tr><td colSpan={9} className="total-label">Totals</td><td className="amount total-amount">{currency.format(paidTotal)}</td><td className="amount total-amount">{currency.format(total)}</td><td /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {sales.length} sales <span>Payment status updates from Customers</span></div>
    </section>

    {saleModal && <SaleModal sale={saleModal === 'new' ? null : saleModal} defaultCustomerId={customers[0]?.id ?? ''} customers={customers} allowedPaymentMethods={allowedPaymentMethods} saving={saving} onClose={() => setSaleModal(null)} onSubmit={saveSale} />}
  </>
}
