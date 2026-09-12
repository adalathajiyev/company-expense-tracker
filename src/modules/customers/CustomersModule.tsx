import { Banknote, History, ReceiptText, Search, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { canDeleteOwnedRecord, type AppRole } from '../access/types'
import { getSalesWorkspace } from '../sales/salesService'
import type { Sale } from '../sales/types'
import { AddCustomerModal } from './components/AddCustomerModal'
import { AddPaymentModal } from './components/AddPaymentModal'
import { AllocateCustomerPaymentModal } from './components/AllocateCustomerPaymentModal'
import { CustomerPaymentsReport } from './components/CustomerPaymentsReport'
import { PaymentHistoryModal } from './components/PaymentHistoryModal'
import { customerPaymentMethods } from './constants'
import { allocateExistingCustomerPayment, createCustomer, createCustomerPayment, removeCustomerPayment } from './customerService'
import type {
  Customer,
  CustomerInput,
  CustomerPayment,
  CustomerPaymentAllocationInput,
  CustomerPaymentInput,
  CustomerPaymentMethod,
  CustomerSummary,
} from './types'
import { isFutureBusinessDate } from '../../lib/businessDate'
import { sumMoney } from '../../lib/money'
import { sortByEnteredDateDesc } from '../../lib/dateSort'
import { getRemainingSaleAmount } from './paymentAllocationCalculations'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const bankTransferOnly = ['Bank transfer'] as const satisfies readonly CustomerPaymentMethod[]

interface Props { role: AppRole; currentUserId: string }

export function CustomersModule({ role, currentUserId }: Props) {
  const isOfficeAccountant = role === 'office_accountant'
  const allowedPaymentMethods: readonly CustomerPaymentMethod[] = isOfficeAccountant ? bankTransferOnly : customerPaymentMethods
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [activeView, setActiveView] = useState<'accounts' | 'payments'>('accounts')
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [allocationPayment, setAllocationPayment] = useState<CustomerPayment | null>(null)
  const [returnToHistoryAfterAllocation, setReturnToHistoryAfterAllocation] = useState(false)
  const [error, setError] = useState('')

  const loadWorkspace = useCallback(async () => {
    const workspace = await getSalesWorkspace()
    setCustomers(workspace.customers)
    setPayments(sortByEnteredDateDesc(workspace.payments, (payment) => payment.payment_date, (payment) => payment.created_at))
    setSales(sortByEnteredDateDesc(workspace.sales, (sale) => sale.sale_date, (sale) => sale.created_at))
  }, [])

  useEffect(() => {
    loadWorkspace()
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [loadWorkspace])

  const summaries = useMemo<CustomerSummary[]>(() => {
    const salesByCustomer = new Map<string, Sale[]>()
    const paymentsByCustomer = new Map<string, CustomerPayment[]>()
    sales.forEach((sale) => {
      const customerSales = salesByCustomer.get(sale.customer_id) ?? []
      customerSales.push(sale)
      salesByCustomer.set(sale.customer_id, customerSales)
    })
    payments.forEach((payment) => {
      const customerPayments = paymentsByCustomer.get(payment.customer_id) ?? []
      customerPayments.push(payment)
      paymentsByCustomer.set(payment.customer_id, customerPayments)
    })

    return customers.map((customer) => {
      const customerSales = salesByCustomer.get(customer.id) ?? []
      const customerPayments = paymentsByCustomer.get(customer.id) ?? []
      const totalSales = sumMoney(customerSales.map((sale) => Number(sale.amount)))
      const totalReceived = sumMoney(customerPayments.map((payment) => Number(payment.amount)))
      const netBalance = sumMoney([totalSales, -totalReceived])

      return {
        customer,
        sales_count: customerSales.length,
        total_sales: totalSales,
        total_received: totalReceived,
        outstanding: Math.max(netBalance, 0),
        credit: Math.max(-netBalance, 0),
        unallocated: sumMoney(customerPayments.map((payment) => Number(payment.unallocated_amount))),
      }
    })
  }, [customers, payments, sales])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return summaries.filter((summary) => {
      if (!query) return true
      const customer = summary.customer
      return `${customer.name} ${customer.phone} ${customer.details ?? ''}`.toLowerCase().includes(query)
    })
  }, [search, summaries])

  async function refreshWorkspace() {
    await loadWorkspace()
  }

  async function refreshAfterSave(message: string) {
    try { await refreshWorkspace() }
    catch { setError(message) }
  }

  async function addCustomer(input: CustomerInput) {
    if (!input.name.trim() || !input.phone.trim()) {
      setError('Customer name and phone number are required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await createCustomer(input)
      setCustomerModalOpen(false)
      await refreshAfterSave('Customer was saved, but the latest customer list could not be refreshed. Reload the page to see it.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add the customer.')
    } finally {
      setSaving(false)
    }
  }

  async function addPayment(input: CustomerPaymentInput) {
    const customerSales = sales.filter((sale) => sale.customer_id === input.customer_id)
    const saleById = new Map(customerSales.map((sale) => [sale.id, sale]))
    const allocatedTotal = sumMoney(input.allocations.map((allocation) => Number(allocation.amount)))

    if (isFutureBusinessDate(input.payment_date)) {
      setError('Payment date cannot be in the future.')
      return
    }
    if (input.amount <= 0 || allocatedTotal > input.amount) {
      setError('Payment must be greater than zero and allocations cannot exceed it.')
      return
    }
    if (input.allocations.some((allocation) => {
      const sale = saleById.get(allocation.sale_id)
      return !sale || allocation.amount <= 0 || allocation.amount > Number(sale.amount) - Number(sale.paid_amount)
    })) {
      setError('One or more allocations exceed the remaining sale balance.')
      return
    }
    if (isOfficeAccountant && input.payment_method !== 'Bank transfer') {
      setError('Office accountants can only add bank transfer payments.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await createCustomerPayment(input)
      setPaymentCustomer(null)
      await refreshAfterSave('Payment was saved, but the latest balances could not be refreshed. Reload the page to see it.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add the payment.')
    } finally {
      setSaving(false)
    }
  }

  function canAllocatePayment(payment: CustomerPayment) {
    if (role === 'admin' || role === 'main_accountant') return true
    return role === 'office_accountant'
      && payment.created_by === currentUserId
      && payment.payment_method === 'Bank transfer'
  }

  async function allocatePayment(paymentId: string, allocations: CustomerPaymentAllocationInput[]) {
    const payment = payments.find((candidate) => candidate.id === paymentId)
    if (!payment || !canAllocatePayment(payment)) {
      setError('You do not have permission to allocate this customer payment.')
      return
    }

    const customerSales = sales.filter((sale) => sale.customer_id === payment.customer_id)
    const saleById = new Map(customerSales.map((sale) => [sale.id, sale]))
    const alreadyAllocatedSaleIds = new Set(payment.allocations.map((allocation) => allocation.sale_id))
    const allocatedTotal = sumMoney(allocations.map((allocation) => Number(allocation.amount)))

    if (allocations.length === 0 || allocatedTotal <= 0 || allocatedTotal > Number(payment.unallocated_amount) + 0.001) {
      setError('Allocations must be greater than zero and cannot exceed the available credit.')
      return
    }
    if (new Set(allocations.map((allocation) => allocation.sale_id)).size !== allocations.length || allocations.some((allocation) => {
      const sale = saleById.get(allocation.sale_id)
      return !sale
        || alreadyAllocatedSaleIds.has(allocation.sale_id)
        || allocation.amount <= 0
        || allocation.amount > getRemainingSaleAmount(sale) + 0.001
    })) {
      setError('One or more allocations are invalid or exceed the remaining sale balance.')
      return
    }

    const customer = customers.find((candidate) => candidate.id === payment.customer_id) ?? null
    const shouldReturnToHistory = returnToHistoryAfterAllocation
    setSaving(true)
    setError('')
    try {
      await allocateExistingCustomerPayment(paymentId, allocations)
      setAllocationPayment(null)
      try {
        await refreshWorkspace()
        if (shouldReturnToHistory) setHistoryCustomer(customer)
      } catch {
        setError('The credit was allocated, but the latest balances could not be refreshed. Reload the page to see it.')
      }
      setReturnToHistoryAfterAllocation(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not allocate the customer payment.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePayment(payment: CustomerPayment) {
    if (!canDeleteOwnedRecord(role, currentUserId, payment.created_by)) {
      setError('Only the creator or an Admin can delete this payment.')
      return
    }

    const allocationNote = payment.allocations.length > 1 ? ` It is allocated across ${payment.allocations.length} sales.` : ''
    if (!window.confirm(`Delete the entire ${currency.format(Number(payment.amount))} customer payment?${allocationNote}`)) return

    try {
      await removeCustomerPayment(payment.id)
      await refreshWorkspace()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the payment.')
    }
  }

  const allocationCustomer = allocationPayment
    ? customers.find((customer) => customer.id === allocationPayment.customer_id) ?? null
    : null

  return <>
    <header><div><p className="eyebrow">CUSTOMER RECEIVABLES</p><h1>Customers</h1><p>Manage customer accounts, outstanding balances, and incoming payments.</p></div>{activeView === 'accounts' && <div className="header-actions"><button className="button secondary customer-payment-report-button" onClick={() => setActiveView('payments')}><ReceiptText size={16} /> Payment report</button><button className="button primary" onClick={() => setCustomerModalOpen(true)}><UserPlus size={16} /> Add customer</button></div>}</header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    {activeView === 'accounts' ? <section className="panel">
      <div className="panel-heading"><div><h3>Customer accounts</h3><p>Lifetime sales, receipts, and unapplied customer payments</p></div><span className="panel-heading-icon"><Users size={17} /></span></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, phones, or details..." /></label><span className="results">{filtered.length} customers</span></div>
      <div className="table-wrap customer-accounts-table"><table><thead><tr><th>Customer</th><th>Phone</th><th>Details</th><th className="amount">Sales</th><th className="amount">Received</th><th className="amount">Outstanding</th><th className="amount">Unallocated</th><th>Payments</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="empty">Loading customer accounts…</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="empty">{customers.length === 0 ? 'No customers have been added.' : 'No customers match your search.'}</td></tr> : filtered.map((summary) => <tr key={summary.customer.id}>
        <td><div className="merchant"><span className="merchant-icon green">{summary.customer.name[0]}</span><div><strong>{summary.customer.name}</strong><span>{summary.sales_count} {summary.sales_count === 1 ? 'sale' : 'sales'}</span></div></div></td>
        <td>{summary.customer.phone}</td>
        <td className="customer-details-cell" title={summary.customer.details ?? undefined}>{summary.customer.details || '—'}</td>
        <td className="amount">{currency.format(summary.total_sales)}</td>
        <td className="amount">{currency.format(summary.total_received)}</td>
        <td className="amount"><strong className={summary.outstanding > 0 ? 'negative-amount' : ''}>{currency.format(summary.outstanding)}</strong>{summary.credit > 0 && <div className="paid-detail">{currency.format(summary.credit)} customer credit</div>}</td>
        <td className="amount"><strong>{currency.format(summary.unallocated)}</strong></td>
        <td><div className="row-actions"><button className="icon-button payment" title="Record customer payment" onClick={() => setPaymentCustomer(summary.customer)}><Banknote size={15} /></button><button className="icon-button" title="Customer payment history" onClick={() => setHistoryCustomer(summary.customer)}><History size={15} /></button></div></td>
      </tr>)}</tbody></table></div>
      <div className="panel-footer">Showing {filtered.length} of {customers.length} customers <span>Payments may be allocated across multiple sales</span></div>
    </section> : <CustomerPaymentsReport customers={customers} payments={payments} sales={sales} loading={loading} role={role} currentUserId={currentUserId} canAllocate={canAllocatePayment} onBack={() => setActiveView('accounts')} onViewHistory={setHistoryCustomer} onAllocate={(payment) => { setReturnToHistoryAfterAllocation(false); setAllocationPayment(payment) }} onDelete={deletePayment} />}

    {customerModalOpen && <AddCustomerModal saving={saving} onClose={() => setCustomerModalOpen(false)} onSubmit={addCustomer} />}
    {paymentCustomer && <AddPaymentModal customer={paymentCustomer} sales={sales.filter((sale) => sale.customer_id === paymentCustomer.id)} saving={saving} allowedPaymentMethods={allowedPaymentMethods} onClose={() => setPaymentCustomer(null)} onSubmit={addPayment} />}
    {historyCustomer && <PaymentHistoryModal customer={historyCustomer} payments={payments.filter((payment) => payment.customer_id === historyCustomer.id)} sales={sales.filter((sale) => sale.customer_id === historyCustomer.id)} currentUserId={currentUserId} role={role} canAllocate={canAllocatePayment} onAllocate={(payment) => { setHistoryCustomer(null); setReturnToHistoryAfterAllocation(true); setAllocationPayment(payment) }} onClose={() => setHistoryCustomer(null)} onDelete={deletePayment} />}
    {allocationPayment && allocationCustomer && <AllocateCustomerPaymentModal customer={allocationCustomer} payment={allocationPayment} sales={sales.filter((sale) => sale.customer_id === allocationPayment.customer_id)} saving={saving} onClose={() => { setReturnToHistoryAfterAllocation(false); setAllocationPayment(null) }} onSubmit={allocatePayment} />}
  </>
}
