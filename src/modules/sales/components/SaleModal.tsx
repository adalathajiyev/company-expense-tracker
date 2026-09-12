import { Pencil, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { DateInput } from '../../../components/DateInput'
import { createEmptySale, saleCategories, units } from '../constants'
import { calculateSaleAmount, isSaleTotalBelowAllocated } from '../saleCalculations'
import type { Sale, SaleCategory, SaleInput, SalePaymentMethod } from '../types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const preciseCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN', minimumFractionDigits: 2, maximumFractionDigits: 6 })

interface Props {
  sale?: Sale | null
  defaultCustomerId: string
  customers: Array<{ id: string; name: string }>
  allowedPaymentMethods: readonly SalePaymentMethod[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: SaleInput) => Promise<void>
}

function formFromSale(sale: Sale): SaleInput {
  return {
    customer_id: sale.customer_id,
    sale_date: sale.sale_date,
    product: sale.product,
    description: sale.description,
    category: sale.category,
    quantity: String(sale.quantity),
    unit: sale.unit,
    unit_price: String(sale.unit_price),
    payment_method: sale.payment_method,
  }
}

export function SaleModal({ sale, defaultCustomerId, customers, allowedPaymentMethods, saving, onClose, onSubmit }: Props) {
  const editing = Boolean(sale)
  const [form, setForm] = useState<SaleInput>(() => sale
    ? formFromSale(sale)
    : { ...createEmptySale(), customer_id: defaultCustomerId, payment_method: allowedPaymentMethods[0] ?? 'Cash' })
  const calculatedAmount = calculateSaleAmount(form.quantity, form.unit_price)
  const belowAllocatedAmount = Boolean(sale && isSaleTotalBelowAllocated(calculatedAmount, Number(sale.paid_amount)))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!calculatedAmount || belowAllocatedAmount) return
    await onSubmit({
      ...form,
      product: form.product.trim(),
      description: form.description?.trim() || null,
    })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><div className="modal">
    <div className="modal-head"><div><span className="modal-icon">{editing ? <Pencil size={20} /> : <Plus size={20} />}</span><div><h3>{editing ? 'Edit sale' : 'Add a sale'}</h3><p>{editing ? 'Correct the sale details without changing its customer' : 'Record a product or service sold'}</p></div></div><button type="button" className="icon-button" disabled={saving} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><div className="form-grid">
      {sale
        ? <label className="wide">Customer<input disabled value={sale.customer_name} /><small>The customer cannot be changed after a sale is created.</small></label>
        : <label className="wide">Customer<span>*</span><select autoFocus required value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}><option value="" disabled>Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>}
      <label className="wide">Product sold<span>*</span><input autoFocus={editing} required value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} placeholder="Product or service name" /></label>
      <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional details about this sale" /></label>
      <label>Category<span>*</span><select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as SaleCategory })}>{saleCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Date<span>*</span><DateInput required value={form.sale_date} onChange={(value) => setForm({ ...form, sale_date: value })} /></label>
      <label>Unit price<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.000001" step="0.000001" required value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></div></label>
      <label>Quantity<span>*</span><input type="number" min="0.000001" step="0.000001" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
      <label>Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      <label>Expected payment method<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value as SalePaymentMethod })}>{allowedPaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
      <div className={`wide calculated-total${belowAllocatedAmount ? ' sale-total-invalid' : ''}`}><span>Calculated total</span><strong>{currency.format(Number(calculatedAmount ?? 0))}</strong><small>{form.quantity || 0} × {form.unit_price ? preciseCurrency.format(Number(form.unit_price)) : currency.format(0)}{sale && ` · ${currency.format(Number(sale.paid_amount))} already allocated`}</small></div>
      {belowAllocatedAmount && <p className="wide sale-edit-error">The total cannot be less than the {currency.format(Number(sale?.paid_amount ?? 0))} already allocated to this sale.</p>}
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !calculatedAmount || belowAllocatedAmount}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add sale'}</button></div></form>
  </div></div>
}
