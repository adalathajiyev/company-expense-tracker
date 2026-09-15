import { Banknote, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { DateInput } from '../../../components/DateInput'
import { getBusinessDate } from '../../../lib/businessDate'
import type { CashAccount } from '../../cash-accounts/types'
import type { BalanceAdjustment, BalanceAdjustmentPaymentMethod, BalanceAdjustmentSettlementInput } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  adjustment: BalanceAdjustment
  cashAccounts: CashAccount[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: BalanceAdjustmentSettlementInput) => Promise<void>
}

export function RecordBalanceAdjustmentSettlementModal({ adjustment, cashAccounts, saving, onClose, onSubmit }: Props) {
  const today = getBusinessDate()
  const activeCashAccounts = useMemo(() => cashAccounts.filter((account) => account.is_active), [cashAccounts])
  const defaultCashAccount = activeCashAccounts.find((account) => account.account_type === 'main') ?? activeCashAccounts[0]
  const [paymentDate, setPaymentDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<BalanceAdjustmentPaymentMethod>('Cash')
  const [cashAccountId, setCashAccountId] = useState(defaultCashAccount?.id ?? '')
  const [note, setNote] = useState('')
  const numericAmount = Number(amount) || 0
  const invalidAmount = numericAmount <= 0 || numericAmount > adjustment.remaining_amount + 0.001

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (invalidAmount || (paymentMethod === 'Cash' && !cashAccountId)) return
    await onSubmit({
      balance_adjustment_id: adjustment.id,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      cash_account_id: paymentMethod === 'Cash' ? cashAccountId : null,
      amount: numericAmount,
      note: note.trim() || null,
    })
  }

  const action = adjustment.direction === 'receivable' ? 'receipt' : 'payment'

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="record-adjustment-settlement-title">
    <div className="modal-head"><div><span className="modal-icon"><Banknote size={20} /></span><div><h3 id="record-adjustment-settlement-title">Record {action}</h3><p>{adjustment.name} · {currency.format(adjustment.remaining_amount)} remaining</p></div></div><button type="button" className="icon-button" disabled={saving} onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={submit}>
      <div className="form-grid">
        <label>Date<span>*</span><DateInput max={today} required value={paymentDate} onChange={setPaymentDate} /></label>
        <label>Amount<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0.01" max={adjustment.remaining_amount} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div></label>
        <label className="wide">Payment method<span>*</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as BalanceAdjustmentPaymentMethod)}><option>Cash</option><option>Bank transfer</option></select></label>
        {paymentMethod === 'Cash' && <label className="wide">Cash account<span>*</span><select required value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)}><option value="" disabled>Select cash account</option>{activeCashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
        <label className="wide">Note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional settlement note" /></label>
        <div className="wide settlement-cash-note">{paymentMethod === 'Cash' ? `This will ${adjustment.direction === 'receivable' ? 'increase' : 'decrease'} the selected physical cash account.` : 'A bank transfer does not change a physical cash account.'}</div>
      </div>
      <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || invalidAmount || (paymentMethod === 'Cash' && !cashAccountId)}>{saving ? 'Saving…' : `Record ${action}`}</button></div>
    </form>
  </div></div>
}
