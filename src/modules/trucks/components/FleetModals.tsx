import { ArrowRightLeft, CreditCard, Fuel, Plus, Truck, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { DateInput } from '../../../components/DateInput'
import { getBusinessDate } from '../../../lib/businessDate'
import type { CashAccount } from '../../cash-accounts/types'
import type { ProjectOption } from '../../projects/types'
import type {
  FuelCardAllocationInput,
  FuelCardBalance,
  FuelCardInput,
  FuelProviderBalance,
  FuelProviderInput,
  FuelProviderTopupInput,
  TruckInput,
  TruckSummary,
} from '../types'
import { fuelCardAssignmentLabels } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

interface ModalShellProps { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode; onClose: () => void }
function ModalShell({ icon, title, subtitle, children, onClose }: ModalShellProps) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><span className="modal-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</div></div>
}

interface CommonProps<T> { saving: boolean; onClose: () => void; onSubmit: (input: T) => Promise<void> }

export function AddTruckModal({ saving, onClose, onSubmit }: CommonProps<TruckInput>) {
  const [form, setForm] = useState<TruckInput>({ name: '', registration_number: '', make_model: '', tank_capacity_liters: 0, notes: '' })
  return <ModalShell icon={<Truck size={20} />} title="Add truck" subtitle="Create a truck for cost and fuel tracking" onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
    <label>Name<span>*</span><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Mercedes Actros 1" /></label>
    <label>Registration number<span>*</span><input required value={form.registration_number} onChange={(event) => setForm({ ...form, registration_number: event.target.value })} placeholder="99-AA-123" /></label>
    <label>Make / model<input value={form.make_model ?? ''} onChange={(event) => setForm({ ...form, make_model: event.target.value })} placeholder="Mercedes-Benz Actros" /></label>
    <label>Tank capacity, litres<span>*</span><input type="number" min="1" step="0.01" required value={form.tank_capacity_liters || ''} onChange={(event) => setForm({ ...form, tank_capacity_liters: Number(event.target.value) })} placeholder="600" /></label>
    <label className="wide">Notes<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional truck details" /></label>
  </div><ModalActions saving={saving} onClose={onClose} label="Add truck" /></form></ModalShell>
}

export function AddFuelProviderModal({ saving, onClose, onSubmit }: CommonProps<FuelProviderInput>) {
  const [form, setForm] = useState<FuelProviderInput>({ name: '', notes: '' })
  return <ModalShell icon={<Fuel size={20} />} title="Add petrol provider" subtitle="Create a provider platform balance" onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
    <label className="wide">Provider name<span>*</span><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Petrol station company" /></label>
    <label className="wide">Notes<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Account or contract details" /></label>
  </div><ModalActions saving={saving} onClose={onClose} label="Add provider" /></form></ModalShell>
}

