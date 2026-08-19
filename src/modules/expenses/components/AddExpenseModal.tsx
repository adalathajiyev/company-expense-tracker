import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { categories, emptyExpense, paymentMethods, units } from '../constants'
import type { ExpenseInput } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  saving: boolean
  onClose: () => void
  onSubmit: (expense: ExpenseInput) => Promise<void>
}

export function AddExpenseModal({ saving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ExpenseInput>(emptyExpense)
  const calculatedTotal = form.quantity * form.unit_price

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal">
      <div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add a new expense</h3><p>Record a company purchase</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}>
        <div className="form-grid">
          <label className="wide">Merchant<span>*</span><input autoFocus required value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="e.g. Acme Supplies" /></label>
          <label>Date<span>*</span><input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></label>
          <label>Unit price<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.unit_price || ''} onChange={(e) => setForm({ ...form, unit_price: e.target.value === '' ? 0 : Number(e.target.value) })} placeholder="0.00" /></div></label>
          <label>Quantity<span>*</span><input type="number" min="0.001" step="0.001" required value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: e.target.value === '' ? 0 : Number(e.target.value) })} /></label>
          <label>Unit<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Payment method<select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="wide calculated-total"><span>Calculated total</span><strong>{currency.format(calculatedTotal)}</strong><small>{form.quantity || 0} × {currency.format(form.unit_price || 0)}</small></div>
          <label className="wide">Description<textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?" /></label>
          <label className="wide">Status<div className="segmented"><button type="button" className={form.status === 'paid' ? 'selected' : ''} onClick={() => setForm({ ...form, status: 'paid' })}><Check size={15} /> Paid</button><button type="button" className={form.status === 'pending' ? 'selected' : ''} onClick={() => setForm({ ...form, status: 'pending' })}>Pending</button></div></label>
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="button primary">{saving ? 'Saving…' : 'Add expense'}</button></div>
      </form>
    </div>
  </div>
}
