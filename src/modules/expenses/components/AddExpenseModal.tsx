import { Check, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { categories, createEmptyExpense, paymentMethods, units } from '../constants'
import type { ExpenseInput } from '../types'
import { DateInput } from '../../../components/DateInput'
import type { CashAccount } from '../../cash-accounts/types'
import type { AppRole } from '../../access/types'
import type { ProjectOption } from '../../projects/types'
import type { FuelCardBalance, TruckSummary } from '../../trucks/types'
import { getFuelCardAssignment } from '../../trucks/types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface Props {
  saving: boolean
  role: AppRole
  cashAccounts: CashAccount[]
  preferredCashAccountId: string | null
  projects: ProjectOption[]
  fuelCards: FuelCardBalance[]
  trucks: TruckSummary[]
  onClose: () => void
  onSubmit: (expense: ExpenseInput) => Promise<void>
}

export function AddExpenseModal({ saving, role, cashAccounts, preferredCashAccountId, projects, fuelCards, trucks, onClose, onSubmit }: Props) {
  const projectLead = role === 'project_lead'
  const activeAccounts = cashAccounts.filter((account) => account.is_active)
  const activeFuelCards = fuelCards.filter((card) => card.is_active)
  const activeTrucks = trucks.filter((truck) => truck.is_active)
  const defaultCashAccount = activeAccounts.find((account) => account.id === preferredCashAccountId)
    ?? activeAccounts.find((account) => account.account_type === 'main')
    ?? activeAccounts[0]
  const [form, setForm] = useState<ExpenseInput>(() => ({
    ...createEmptyExpense(),
    payment_method: 'Cash',
    cash_account_id: defaultCashAccount?.id ?? null,
  }))
  const calculatedTotal = form.quantity * form.unit_price
  const selectedFuelCard = activeFuelCards.find((card) => card.id === form.fuel_card_id)
  const selectedTruck = activeTrucks.find((truck) => truck.id === form.truck_id)
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
    }
  }, [])

  function applyFuelCard(cardId: string) {
    const card = activeFuelCards.find((item) => item.id === cardId)
    if (!card) {
      setForm({ ...form, fuel_card_id: null })
      return
    }

    const assignedToTruck = card.assignment_type === 'truck' && card.truck_id
    const assignedToProject = card.assignment_type === 'project' && card.project_id
    const assignedToFactory = card.assignment_type === 'factory'
    setForm({
      ...form,
      merchant: card.provider_name,
      payment_method: 'Fuel card',
      fuel_card_id: card.id,
      cash_account_id: null,
      status: 'paid',
      unit: 'Liter',
      category: assignedToTruck ? 'Truck Costs' : assignedToProject ? 'Other Projects' : assignedToFactory ? 'Factory' : form.category,
      truck_id: assignedToTruck ? card.truck_id : form.category === 'Truck Costs' ? form.truck_id : null,
      project_id: assignedToProject ? card.project_id : form.project_id,
      fuel_tank_reading_liters: null,
    })
  }

  function changePaymentMethod(method: string) {
    if (method === 'Fuel card') {
      const firstCard = activeFuelCards[0]
      if (firstCard) applyFuelCard(firstCard.id)
      else setForm({ ...form, payment_method: method, cash_account_id: null, fuel_card_id: null, status: 'paid', unit: 'Liter' })
      return
    }
    setForm({
      ...form,
      payment_method: method,
      cash_account_id: method === 'Cash' ? form.cash_account_id ?? defaultCashAccount?.id ?? null : null,
      fuel_card_id: null,
      unit: form.unit === 'Liter' ? 'Piece' : form.unit,
      fuel_tank_reading_liters: null,
    })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal expense-modal">
      <div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add a new expense</h3><p>Record a company purchase</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}>
        <div className="form-grid">
          <label className="wide">Merchant<span>*</span><input autoFocus required value={form.merchant} onChange={(event) => setForm({ ...form, merchant: event.target.value })} placeholder="e.g. Acme Supplies" /></label>
          <label>Date<span>*</span><DateInput required value={form.expense_date} onChange={(value) => setForm({ ...form, expense_date: value })} /></label>
          <label>{form.payment_method === 'Fuel card' ? 'Price per litre' : 'Unit price'}<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.unit_price || ''} onChange={(event) => setForm({ ...form, unit_price: event.target.value === '' ? 0 : Number(event.target.value) })} placeholder="0.00" /></div></label>
          <label>{form.payment_method === 'Fuel card' ? 'Litres purchased' : 'Quantity'}<span>*</span><input type="number" min="0.001" step="0.001" required value={form.quantity || ''} onChange={(event) => setForm({ ...form, quantity: event.target.value === '' ? 0 : Number(event.target.value) })} /></label>
          <label>Unit<select disabled={form.payment_method === 'Fuel card'} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{form.payment_method === 'Fuel card' ? <option>Liter</option> : units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label>Category<select value={form.category} onChange={(event) => { const nextCategory = event.target.value; setForm({ ...form, category: nextCategory, truck_id: nextCategory === 'Truck Costs' ? form.truck_id : null, fuel_tank_reading_liters: nextCategory === 'Truck Costs' ? form.fuel_tank_reading_liters : null }) }}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          {form.category === 'Truck Costs' && <label className="wide">Truck<span>*</span><select required value={form.truck_id ?? ''} onChange={(event) => setForm({ ...form, truck_id: event.target.value || null, fuel_tank_reading_liters: null })}><option value="" disabled>Select truck</option>{activeTrucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.name} — {truck.registration_number}</option>)}</select></label>}
          <label>Project<select value={form.project_id ?? ''} onChange={(event) => setForm({ ...form, project_id: event.target.value || null })}><option value="">General / No project</option>{projects.filter((project) => project.status === 'planned' || project.status === 'active').map((project) => <option key={project.id} value={project.id}>{project.name} — {project.location}</option>)}</select></label>
          <label>Payment method<select value={form.payment_method} onChange={(event) => changePaymentMethod(event.target.value)}>{(projectLead ? paymentMethods.filter((item) => item !== 'Bank transfer') : paymentMethods).map((item) => <option key={item}>{item}</option>)}</select></label>
          {form.payment_method === 'Fuel card' ? <label className="wide">Fuel card<span>*</span><select required value={form.fuel_card_id ?? ''} onChange={(event) => applyFuelCard(event.target.value)}><option value="" disabled>{activeFuelCards.length === 0 ? 'No accessible active fuel cards' : 'Select fuel card'}</option>{activeFuelCards.map((card) => <option key={card.id} value={card.id}>{card.provider_name} — {card.name} · {getFuelCardAssignment(card)} · {currency.format(Number(card.balance))}</option>)}</select>{selectedFuelCard && <small className={Number(selectedFuelCard.balance) < calculatedTotal ? 'negative-amount' : ''}>Card balance after purchase: {currency.format(Number(selectedFuelCard.balance) - calculatedTotal)}</small>}</label> : <label>Cash account{form.payment_method === 'Cash' && <span>*</span>}<select aria-label="Cash account" disabled={form.payment_method !== 'Cash'} required={form.payment_method === 'Cash'} value={form.cash_account_id ?? ''} onChange={(event) => setForm({ ...form, cash_account_id: event.target.value || null })}><option value="" disabled>{form.payment_method === 'Cash' ? 'Select cash account' : 'Not applicable for bank transfer'}</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {currency.format(Number(account.balance))}</option>)}</select></label>}
          {form.payment_method === 'Fuel card' && form.truck_id && <label className="wide">Tank reading, L<input type="number" min="0" max={selectedTruck?.tank_capacity_liters} step="0.01" value={form.fuel_tank_reading_liters ?? ''} onChange={(event) => setForm({ ...form, fuel_tank_reading_liters: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Optional tank level in litres" /></label>}
          <div className="wide calculated-total"><span>Calculated total</span><strong>{currency.format(calculatedTotal)}</strong><small>{form.quantity || 0} × {currency.format(form.unit_price || 0)}</small></div>
          <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What was this expense for?" /></label>
          {!projectLead && form.payment_method !== 'Fuel card' && <label className="wide">Status<div className="segmented"><button type="button" className={form.status === 'paid' ? 'selected' : ''} onClick={() => setForm({ ...form, status: 'paid' })}><Check size={15} /> Paid</button><button type="button" className={form.status === 'pending' ? 'selected' : ''} onClick={() => setForm({ ...form, status: 'pending' })}>Pending</button></div></label>}
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button disabled={saving || (form.payment_method === 'Fuel card' && !form.fuel_card_id)} className="button primary">{saving ? 'Saving…' : 'Add expense'}</button></div>
      </form>
    </div>
  </div>
}