interface AddCardProps extends CommonProps<FuelCardInput> { providers: FuelProviderBalance[]; trucks: TruckSummary[]; projects: ProjectOption[]; cashAccounts: CashAccount[] }
export function AddFuelCardModal({ providers, trucks, projects, cashAccounts, saving, onClose, onSubmit }: AddCardProps) {
  const [form, setForm] = useState<FuelCardInput>({ provider_id: providers.find((item) => item.is_active)?.id ?? '', name: '', card_number: '', assignment_type: 'unassigned', truck_id: null, project_id: null, cash_account_id: null, custodian_name: '', notes: '' })
  function changeAssignment(assignment_type: FuelCardInput['assignment_type']) {
    setForm({ ...form, assignment_type, truck_id: assignment_type === 'truck' ? trucks.find((item) => item.is_active)?.id ?? null : null, project_id: assignment_type === 'project' ? projects.find((item) => item.status === 'active' || item.status === 'planned')?.id ?? null : null, cash_account_id: assignment_type === 'cash_account' ? cashAccounts.find((item) => item.is_active)?.id ?? null : null })
  }
  return <ModalShell icon={<CreditCard size={20} />} title="Add fuel card" subtitle="Register a provider card and its default assignment" onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
    <label>Provider<span>*</span><select required value={form.provider_id} onChange={(event) => setForm({ ...form, provider_id: event.target.value })}>{providers.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Card label<span>*</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Truck 1 card" /></label>
    <label>Card number<span>*</span><input required value={form.card_number} onChange={(event) => setForm({ ...form, card_number: event.target.value })} placeholder="Last digits or provider number" /></label>
    <label>Assigned to<span>*</span><select value={form.assignment_type} onChange={(event) => changeAssignment(event.target.value as FuelCardInput['assignment_type'])}>{Object.entries(fuelCardAssignmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {form.assignment_type === 'truck' && <label className="wide">Truck<span>*</span><select required value={form.truck_id ?? ''} onChange={(event) => setForm({ ...form, truck_id: event.target.value || null })}>{trucks.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name} — {item.registration_number}</option>)}</select></label>}
    {form.assignment_type === 'project' && <label className="wide">Project<span>*</span><select required value={form.project_id ?? ''} onChange={(event) => setForm({ ...form, project_id: event.target.value || null })}>{projects.filter((item) => item.status === 'planned' || item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name} — {item.location}</option>)}</select></label>}
    {form.assignment_type === 'cash_account' && <label className="wide">Cash account<span>*</span><select required value={form.cash_account_id ?? ''} onChange={(event) => setForm({ ...form, cash_account_id: event.target.value || null })}>{cashAccounts.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <label className="wide">Custodian / responsible person<input value={form.custodian_name ?? ''} onChange={(event) => setForm({ ...form, custodian_name: event.target.value })} placeholder="Person holding the physical card" /></label>
    <label className="wide">Notes<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional card details" /></label>
  </div><ModalActions saving={saving} onClose={onClose} label="Add card" /></form></ModalShell>
}

interface TopupProps extends CommonProps<FuelProviderTopupInput> { provider: FuelProviderBalance }
export function TopUpProviderModal({ provider, saving, onClose, onSubmit }: TopupProps) {
  const [form, setForm] = useState<FuelProviderTopupInput>({ provider_id: provider.id, topup_date: getBusinessDate(), amount: 0, bank_reference: '', notes: '' })
  return <ModalShell icon={<Plus size={20} />} title={`Top up ${provider.name}`} subtitle="Record a bank transfer to the provider platform" onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form) }}><div className="form-grid">
    <label>Date<span>*</span><DateInput required value={form.topup_date} onChange={(value) => setForm({ ...form, topup_date: value })} /></label>
    <label>Amount<span>*</span><div className="money-input"><span>₼</span><input autoFocus type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></div></label>
    <label className="wide">Bank reference<input value={form.bank_reference ?? ''} onChange={(event) => setForm({ ...form, bank_reference: event.target.value })} placeholder="Transfer reference or invoice number" /></label>
    <label className="wide">Notes<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
  </div><ModalActions saving={saving} onClose={onClose} label="Record top-up" /></form></ModalShell>
}

interface AllocationProps extends CommonProps<FuelCardAllocationInput> { cards: FuelCardBalance[]; providers: FuelProviderBalance[]; initialCardId?: string }
export function AllocateFuelCardModal({ cards, providers, initialCardId, saving, onClose, onSubmit }: AllocationProps) {
  const activeCards = cards.filter((card) => card.is_active)
  const [form, setForm] = useState<FuelCardAllocationInput>({ card_id: initialCardId && activeCards.some((card) => card.id === initialCardId) ? initialCardId : activeCards[0]?.id ?? '', allocation_date: getBusinessDate(), allocation_type: 'allocate', amount: 0, notes: '' })
  const card = activeCards.find((item) => item.id === form.card_id)
  const provider = providers.find((item) => item.id === card?.provider_id)
  const available = form.allocation_type === 'allocate' ? Number(provider?.main_balance ?? 0) : Number(card?.balance ?? 0)
  const invalid = form.amount > available
  return <ModalShell icon={<ArrowRightLeft size={20} />} title="Move provider balance" subtitle="Allocate balance to a card or return it to the provider" onClose={onClose}><form onSubmit={async (event: FormEvent) => { event.preventDefault(); if (!invalid) await onSubmit(form) }}><div className="form-grid">
    <label className="wide">Fuel card<span>*</span><select required value={form.card_id} onChange={(event) => setForm({ ...form, card_id: event.target.value })}>{activeCards.map((item) => <option key={item.id} value={item.id}>{item.provider_name} — {item.name} ({currency.format(Number(item.balance))})</option>)}</select></label>
    <label>Movement<span>*</span><select value={form.allocation_type} onChange={(event) => setForm({ ...form, allocation_type: event.target.value as FuelCardAllocationInput['allocation_type'] })}><option value="allocate">Provider → card</option><option value="return">Card → provider</option></select></label>
    <label>Date<span>*</span><DateInput required value={form.allocation_date} onChange={(value) => setForm({ ...form, allocation_date: value })} /></label>
    <label className="wide">Amount<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></div><small className={invalid ? 'negative-amount' : ''}>Available: {currency.format(available)}</small></label>
    <label className="wide">Notes<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
  </div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button disabled={saving || invalid || !form.card_id} className="button primary">{saving ? 'Saving…' : 'Save movement'}</button></div></form></ModalShell>
}

function ModalActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  return <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="button primary">{saving ? 'Saving…' : label}</button></div>
}
