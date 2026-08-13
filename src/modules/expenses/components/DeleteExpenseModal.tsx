import { Trash2, X } from 'lucide-react'
import type { Expense } from '../types'

interface Props {
  expense: Expense
  deleting: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteExpenseModal({ expense, deleting, onCancel, onConfirm }: Props) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleting && onCancel()}>
    <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-expense-title">
      <div className="modal-head">
        <div><span className="modal-icon danger"><Trash2 size={20} /></span><div><h3 id="delete-expense-title">Delete expense?</h3><p>This action cannot be undone.</p></div></div>
        <button className="icon-button" disabled={deleting} onClick={onCancel} aria-label="Close"><X size={19} /></button>
      </div>
      <div className="confirm-copy">Are you sure you want to delete the expense from <strong>{expense.merchant}</strong>?</div>
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={deleting} onClick={onCancel}>Cancel</button>
        <button type="button" className="button danger-button" disabled={deleting} onClick={onConfirm}>{deleting ? 'Deleting…' : 'Delete expense'}</button>
      </div>
    </div>
  </div>
}
