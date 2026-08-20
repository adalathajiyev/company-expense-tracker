import { useMemo, useState, type FormEvent } from 'react'
import { Banknote, WandSparkles, X } from 'lucide-react'
import { customerPaymentMethods } from '../constants'
import type { Customer, CustomerPaymentInput, CustomerPaymentMethod } from '../types'
import type { Sale } from '../../sales/types'
import { getBusinessDate } from '../../../lib/businessDate'
import { roundMoney, sumMoney } from '../../../lib/money'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props {
  customer: Customer
  sales: Sale[]
  saving: boolean
  allowedPaymentMethods: readonly CustomerPaymentMethod[]
  onClose: () => void
  onSubmit: (payment: CustomerPaymentInput) => Promise<void>
}

function buildAutomaticAllocations(sales: Sale[], amount: number) {
  let available = Math.max(amount, 0)
  const allocations: Record<string, string> = {}
  const ordered = [...sales].sort((a, b) => a.sale_date.localeCompare(b.sale_date) || a.created_at.localeCompare(b.created_at))

  ordered.forEach((sale) => {
    if (available <= 0) return
    const remaining = Math.max(Number(sale.amount) - Number(sale.paid_amount), 0)
    const allocation = Math.min(remaining, available)
    if (allocation > 0) allocations[sale.id] = allocation.toFixed(2)
    available = roundMoney(available - allocation)
  })

  return allocations
}

export function AddPaymentModal({ customer, sales, saving, allowedPaymentMethods, onClose, onSubmit }: Props) {
  const today = getBusinessDate()
  const openSales = useMemo(() => sales.filter((sale) => Number(sale.paid_amount) < Number(sale.amount)), [sales])
  const [paymentDate, setPaymentDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>(allowedPaymentMethods[0] ?? 'Cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [autoAllocate, setAutoAllocate] = useState(true)

  const numericAmount = Number(amount) || 0
  const allocatedTotal = sumMoney(Object.values(allocations).map((value) => Number(value) || 0))
  const unallocated = roundMoney(numericAmount - allocatedTotal)
  const saleLimitExceeded = openSales.some((sale) => {
    const remaining = Math.max(Number(sale.amount) - Number(sale.paid_amount), 0)
    return (Number(allocations[sale.id]) || 0) > remaining + 0.001
  })
  const invalidAllocation = allocatedTotal > numericAmount + 0.001 || saleLimitExceeded

  function changeAmount(value: string) {
    setAmount(value)
    if (autoAllocate) setAllocations(buildAutomaticAllocations(openSales, Number(value) || 0))
  }

  function applyOldestFirst() {
    setAutoAllocate(true)
    setAllocations(buildAutomaticAllocations(openSales, numericAmount))
  }

  function leaveUnallocated() {
    setAutoAllocate(false)
    setAllocations({})
  }

  function changeAllocation(saleId: string, value: string) {
    setAutoAllocate(false)
    setAllocations((current) => ({ ...current, [saleId]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (numericAmount <= 0 || invalidAllocation) return

    await onSubmit({
      customer_id: customer.id,
      payment_date: paymentDate,
      amount: numericAmount,
      payment_method: paymentMethod,
      reference: reference.trim() || null,
      note: note.trim() || null,
      allocations: openSales
        .map((sale) => ({ sale_id: sale.id, amount: Number(allocations[sale.id]) || 0 }))
        .filter((allocation) => allocation.amount > 0),
    })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal customer-payment-modal">
    <div className="modal-head"><div><span className="modal-icon"><Banknote size={20} /></span><div><h3>Record customer payment</h3><p>{customer.name}</p></div></div><button type="button" className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}>
      <div className="form-grid">
        <label>Date<span>*</span><input type="date" max={today} required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
        <label>Amount<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => changeAmount(event.target.value)} /></div></label>
        <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as CustomerPaymentMethod)}>{customerPaymentMethods.filter((method) => allowedPaymentMethods.includes(method)).map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Receipt or transfer reference" /></label>
        <label className="wide">Note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional payment note" /></label>
      </div>

      <div className="allocation-heading">
        <div><strong>Allocate payment</strong><span>Apply the receipt to one or more open sales</span></div>
        <div><button type="button" className="button secondary compact-button" onClick={leaveUnallocated}>Leave unallocated</button><button type="button" className="button secondary compact-button" onClick={applyOldestFirst}><WandSparkles size={14} /> Apply oldest first</button></div>
      </div>

      <div className="allocation-list">
        {openSales.length === 0 ? <div className="allocation-empty">This customer has no open sales. The full payment will remain as unallocated credit.</div> : openSales.map((sale) => {
          const remaining = Math.max(Number(sale.amount) - Number(sale.paid_amount), 0)
          return <label className="allocation-row" key={sale.id}>
            <span><strong>{sale.product}</strong><small>{dateFormatter.format(new Date(`${sale.sale_date}T12:00:00`))} · {currency.format(remaining)} remaining</small></span>
            <div className="money-input"><span>₼</span><input aria-label={`Allocation for ${sale.product}`} type="number" min="0" max={remaining} step="0.01" value={allocations[sale.id] ?? ''} onChange={(event) => changeAllocation(sale.id, event.target.value)} /></div>
          </label>
        })}
      </div>

      <div className={`allocation-summary${invalidAllocation ? ' invalid' : ''}`}>
        <span><small>Payment</small><strong>{currency.format(numericAmount)}</strong></span>
        <span><small>Allocated</small><strong>{currency.format(allocatedTotal)}</strong></span>
        <span><small>Unallocated</small><strong>{currency.format(unallocated)}</strong></span>
      </div>
      {invalidAllocation && <p className="allocation-error">Allocations cannot exceed the payment or an individual sale’s remaining balance.</p>}

      <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || numericAmount <= 0 || invalidAllocation}>{saving ? 'Saving…' : 'Record payment'}</button></div>
    </form>
  </div></div>
}
