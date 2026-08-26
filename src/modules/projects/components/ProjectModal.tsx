import { FolderKanban, X } from 'lucide-react'
import { useState } from 'react'
import { createEmptyProject, projectStatuses, projectStatusLabels } from '../constants'
import type { Project, ProjectInput } from '../types'

interface Props {
  project?: Project | null
  saving: boolean
  onClose: () => void
  onSubmit: (input: ProjectInput) => Promise<void>
}

export function ProjectModal({ project, saving, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ProjectInput>(() => project ? {
    name: project.name,
    location: project.location,
    status: project.status,
    estimated_cost: project.estimated_cost === null ? null : Number(project.estimated_cost),
    description: project.description,
  } : createEmptyProject())

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal project-modal">
      <div className="modal-head"><div><span className="modal-icon"><FolderKanban size={20} /></span><div><h3>{project ? 'Edit project' : 'Add a new project'}</h3><p>{project ? 'Update project details and status' : 'Create a cost centre for linked expenses'}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
      <form onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit({
          ...form,
          name: form.name.trim(),
          location: form.location.trim(),
          description: form.description?.trim() || null,
        })
      }}>
        <div className="form-grid">
          <label className="wide">Project name<span>*</span><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Quba wooden house" /></label>
          <label>Location<span>*</span><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="e.g. Quba" /></label>
          <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectInput['status'] })}>{projectStatuses.map((status) => <option key={status} value={status}>{projectStatusLabels[status]}</option>)}</select></label>
          <label className="wide">Estimated cost <small className="optional-label">Optional</small><div className="money-input"><span>₼</span><input type="number" min="0" step="0.01" value={form.estimated_cost ?? ''} onChange={(event) => setForm({ ...form, estimated_cost: event.target.value === '' ? null : Number(event.target.value) })} placeholder="0.00" /></div></label>
          <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Scope, customer, or other useful project notes" /></label>
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button disabled={saving} className="button primary">{saving ? 'Saving…' : project ? 'Save changes' : 'Add project'}</button></div>
      </form>
    </div>
  </div>
}
