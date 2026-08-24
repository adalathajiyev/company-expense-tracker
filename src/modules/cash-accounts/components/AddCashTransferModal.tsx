import { ArrowRightLeft, X } from 'lucide-react'
import { useState } from 'react'
import { DateInput } from '../../../components/DateInput'
import { getBusinessDate } from '../../../lib/businessDate'
import type { CashAccount, CashTransferInput } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  accounts: CashAccount[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: CashTransferInput) => Promise<void>
}

export function AddCashTransferModal({ accounts, saving, onClose, onSubmit }: Props) {
  const activeAccounts = accounts.filter((account) => account.is_active)
  const [form, setForm] = useState<CashTransferInput>({
    transfer_date: getBusinessDate(),
    from_account_id: activeAccounts[0]?.id ?? '',
    to_account_id: activeAccounts[1]?.id ?? '',
    amount: 0,
    description: '',
  })
  const source = activeAccounts.find((account) => account.id === form.from_account_id)

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal"><div className="modal-head"><div><span className="modal-icon"><ArrowRightLeft size={20} /></span><div><h3>Transfer cash</h3><p>Move company cash between custodians</p></div></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
        <label>From account<span>*</span><select required value={form.from_account_id} onChange={(event) => setForm({ ...form, from_account_id: event.target.value, to_account_id: form.to_account_id === event.target.value ? '' : form.to_account_id })}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {currency.format(Number(account.balance))}</option>)}</select></label>
        <label>To account<span>*</span><select required value={form.to_account_id} onChange={(event) => setForm({ ...form, to_account_id: event.target.value })}><option value="" disabled>Select destination</option>{activeAccounts.filter((account) => account.id !== form.from_account_id).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>Date<span>*</span><DateInput required max={getBusinessDate()} value={form.transfer_date} onChange={(value) => setForm({ ...form, transfer_date: value })} /></label>
        <label>Amount<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" max={source ? Number(source.balance) : undefined} step="0.01" required value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: event.target.value === '' ? 0 : Number(event.target.value) })} /></div></label>
        <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Why is this cash being transferred?" /></label>
      </div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || activeAccounts.length < 2}>{saving ? 'Transferring…' : 'Transfer cash'}</button></div></form>
    </div>
  </div>
}
