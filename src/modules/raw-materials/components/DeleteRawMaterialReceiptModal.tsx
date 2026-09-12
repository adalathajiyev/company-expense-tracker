import { Trash2, X } from 'lucide-react'
import type { RawMaterialReceiptSummary } from '../types'

interface Props {
  receipt: RawMaterialReceiptSummary
  deleting: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteRawMaterialReceiptModal({ receipt, deleting, onCancel, onConfirm }: Props) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleting && onCancel()}>
    <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-material-receipt-title">
      <div className="modal-head">
        <div><span className="modal-icon danger"><Trash2 size={20} /></span><div><h3 id="delete-material-receipt-title">Delete delivery?</h3><p>Its items, costs, and documents will also be removed.</p></div></div>
        <button className="icon-button" disabled={deleting} onClick={onCancel} aria-label="Close"><X size={19} /></button>
      </div>
      <div className="confirm-copy">Are you sure you want to delete the material delivery from <strong>{receipt.supplier_name}</strong>?</div>
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={deleting} onClick={onCancel}>Cancel</button>
        <button type="button" className="button danger-button" disabled={deleting} onClick={onConfirm}>{deleting ? 'Deleting…' : 'Delete delivery'}</button>
      </div>
    </div>
  </div>
}
