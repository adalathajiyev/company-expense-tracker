import { FileText, PackageOpen, Plus, Search, Trash2, Truck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDate } from '../../lib/businessDate'
import { sumMoney } from '../../lib/money'
import { canDeleteOwnedRecord, type AppRole } from '../access/types'
import { AddRawMaterialReceiptModal } from './components/AddRawMaterialReceiptModal'
import { DeleteRawMaterialReceiptModal } from './components/DeleteRawMaterialReceiptModal'
import { RawMaterialReceiptDetail } from './components/RawMaterialReceiptDetail'
import { rawMaterialTransportMethods } from './constants'
import {
  createRawMaterialReceipt,
  deleteRawMaterialReceipt,
  getRawMaterialAttachmentUrl,
  getRawMaterialReceipt,
  getRawMaterialReceipts,
} from './rawMaterialService'
import type {
  CreateRawMaterialReceiptInput,
  RawMaterialAttachment,
  RawMaterialReceiptDetail as RawMaterialReceiptDetailType,
  RawMaterialReceiptSummary,
} from './types'

interface Props {
  role: AppRole
  currentUserId: string
}

const azn = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

function sortReceipts(receipts: RawMaterialReceiptSummary[]) {
  return [...receipts].sort((a, b) => b.receipt_date.localeCompare(a.receipt_date) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
}

export function RawMaterialsModule({ role, currentUserId }: Props) {
  const [receipts, setReceipts] = useState<RawMaterialReceiptSummary[]>([])
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<RawMaterialReceiptDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [receiptToDelete, setReceiptToDelete] = useState<RawMaterialReceiptSummary | null>(null)
  const [search, setSearch] = useState('')
  const [transportFilter, setTransportFilter] = useState('All transport')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadReceipts = useCallback(async () => {
    setError('')
    try {
      setReceipts(await getRawMaterialReceipts())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load incoming materials.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadReceipts() }, [loadReceipts])

  useEffect(() => {
    if (!selectedReceiptId) {
      setSelectedReceipt(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setError('')
    getRawMaterialReceipt(selectedReceiptId)
      .then((receipt) => { if (!cancelled) setSelectedReceipt(receipt) })
      .catch((loadError: Error) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedReceiptId])

  const filteredReceipts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return receipts.filter((receipt) => {
      const matchesSearch = !term || `${receipt.supplier_name} ${receipt.supplier_country ?? ''} ${receipt.invoice_number ?? ''} ${receipt.vehicle_reference ?? ''} ${receipt.customs_reference ?? ''} ${receipt.material_summary}`.toLowerCase().includes(term)
      const matchesTransport = transportFilter === 'All transport' || receipt.transport_method === transportFilter
      return matchesSearch && matchesTransport
    })
  }, [receipts, search, transportFilter])

  const filteredLandedCost = sumMoney(filteredReceipts.map((receipt) => receipt.landed_cost_azn))

  async function saveReceipt(input: CreateRawMaterialReceiptInput) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const saved = await createRawMaterialReceipt(input)
      setReceipts((current) => sortReceipts([saved, ...current]))
      setAddOpen(false)
      setSuccess('Incoming material delivery was recorded.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the delivery.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!receiptToDelete) return
    setDeleting(true)
    setError('')
    setSuccess('')
    try {
      const warning = await deleteRawMaterialReceipt(receiptToDelete)
      setReceipts((current) => current.filter((receipt) => receipt.id !== receiptToDelete.id))
      if (selectedReceiptId === receiptToDelete.id) setSelectedReceiptId(null)
      setReceiptToDelete(null)
      if (warning) setError(warning)
      else setSuccess('Material delivery was deleted.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the delivery.')
    } finally {
      setDeleting(false)
    }
  }

  async function openAttachment(attachment: RawMaterialAttachment) {
    setDownloadingId(attachment.id)
    setError('')
    try {
      const url = await getRawMaterialAttachmentUrl(attachment)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not open the document.')
    } finally {
      setDownloadingId(null)
    }
  }

  if (selectedReceiptId) {
    const summary = receipts.find((receipt) => receipt.id === selectedReceiptId) ?? null
    return <>
      {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
      {detailLoading || !selectedReceipt ? <section className="panel"><div className="empty">Loading delivery…</div></section> : <RawMaterialReceiptDetail receipt={selectedReceipt} canDelete={canDeleteOwnedRecord(role, currentUserId, selectedReceipt.created_by)} downloadingId={downloadingId} onBack={() => setSelectedReceiptId(null)} onDelete={() => setReceiptToDelete(summary ?? selectedReceipt)} onDownload={openAttachment} />}
      {receiptToDelete && <DeleteRawMaterialReceiptModal receipt={receiptToDelete} deleting={deleting} onCancel={() => setReceiptToDelete(null)} onConfirm={confirmDelete} />}
    </>
  }

  return <>
    <header><div><p className="eyebrow">SUPPLY REGISTER</p><h1>Raw materials</h1><p>Record incoming materials, delivery details, costs, and invoices.</p></div><button className="button primary" onClick={() => setAddOpen(true)}><Plus size={17} /> Add delivery</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    {success && <div className="error-banner success-banner">{success}<button onClick={() => setSuccess('')}><X size={15} /></button></div>}

    <section className="panel">
      <div className="panel-heading"><div><h3>Incoming deliveries</h3><p>Independent material records that do not affect Expenses or Balance</p></div><span className="panel-heading-icon"><PackageOpen size={18} /></span></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, invoice, material…" /></label><label className="filter raw-material-transport-filter"><Truck size={16} /><select aria-label="Filter by transport method" value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)}><option>All transport</option>{rawMaterialTransportMethods.map((method) => <option key={method}>{method}</option>)}</select></label><span className="results">{filteredReceipts.length} deliveries</span></div>
      <div className="table-wrap raw-material-list-table"><table><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Transport</th><th>Materials</th><th>Quantity</th><th>Documents</th><th className="amount">Invoice value</th><th className="amount">Landed cost</th><th>Created by</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan={11} className="empty">Loading incoming materials…</td></tr> : filteredReceipts.length === 0 ? <tr><td colSpan={11} className="empty">No material deliveries match your filters.</td></tr> : filteredReceipts.map((receipt) => <tr key={receipt.id}>
          <td className="date-cell">{formatDate(receipt.receipt_date)}</td>
          <td><div className="raw-material-supplier"><strong>{receipt.supplier_name}</strong><span>{receipt.supplier_country || 'Country not specified'}</span></div></td>
          <td>{receipt.invoice_number || '—'}</td>
          <td><div className="raw-material-transport-cell"><strong>{receipt.transport_method}</strong><span>{receipt.vehicle_reference || 'No reference'}</span></div></td>
          <td><div className="raw-material-summary"><strong>{receipt.material_summary}</strong><span>{receipt.item_count} line item{receipt.item_count === 1 ? '' : 's'}</span></div></td>
          <td>{receipt.quantity_summary}</td>
          <td><span className="raw-material-document-count"><FileText size={14} /> {receipt.attachment_count}</span></td>
          <td className="amount">{money(receipt.purchase_cost_original, receipt.currency)}</td>
          <td className="amount"><strong>{azn.format(receipt.landed_cost_azn)}</strong></td>
          <td className="creator-cell">{receipt.created_by_email}</td>
          <td><div className="row-actions"><button className="button secondary compact-button" onClick={() => setSelectedReceiptId(receipt.id)}>View</button>{canDeleteOwnedRecord(role, currentUserId, receipt.created_by) && <button className="icon-button delete" onClick={() => setReceiptToDelete(receipt)} aria-label={`Delete delivery from ${receipt.supplier_name}`}><Trash2 size={15} /></button>}</div></td>
        </tr>)}
      </tbody>{!loading && <tfoot><tr><td colSpan={8} className="total-label">Filtered landed cost</td><td className="amount total-amount">{azn.format(filteredLandedCost)}</td><td colSpan={2} /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filteredReceipts.length} of {receipts.length} deliveries <span>Costs are informational and are not linked to company expenses</span></div>
    </section>

    {addOpen && <AddRawMaterialReceiptModal saving={saving} onClose={() => setAddOpen(false)} onSubmit={saveReceipt} />}
    {receiptToDelete && <DeleteRawMaterialReceiptModal receipt={receiptToDelete} deleting={deleting} onCancel={() => setReceiptToDelete(null)} onConfirm={confirmDelete} />}
  </>
}
