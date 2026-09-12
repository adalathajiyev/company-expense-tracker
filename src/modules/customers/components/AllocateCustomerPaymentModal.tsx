import { ArrowRightLeft, WandSparkles, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { formatDate } from '../../../lib/businessDate'
import { roundMoney, sumMoney } from '../../../lib/money'
import type { Sale } from '../../sales/types'
import { buildAutomaticAllocations, getRemainingSaleAmount } from '../paymentAllocationCalculations'
import type { Customer, CustomerPayment, CustomerPaymentAllocationInput } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  customer: Customer
  payment: CustomerPayment
  sales: Sale[]
  saving: boolean
  onClose: () => void
  onSubmit: (paymentId: string, allocations: CustomerPaymentAllocationInput[]) => Promise<void>
}

export function AllocateCustomerPaymentModal({ customer, payment, sales, saving, onClose, onSubmit }: Props) {
  const allocatedSaleIds = useMemo(() => new Set(payment.allocations.map((allocation) => allocation.sale_id)), [payment.allocations])
  const openSales = useMemo(() => sales.filter((sale) => getRemainingSaleAmount(sale) > 0 && !allocatedSaleIds.has(sale.id)), [allocatedSaleIds, sales])
  const availableCredit = Number(payment.unallocated_amount)
  const [allocations, setAllocations] = useState<Record<string, string>>(() => buildAutomaticAllocations(openSales, availableCredit))

  const allocatedTotal = sumMoney(Object.values(allocations).map((value) => Number(value) || 0))
  const creditRemaining = roundMoney(availableCredit - allocatedTotal)
  const saleLimitExceeded = openSales.some((sale) => (Number(allocations[sale.id]) || 0) > getRemainingSaleAmount(sale) + 0.001)
  const invalidAllocation = allocatedTotal > availableCredit + 0.001 || saleLimitExceeded

  function applyOldestFirst() {
    setAllocations(buildAutomaticAllocations(openSales, availableCredit))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (allocatedTotal <= 0 || invalidAllocation) return
    return onSubmit(payment.id, openSales
      .map((sale) => ({ sale_id: sale.id, amount: Number(allocations[sale.id]) || 0 }))
      .filter((allocation) => allocation.amount > 0))
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal customer-payment-modal">
    <div className="modal-head"><div><span className="modal-icon"><ArrowRightLeft size={20} /></span><div><h3>Allocate existing credit</h3><p>{customer.name}</p></div></div><button type="button" className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}>
      <div className="payment-summary customer-credit-summary"><span>Payment received {formatDate(payment.payment_date)} · {payment.payment_method}</span><strong>{currency.format(availableCredit)} available</strong></div>

      <div className="allocation-heading">
        <div><strong>Apply credit to open sales</strong><span>The original payment amount and date will not change</span></div>
        <div><button type="button" className="button secondary compact-button" onClick={() => setAllocations({})}>Clear</button><button type="button" className="button secondary compact-button" onClick={applyOldestFirst}><WandSparkles size={14} /> Apply oldest first</button></div>
      </div>

      <div className="allocation-list">
        {openSales.length === 0 ? <div className="allocation-empty">There are no new open sales available for this payment.</div> : openSales.map((sale) => {
          const remaining = getRemainingSaleAmount(sale)
          return <label className="allocation-row" key={sale.id}>
            <span><strong>{sale.product}</strong><small>{formatDate(sale.sale_date)} · {currency.format(remaining)} remaining</small></span>
            <div className="money-input"><span>₼</span><input aria-label={`Allocation for ${sale.product}`} type="number" min="0" max={remaining} step="0.01" value={allocations[sale.id] ?? ''} onChange={(event) => setAllocations((current) => ({ ...current, [sale.id]: event.target.value }))} /></div>
          </label>
        })}
      </div>

      <div className={`allocation-summary${invalidAllocation ? ' invalid' : ''}`}>
        <span><small>Available credit</small><strong>{currency.format(availableCredit)}</strong></span>
        <span><small>Allocating now</small><strong>{currency.format(allocatedTotal)}</strong></span>
        <span><small>Credit remaining</small><strong>{currency.format(creditRemaining)}</strong></span>
      </div>
      {invalidAllocation && <p className="allocation-error">Allocations cannot exceed the available credit or an individual sale’s remaining balance.</p>}

      <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || openSales.length === 0 || allocatedTotal <= 0 || invalidAllocation}>{saving ? 'Allocating…' : 'Allocate credit'}</button></div>
    </form>
  </div></div>
}
