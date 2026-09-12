import { FilePlus2, PackagePlus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DateInput } from '../../../components/DateInput'
import { getBusinessDate } from '../../../lib/businessDate'
import {
  createEmptyRawMaterialReceipt,
  rawMaterialCategories,
  rawMaterialCostTypes,
  rawMaterialTransportMethods,
  rawMaterialUnits,
  supportedCurrencies,
} from '../constants'
import { calculateRawMaterialReceiptTotals } from '../rawMaterialCalculations'
import type {
  CreateRawMaterialReceiptInput,
  RawMaterialReceiptCostInput,
  RawMaterialReceiptItemInput,
} from '../types'

interface Props {
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateRawMaterialReceiptInput) => Promise<void>
}

interface MaterialRow {
  rowId: string
  materialName: string
  category: string
  specification: string
  quantity: string
  unit: string
  unitPrice: string
}

interface CostRow {
  rowId: string
  costType: string
  description: string
  amountAzn: string
}

function newMaterialRow(): MaterialRow {
  return {
    rowId: crypto.randomUUID(),
    materialName: '',
    category: rawMaterialCategories[0],
    specification: '',
    quantity: '',
    unit: rawMaterialUnits[0],
    unitPrice: '',
  }
}

function newCostRow(): CostRow {
  return {
    rowId: crypto.randomUUID(),
    costType: rawMaterialCostTypes[0],
    description: '',
    amountAzn: '',
  }
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

export function AddRawMaterialReceiptModal({ saving, onClose, onSubmit }: Props) {
  const [receipt, setReceipt] = useState(createEmptyRawMaterialReceipt)
  const [materials, setMaterials] = useState<MaterialRow[]>(() => [newMaterialRow()])
  const [costs, setCosts] = useState<CostRow[]>([])
  const [files, setFiles] = useState<File[]>([])

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

  const itemInputs = useMemo<RawMaterialReceiptItemInput[]>(() => materials.map((item) => ({
    material_name: item.materialName,
    category: item.category,
    specification: item.specification || null,
    quantity: Number(item.quantity) || 0,
    unit: item.unit,
    unit_price: Number(item.unitPrice) || 0,
  })), [materials])

  const costInputs = useMemo<RawMaterialReceiptCostInput[]>(() => costs.map((cost) => ({
    cost_type: cost.costType,
    description: cost.description || null,
    amount_azn: Number(cost.amountAzn) || 0,
  })), [costs])

  const totals = calculateRawMaterialReceiptTotals(itemInputs, costInputs, receipt.exchange_rate_to_azn)
  const today = getBusinessDate()
  const requiresVehicleReference = receipt.transport_method === 'Truck' || receipt.transport_method === 'Rail'

  function updateMaterial(rowId: string, update: Partial<MaterialRow>) {
    setMaterials((current) => current.map((item) => item.rowId === rowId ? { ...item, ...update } : item))
  }

  function updateCost(rowId: string, update: Partial<CostRow>) {
    setCosts((current) => current.map((cost) => cost.rowId === rowId ? { ...cost, ...update } : cost))
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div className="modal raw-material-modal">
      <div className="modal-head"><div><span className="modal-icon"><PackagePlus size={20} /></span><div><h3>Add incoming materials</h3><p>Record a delivery, its invoice value, and supporting documents</p></div></div><button className="icon-button" disabled={saving} onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <form onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit({
          receipt: {
            ...receipt,
            supplier_name: receipt.supplier_name.trim(),
            supplier_country: receipt.supplier_country?.trim() || null,
            invoice_number: receipt.invoice_number?.trim() || null,
            vehicle_reference: receipt.vehicle_reference?.trim() || null,
            customs_reference: receipt.customs_reference?.trim() || null,
            notes: receipt.notes?.trim() || null,
          },
          items: itemInputs.map((item) => ({
            ...item,
            material_name: item.material_name.trim(),
            specification: item.specification?.trim() || null,
          })),
          costs: costInputs.map((cost) => ({
            ...cost,
            description: cost.description?.trim() || null,
          })),
          files,
        })
      }}>
        <div className="raw-material-form-section">
          <div className="raw-material-section-heading"><div><h4>Delivery information</h4><p>Supplier, invoice, and transport details</p></div></div>
          <div className="form-grid">
            <label>Received date<span>*</span><DateInput required max={today} value={receipt.receipt_date} onChange={(value) => setReceipt({ ...receipt, receipt_date: value })} /></label>
            <label>Supplier<span>*</span><input autoFocus required value={receipt.supplier_name} onChange={(event) => setReceipt({ ...receipt, supplier_name: event.target.value })} placeholder="Supplier or organization" /></label>
            <label>Supplier country<input value={receipt.supplier_country ?? ''} onChange={(event) => setReceipt({ ...receipt, supplier_country: event.target.value })} placeholder="Optional" /></label>
            <label>Invoice number<input value={receipt.invoice_number ?? ''} onChange={(event) => setReceipt({ ...receipt, invoice_number: event.target.value })} placeholder="Optional" /></label>
            <label>Invoice date<DateInput max={today} value={receipt.invoice_date ?? ''} onChange={(value) => setReceipt({ ...receipt, invoice_date: value || null })} /></label>
            <label>Transport method<select value={receipt.transport_method} onChange={(event) => setReceipt({ ...receipt, transport_method: event.target.value as typeof receipt.transport_method, vehicle_reference: null })}>{rawMaterialTransportMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
            <label>{receipt.transport_method === 'Rail' ? 'Wagon number' : receipt.transport_method === 'Truck' ? 'Truck number' : 'Transport reference'}{requiresVehicleReference && <span>*</span>}<input required={requiresVehicleReference} value={receipt.vehicle_reference ?? ''} onChange={(event) => setReceipt({ ...receipt, vehicle_reference: event.target.value })} placeholder={requiresVehicleReference ? 'Required' : 'Optional'} /></label>
            <label>Customs reference<input value={receipt.customs_reference ?? ''} onChange={(event) => setReceipt({ ...receipt, customs_reference: event.target.value })} placeholder="Optional" /></label>
            <label>Invoice currency<select value={receipt.currency} onChange={(event) => { const currency = event.target.value; setReceipt({ ...receipt, currency, exchange_rate_to_azn: currency === 'AZN' ? 1 : receipt.exchange_rate_to_azn }) }}>{supportedCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
            <label>Exchange rate to AZN<span>*</span><input type="number" required min="0.00000001" step="0.00000001" disabled={receipt.currency === 'AZN'} value={receipt.exchange_rate_to_azn || ''} onChange={(event) => setReceipt({ ...receipt, exchange_rate_to_azn: event.target.value === '' ? 0 : Number(event.target.value) })} /><small>1 {receipt.currency} equals this many AZN</small></label>
          </div>
        </div>

        <div className="raw-material-form-section">
          <div className="raw-material-section-heading"><div><h4>Materials</h4><p>Add every material, component, machine, or supply in this delivery</p></div><button type="button" className="button secondary compact-button" onClick={() => setMaterials((current) => [...current, newMaterialRow()])}><Plus size={14} /> Add item</button></div>
          <div className="raw-material-form-list">
            {materials.map((item, index) => <div className="raw-material-item-row" key={item.rowId}>
              <span className="raw-material-row-number">{index + 1}</span>
              <div className="raw-material-item-fields">
                <label>Material<span>*</span><input required value={item.materialName} onChange={(event) => updateMaterial(item.rowId, { materialName: event.target.value })} placeholder="e.g. Steel hinges" /></label>
                <label>Category<span>*</span><select value={item.category} onChange={(event) => updateMaterial(item.rowId, { category: event.target.value })}>{rawMaterialCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="material-specification">Specification<input value={item.specification} onChange={(event) => updateMaterial(item.rowId, { specification: event.target.value })} placeholder="Size, model, grade, dimensions…" /></label>
                <label>Quantity<span>*</span><input type="number" required min="0.000001" step="0.000001" value={item.quantity} onChange={(event) => updateMaterial(item.rowId, { quantity: event.target.value })} placeholder="0" /></label>
                <label>Unit<span>*</span><select value={item.unit} onChange={(event) => updateMaterial(item.rowId, { unit: event.target.value })}>{rawMaterialUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <label>Unit price<span>*</span><input type="number" required min="0" step="0.000001" value={item.unitPrice} onChange={(event) => updateMaterial(item.rowId, { unitPrice: event.target.value })} placeholder={`0.00 ${receipt.currency}`} /></label>
              </div>
              <button type="button" className="icon-button delete" disabled={materials.length === 1} onClick={() => setMaterials((current) => current.filter((row) => row.rowId !== item.rowId))} aria-label={`Remove material ${index + 1}`}><Trash2 size={16} /></button>
            </div>)}
          </div>
        </div>

        <div className="raw-material-form-section">
          <div className="raw-material-section-heading"><div><h4>Additional costs</h4><p>Optional landed costs recorded in AZN</p></div><button type="button" className="button secondary compact-button" onClick={() => setCosts((current) => [...current, newCostRow()])}><Plus size={14} /> Add cost</button></div>
          {costs.length === 0 ? <div className="raw-material-inline-empty">No transportation, customs, or other additional costs added.</div> : <div className="raw-material-form-list">
            {costs.map((cost, index) => <div className="raw-material-cost-row" key={cost.rowId}>
              <span className="raw-material-row-number">{index + 1}</span>
              <div className="raw-material-cost-fields">
                <label>Cost type<span>*</span><select value={cost.costType} onChange={(event) => updateCost(cost.rowId, { costType: event.target.value })}>{rawMaterialCostTypes.map((costType) => <option key={costType}>{costType}</option>)}</select></label>
                <label>Description<input value={cost.description} onChange={(event) => updateCost(cost.rowId, { description: event.target.value })} placeholder="Optional details" /></label>
                <label>Amount, AZN<span>*</span><input type="number" required min="0.01" step="0.01" value={cost.amountAzn} onChange={(event) => updateCost(cost.rowId, { amountAzn: event.target.value })} placeholder="0.00" /></label>
              </div>
              <button type="button" className="icon-button delete" onClick={() => setCosts((current) => current.filter((row) => row.rowId !== cost.rowId))} aria-label={`Remove cost ${index + 1}`}><Trash2 size={16} /></button>
            </div>)}
          </div>}
        </div>

        <div className="raw-material-form-section">
          <div className="raw-material-section-heading"><div><h4>Documents and notes</h4><p>Attach invoices or delivery documents up to 10 MB each</p></div></div>
          <div className="form-grid">
            <label className="wide raw-material-file-input"><FilePlus2 size={17} /> Invoice attachments<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><small>{files.length === 0 ? 'PDF, JPG, PNG, or WebP' : `${files.length} file${files.length === 1 ? '' : 's'} selected: ${files.map((file) => file.name).join(', ')}`}</small></label>
            <label className="wide">Notes<textarea value={receipt.notes ?? ''} onChange={(event) => setReceipt({ ...receipt, notes: event.target.value })} placeholder="Delivery condition or other useful information" /></label>
          </div>
        </div>

        <div className="raw-material-total-preview">
          <span>Invoice value <strong>{formatCurrency(totals.purchaseCostOriginal, receipt.currency)}</strong></span>
          <span>Invoice value in AZN <strong>{formatCurrency(totals.purchaseCostAzn, 'AZN')}</strong></span>
          <span>Additional costs <strong>{formatCurrency(totals.additionalCostAzn, 'AZN')}</strong></span>
          <span className="landed">Total landed cost <strong>{formatCurrency(totals.landedCostAzn, 'AZN')}</strong></span>
        </div>

        <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button disabled={saving} className="button primary">{saving ? 'Saving delivery…' : 'Add delivery'}</button></div>
      </form>
    </div>
  </div>
}
