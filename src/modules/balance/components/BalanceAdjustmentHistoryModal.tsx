import { History, Trash2, X } from 'lucide-react'
import { formatDate } from '../../../lib/businessDate'
import type { CashAccount } from '../../cash-accounts/types'
import type { BalanceAdjustment } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  adjustment: BalanceAdjustment
  cashAccounts: CashAccount[]
  deletingId: string | null
  onClose: () => void
  onDelete: (settlementId: string) => Promise<void>
}

export function BalanceAdjustmentHistoryModal({ adjustment, cashAccounts, deletingId, onClose, onDelete }: Props) {
  const accountNames = new Map(cashAccounts.map((account) => [account.id, account.name]))
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deletingId && onClose()}><div className="modal payment-history-modal">
    <div className="modal-head"><div><span className="modal-icon"><History size={20} /></span><div><h3>Settlement history</h3><p>{adjustment.name}</p></div></div><button className="icon-button" disabled={Boolean(deletingId)} onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <div className="payment-history-list">{adjustment.settlements.length === 0 ? <div className="payment-history-empty">No settlements have been recorded.</div> : adjustment.settlements.map((settlement) => <div className="payment-history-item" key={settlement.id}>
      <div><strong>{currency.format(settlement.amount)}</strong><span>{formatDate(settlement.payment_date)} · {settlement.payment_method}{settlement.cash_account_id ? ` · ${accountNames.get(settlement.cash_account_id) ?? 'Cash account'}` : ''}</span>{settlement.note && <small>{settlement.note}</small>}<small>Added by {settlement.created_by_email}</small></div>
      <button className="icon-button delete" disabled={Boolean(deletingId)} title="Delete settlement" aria-label={`Delete ${currency.format(settlement.amount)} settlement`} onClick={() => onDelete(settlement.id)}><Trash2 size={15} /></button>
    </div>)}</div>
    <div className="settlement-history-totals"><span><small>Original</small><strong>{currency.format(adjustment.amount)}</strong></span><span><small>Settled</small><strong>{currency.format(adjustment.settled_amount)}</strong></span><span><small>Remaining</small><strong>{currency.format(adjustment.remaining_amount)}</strong></span></div>
  </div></div>
}
