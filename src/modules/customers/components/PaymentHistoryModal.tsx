import { ArrowRightLeft, History, Trash2, X } from 'lucide-react'
import type { Customer, CustomerPayment } from '../types'
import type { Sale } from '../../sales/types'
import { canDeleteOwnedRecord, type AppRole } from '../../access/types'
import { sumMoney } from '../../../lib/money'
import { formatDate } from '../../../lib/businessDate'
import { getRemainingSaleAmount } from '../paymentAllocationCalculations'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  customer: Customer
  payments: CustomerPayment[]
  sales: Sale[]
  role: AppRole
  currentUserId: string
  onClose: () => void
  canAllocate: (payment: CustomerPayment) => boolean
  onAllocate: (payment: CustomerPayment) => void
  onDelete: (payment: CustomerPayment) => Promise<void>
}

export function PaymentHistoryModal({ customer, payments, sales, role, currentUserId, onClose, canAllocate, onAllocate, onDelete }: Props) {
  const saleById = new Map(sales.map((sale) => [sale.id, sale]))
  const totalReceived = sumMoney(payments.map((payment) => Number(payment.amount)))
  const totalUnallocated = sumMoney(payments.map((payment) => Number(payment.unallocated_amount)))

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal payment-history-modal customer-history-modal">
    <div className="modal-head"><div><span className="modal-icon"><History size={20} /></span><div><h3>Customer payment history</h3><p>{customer.name} · {customer.phone}</p></div></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <div className="payment-history-list">{payments.length === 0 ? <div className="payment-history-empty">No payments have been recorded for this customer.</div> : payments.map((payment) => {
      const canDelete = canDeleteOwnedRecord(role, currentUserId, payment.created_by)
      const allocatedSaleIds = new Set(payment.allocations.map((allocation) => allocation.sale_id))
      const hasNewOpenSale = sales.some((sale) => !allocatedSaleIds.has(sale.id) && getRemainingSaleAmount(sale) > 0)
      const allocationAllowed = canAllocate(payment)
      const canAllocateCredit = allocationAllowed && hasNewOpenSale && Number(payment.unallocated_amount) > 0
      const allocationTitle = !allocationAllowed
        ? 'You do not have permission to allocate this payment'
        : hasNewOpenSale
          ? 'Allocate this credit to open sales'
          : 'There are no new open sales for this credit'
      return <div className="customer-payment-history-item" key={payment.id}>
        <div className="customer-payment-history-head">
          <div><strong>{currency.format(Number(payment.amount))}</strong><span>{formatDate(payment.payment_date)} · {payment.payment_method}</span><small>Created by {payment.created_by_email}</small></div>
          <div className="customer-payment-history-actions">
            {Number(payment.unallocated_amount) > 0 && <button type="button" className="button secondary compact-button" disabled={!canAllocateCredit} title={allocationTitle} onClick={() => onAllocate(payment)}><ArrowRightLeft size={14} /> Allocate</button>}
            <button type="button" className="icon-button delete" disabled={!canDelete} title={canDelete ? 'Delete the entire receipt' : 'Only the creator or an Admin can delete this payment'} onClick={() => onDelete(payment)}><Trash2 size={15} /></button>
          </div>
        </div>
        {(payment.reference || payment.note) && <div className="customer-payment-meta">{payment.reference && <span>Reference: {payment.reference}</span>}{payment.note && <span>{payment.note}</span>}</div>}
        <div className="customer-payment-allocations">
          {payment.allocations.map((allocation) => {
            const sale = saleById.get(allocation.sale_id)
            return <span key={allocation.id}><span>{sale?.product ?? 'Sale'}{sale ? ` · ${formatDate(sale.sale_date)}` : ''}</span><strong>{currency.format(Number(allocation.amount))}</strong></span>
          })}
          {Number(payment.unallocated_amount) > 0 && <span className="unallocated-row"><span>Unallocated credit</span><strong>{currency.format(Number(payment.unallocated_amount))}</strong></span>}
        </div>
      </div>
    })}</div>
    <div className="payment-history-total"><span>Total received<small>{currency.format(totalUnallocated)} remains unallocated</small></span><strong>{currency.format(totalReceived)}</strong></div>
  </div></div>
}
