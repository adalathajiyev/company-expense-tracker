import { ArrowLeft, ArrowRightLeft, Banknote, CalendarDays, History, Search, SlidersHorizontal, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate, getBusinessMonth } from '../../../lib/businessDate'
import { sumMoney } from '../../../lib/money'
import { canDeleteOwnedRecord, type AppRole } from '../../access/types'
import type { Sale } from '../../sales/types'
import { customerPaymentMethods } from '../constants'
import { getPaymentAllocationStatus, getRemainingSaleAmount, type PaymentAllocationStatus } from '../paymentAllocationCalculations'
import type { Customer, CustomerPayment, CustomerPaymentMethod } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const allocationStatusLabels: Record<PaymentAllocationStatus, string> = {
  fully_allocated: 'Fully allocated',
  partially_allocated: 'Partially allocated',
  unallocated: 'Unallocated',
}

type AllocationStatusFilter = 'All allocation statuses' | PaymentAllocationStatus

interface Props {
  customers: Customer[]
  payments: CustomerPayment[]
  sales: Sale[]
  loading: boolean
  role: AppRole
  currentUserId: string
  canAllocate: (payment: CustomerPayment) => boolean
  onBack: () => void
  onViewHistory: (customer: Customer) => void
  onAllocate: (payment: CustomerPayment) => void
  onDelete: (payment: CustomerPayment) => Promise<void>
}

