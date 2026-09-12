import { ArrowLeft, Download, FileText, PackageOpen, Trash2, Truck } from 'lucide-react'
import { formatDate } from '../../../lib/businessDate'
import { formatRawMaterialQuantity } from '../rawMaterialCalculations'
import type { RawMaterialAttachment, RawMaterialReceiptDetail } from '../types'

interface Props {
  receipt: RawMaterialReceiptDetail
  canDelete: boolean
  downloadingId: string | null
  onBack: () => void
  onDelete: () => void
  onDownload: (attachment: RawMaterialAttachment) => Promise<void>
}

function currency(value: number, code = 'AZN') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value)
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function RawMaterialReceiptDetail({ receipt, canDelete, downloadingId, onBack, onDelete, onDownload }: Props) {
  return <>
    <header><div><button className="project-back" onClick={onBack}><ArrowLeft size={15} /> All deliveries</button><p className="eyebrow">RAW MATERIAL DELIVERY</p><h1>{receipt.invoice_number ? `Invoice ${receipt.invoice_number}` : receipt.supplier_name}</h1><p>{receipt.supplier_name}{receipt.supplier_country ? ` · ${receipt.supplier_country}` : ''}</p></div><div className="header-actions">{canDelete && <button className="button secondary raw-material-delete-button" onClick={onDelete}><Trash2 size={16} /> Delete delivery</button>}</div></header>

    <section className="raw-material-detail-summary">
      <article><span>Invoice value</span><strong>{currency(receipt.purchase_cost_original, receipt.currency)}</strong><small>{receipt.currency === 'AZN' ? 'Recorded in AZN' : `${currency(receipt.purchase_cost_azn)} at ${receipt.exchange_rate_to_azn} AZN`}</small></article>
      <article><span>Additional costs</span><strong>{currency(receipt.additional_cost_azn)}</strong><small>Transportation, customs, and other costs</small></article>
      <article><span>Total landed cost</span><strong>{currency(receipt.landed_cost_azn)}</strong><small>Informational — does not affect Balance</small></article>
      <article><span>Delivery</span><strong className="raw-material-transport"><Truck size={17} /> {receipt.transport_method}</strong><small>{receipt.vehicle_reference || 'No vehicle reference'}</small></article>
    </section>

    <section className="panel raw-material-information">
      <div className="panel-heading"><div><h3>Delivery information</h3><p>Invoice, transport, and audit details</p></div></div>
      <dl>
        <div><dt>Received</dt><dd>{formatDate(receipt.receipt_date)}</dd></div>
        <div><dt>Invoice date</dt><dd>{receipt.invoice_date ? formatDate(receipt.invoice_date) : '—'}</dd></div>
        <div><dt>Invoice number</dt><dd>{receipt.invoice_number || '—'}</dd></div>
        <div><dt>Transport reference</dt><dd>{receipt.vehicle_reference || '—'}</dd></div>
        <div><dt>Customs reference</dt><dd>{receipt.customs_reference || '—'}</dd></div>
        <div><dt>Created by</dt><dd>{receipt.created_by_email}</dd></div>
      </dl>
    </section>

    <section className="panel raw-material-detail-panel">
      <div className="panel-heading"><div><h3>Received materials</h3><p>{receipt.item_count} line item{receipt.item_count === 1 ? '' : 's'} in this delivery</p></div></div>
      <div className="table-wrap raw-material-items-table"><table><thead><tr><th>Material</th><th>Category</th><th>Specification</th><th className="amount">Quantity</th><th className="amount">Unit price</th><th className="amount">Line total</th></tr></thead><tbody>
        {receipt.items.map((item) => <tr key={item.id}><td><strong className="raw-material-name">{item.material_name}</strong></td><td><span className="category green">{item.category}</span></td><td className="raw-material-specification">{item.specification || '—'}</td><td className="amount">{formatRawMaterialQuantity(item.quantity)} {item.unit}</td><td className="amount">{currency(item.unit_price, receipt.currency)}</td><td className="amount"><strong>{currency(item.line_total, receipt.currency)}</strong></td></tr>)}
      </tbody><tfoot><tr><td colSpan={5} className="total-label">Invoice value</td><td className="amount total-amount">{currency(receipt.purchase_cost_original, receipt.currency)}</td></tr></tfoot></table></div>
    </section>

    <div className="raw-material-detail-columns">
      <section className="panel raw-material-detail-panel">
        <div className="panel-heading"><div><h3>Additional costs</h3><p>Costs recorded directly in AZN</p></div></div>
        {receipt.costs.length === 0 ? <div className="raw-material-detail-empty">No additional costs recorded.</div> : <div className="raw-material-cost-list">{receipt.costs.map((cost) => <div key={cost.id}><span><strong>{cost.cost_type}</strong><small>{cost.description || 'No description'}</small></span><b>{currency(cost.amount_azn)}</b></div>)}</div>}
        <div className="raw-material-detail-total"><span>Total additional costs</span><strong>{currency(receipt.additional_cost_azn)}</strong></div>
      </section>

      <section className="panel raw-material-detail-panel">
        <div className="panel-heading"><div><h3>Documents</h3><p>Private invoices and delivery documents</p></div></div>
        {receipt.attachments.length === 0 ? <div className="raw-material-detail-empty">No documents attached.</div> : <div className="raw-material-document-list">{receipt.attachments.map((attachment) => <div key={attachment.id}><span className="raw-material-document-icon"><FileText size={17} /></span><span><strong>{attachment.file_name}</strong><small>{fileSize(attachment.size_bytes)}</small></span><button className="icon-button" disabled={downloadingId === attachment.id} onClick={() => void onDownload(attachment)} aria-label={`Open ${attachment.file_name}`} title="Open document"><Download size={16} /></button></div>)}</div>}
      </section>
    </div>

    {receipt.notes && <section className="project-description raw-material-notes"><PackageOpen size={19} /><div><strong>Delivery notes</strong><p>{receipt.notes}</p></div></section>}
  </>
}
