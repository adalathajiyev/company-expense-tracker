import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { categories, createEmptyExpense, paymentMethods, units } from '../constants'
import type { ExpenseInput } from '../types'
import { DateInput } from '../../../components/DateInput'
import type { CashAccount } from '../../cash-accounts/types'
import type { AppRole } from '../../access/types'
import type { ProjectOption } from '../../projects/types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  saving: boolean
  role: AppRole
  cashAccounts: CashAccount[]
  projects: ProjectOption[]
  onClose: () => void
  onSubmit: (expense: ExpenseInput) => Promise<void>
}

export function AddExpenseModal({ saving, role, cashAccounts, projects, onClose, onSubmit }: Props) {
  const projectLead = role === 'project_lead'
  const activeAccounts = cashAccounts.filter((account) => account.is_active)
  const defaultCashAccount = activeAccounts.find((account) => account.account_type === 'main') ?? activeAccounts[0]
  const [form, setForm] = useState<ExpenseInput>(() => ({
    ...createEmptyExpense(),
    payment_method: 'Cash',
    cash_account_id: defaultCashAccount?.id ?? null,
  }))
  const calculatedTotal = form.quantity * form.unit_price

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal">
      <div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add a new expense</h3><p>Record a company purchase</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}>
        <div className="form-grid">
          <label className="wide">Merchant<span>*</span><input autoFocus required value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="e.g. Acme Supplies" /></label>
          <label>Date<span>*</span><DateInput required value={form.expense_date} onChange={(value) => setForm({ ...form, expense_date: value })} /></label>
          <label>Unit price<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.unit_price || ''} onChange={(e) => setForm({ ...form, unit_price: e.target.value === '' ? 0 : Number(e.target.value) })} placeholder="0.00" /></div></label>
          <label>Quantity<span>*</span><input type="number" min="0.001" step="0.001" required value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: e.target.value === '' ? 0 : Number(e.target.value) })} /></label>
          <label>Unit<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Project<select value={form.project_id ?? ''} onChange={(e) => setForm({ ...form, project_id: e.target.value || null })}><option value="">General / No project</option>{projects.filter((project) => project.status === 'planned' || project.status === 'active').map((project) => <option key={project.id} value={project.id}>{project.name} — {project.location}</option>)}</select></label>
          <label>Payment method<select value={form.payment_method} onChange={(e) => { const method = e.target.value; setForm({ ...form, payment_method: method, cash_account_id: method === 'Cash' ? form.cash_account_id ?? defaultCashAccount?.id ?? null : null }) }}>{(projectLead ? ['Cash'] : paymentMethods).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Cash account{form.payment_method === 'Cash' && <span>*</span>}<select aria-label="Cash account" disabled={form.payment_method !== 'Cash'} required={form.payment_method === 'Cash'} value={form.cash_account_id ?? ''} onChange={(e) => setForm({ ...form, cash_account_id: e.target.value || null })}><option value="" disabled>{form.payment_method === 'Cash' ? 'Select cash account' : 'Not applicable for bank transfer'}</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {currency.format(Number(account.balance))}</option>)}</select></label>
          <div className="wide calculated-total"><span>Calculated total</span><strong>{currency.format(calculatedTotal)}</strong><small>{form.quantity || 0} × {currency.format(form.unit_price || 0)}</small></div>
          <label className="wide">Description<textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?" /></label>
          {!projectLead && <label className="wide">Status<div className="segmented"><button type="button" className={form.status === 'paid' ? 'selected' : ''} onClick={() => setForm({ ...form, status: 'paid' })}><Check size={15} /> Paid</button><button type="button" className={form.status === 'pending' ? 'selected' : ''} onClick={() => setForm({ ...form, status: 'pending' })}>Pending</button></div></label>}
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="button primary">{saving ? 'Saving…' : 'Add expense'}</button></div>
      </form>
    </div>
  </div>
}