export function CustomerPaymentsReport({ customers, payments, sales, loading, role, currentUserId, canAllocate, onBack, onViewHistory, onAllocate, onDelete }: Props) {
  const currentMonth = getBusinessMonth()
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [customerFilter, setCustomerFilter] = useState('All customers')
  const [methodFilter, setMethodFilter] = useState<'All payment methods' | CustomerPaymentMethod>('All payment methods')
  const [statusFilter, setStatusFilter] = useState<AllocationStatusFilter>('All allocation statuses')

  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers])
  const periods = useMemo(() => {
    const months = [...new Set(payments.map((payment) => payment.payment_date.slice(0, 7)).concat(currentMonth))].sort().reverse()
    return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() }
  }, [currentMonth, payments])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const periodValue = period.split(':')[1]

    return payments.filter((payment) => {
      const customer = customerById.get(payment.customer_id)
      const allocationStatus = getPaymentAllocationStatus(payment)
      const matchesPeriod = period === 'all' || payment.payment_date.startsWith(periodValue)
      const matchesCustomer = customerFilter === 'All customers' || payment.customer_id === customerFilter
      const matchesMethod = methodFilter === 'All payment methods' || payment.payment_method === methodFilter
      const matchesStatus = statusFilter === 'All allocation statuses' || allocationStatus === statusFilter
      const matchesSearch = !query || `${customer?.name ?? ''} ${customer?.phone ?? ''} ${payment.reference ?? ''} ${payment.note ?? ''} ${payment.created_by_email}`.toLowerCase().includes(query)
      return matchesPeriod && matchesCustomer && matchesMethod && matchesStatus && matchesSearch
    })
  }, [customerById, customerFilter, methodFilter, payments, period, search, statusFilter])

  const allocatedTotal = sumMoney(filtered.map((payment) => Number(payment.allocated_amount)))
  const unallocatedTotal = sumMoney(filtered.map((payment) => Number(payment.unallocated_amount)))
  const receivedTotal = sumMoney(filtered.map((payment) => Number(payment.amount)))

  function hasNewOpenSale(payment: CustomerPayment) {
    const allocatedSaleIds = new Set(payment.allocations.map((allocation) => allocation.sale_id))
    return sales.some((sale) => sale.customer_id === payment.customer_id && !allocatedSaleIds.has(sale.id) && getRemainingSaleAmount(sale) > 0)
  }

  return <section className="panel customer-payments-report">
    <div className="panel-heading">
      <div><button type="button" className="report-back" onClick={onBack}><ArrowLeft size={14} /> Customer accounts</button><h3>Customer payment report</h3><p>Every customer receipt, including allocated payments and unapplied credit</p></div>
      <label className="period-select"><CalendarDays size={15} /><select aria-label="Filter customer payments by date" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All dates</option><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label>
    </div>
    <div className="toolbar">
      <label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers, references, notes, or creators..." /></label>
      <label className="filter customer-payment-customer-filter"><Users size={16} /><select aria-label="Filter payments by customer" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option>All customers</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      <label className="filter payment-filter"><Banknote size={16} /><select aria-label="Filter customer payments by method" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value as 'All payment methods' | CustomerPaymentMethod)}><option>All payment methods</option>{customerPaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
      <label className="filter customer-payment-status-filter"><SlidersHorizontal size={16} /><select aria-label="Filter payments by allocation status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AllocationStatusFilter)}><option>All allocation statuses</option><option value="fully_allocated">Fully allocated</option><option value="partially_allocated">Partially allocated</option><option value="unallocated">Unallocated</option></select></label>
      <span className="results">{filtered.length} payments</span>
    </div>
    <div className="table-wrap customer-payments-report-table"><table>
      <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Reference</th><th>Note</th><th>Status</th><th>Created by</th><th className="amount">Allocated</th><th className="amount">Unallocated</th><th className="amount">Received</th><th /></tr></thead>
      <tbody>{loading ? <tr><td colSpan={11} className="empty">Loading customer payments…</td></tr> : filtered.length === 0 ? <tr><td colSpan={11} className="empty">No customer payments match these filters.</td></tr> : filtered.map((payment) => {
        const customer = customerById.get(payment.customer_id)
        const allocationStatus = getPaymentAllocationStatus(payment)
        const canDelete = canDeleteOwnedRecord(role, currentUserId, payment.created_by)
        const allocationAllowed = canAllocate(payment)
        const hasOpenSale = hasNewOpenSale(payment)
        const canAllocateCredit = Number(payment.unallocated_amount) > 0 && allocationAllowed && hasOpenSale
        const allocationTitle = !allocationAllowed ? 'You do not have permission to allocate this payment' : hasOpenSale ? 'Allocate this credit to open sales' : 'There are no new open sales for this credit'

        return <tr key={payment.id}>
          <td className="date-cell">{formatDate(payment.payment_date)}</td>
          <td><button type="button" className="customer-report-link" disabled={!customer} onClick={() => customer && onViewHistory(customer)}>{customer?.name ?? 'Unknown customer'}<span>{customer?.phone ?? ''}</span></button></td>
          <td>{payment.payment_method}</td>
          <td className="customer-payment-text" title={payment.reference ?? undefined}>{payment.reference || '—'}</td>
          <td className="customer-payment-text" title={payment.note ?? undefined}>{payment.note || '—'}</td>
          <td><span className={`payment-allocation-status ${allocationStatus.replace(/_/g, '-')}`}><i />{allocationStatusLabels[allocationStatus]}</span></td>
          <td className="creator-cell">{payment.created_by_email}</td>
          <td className="amount">{currency.format(Number(payment.allocated_amount))}<div className="paid-detail">{payment.allocations.length} {payment.allocations.length === 1 ? 'sale' : 'sales'}</div></td>
          <td className="amount"><strong className={Number(payment.unallocated_amount) > 0 ? 'unallocated-amount' : ''}>{currency.format(Number(payment.unallocated_amount))}</strong></td>
          <td className="amount"><strong>{currency.format(Number(payment.amount))}</strong></td>
          <td><div className="row-actions"><button type="button" className="icon-button" disabled={!customer} title="Customer payment history" onClick={() => customer && onViewHistory(customer)}><History size={15} /></button>{Number(payment.unallocated_amount) > 0 && <button type="button" className="icon-button payment" disabled={!canAllocateCredit} title={allocationTitle} onClick={() => onAllocate(payment)}><ArrowRightLeft size={15} /></button>}<button type="button" className="icon-button delete" disabled={!canDelete} title={canDelete ? 'Delete the entire receipt' : 'Only the creator or an Admin can delete this payment'} onClick={() => onDelete(payment)}><Trash2 size={15} /></button></div></td>
        </tr>
      })}</tbody>
      <tfoot><tr><td colSpan={7} className="total-label">Displayed payment totals</td><td className="amount total-amount">{currency.format(allocatedTotal)}</td><td className="amount total-amount unallocated-amount">{currency.format(unallocatedTotal)}</td><td className="amount total-amount">{currency.format(receivedTotal)}</td><td /></tr></tfoot>
    </table></div>
    <div className="panel-footer">Showing {filtered.length} of {payments.length} payments <span>Totals reflect the active filters</span></div>
  </section>
}
