import { ArrowLeft, FolderKanban, Link2, MapPin, Pencil, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDate } from '../../lib/businessDate'
import { sumMoney } from '../../lib/money'
import type { Expense } from '../expenses/types'
import { AssignExpensesModal } from './components/AssignExpensesModal'
import { ProjectModal } from './components/ProjectModal'
import { projectStatusLabels } from './constants'
import { assignExpensesToProject, createProject, getAssignableExpenses, getProjectExpenses, getProjects, updateProject } from './projectService'
import type { Project, ProjectInput } from './types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

export function ProjectsModule() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectExpenses, setProjectExpenses] = useState<Expense[]>([])
  const [assignableExpenses, setAssignableExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Current projects')
  const [projectModal, setProjectModal] = useState<Project | 'new' | null>(null)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [error, setError] = useState('')

  const loadProjects = useCallback(async () => {
    setError('')
    try {
      setProjects(await getProjects())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadProjects() }, [loadProjects])

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectExpenses([])
      return
    }
    let cancelled = false
    setDetailLoading(true)
    getProjectExpenses(selectedProjectId)
      .then((expenses) => { if (!cancelled) setProjectExpenses(expenses) })
      .catch((loadError: Error) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedProjectId])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const filteredProjects = useMemo(() => projects.filter((project) => {
    const matchesSearch = `${project.name} ${project.location} ${project.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All projects' || (statusFilter === 'Current projects' ? ['planned', 'active'].includes(project.status) : project.status === statusFilter)
    return matchesSearch && matchesStatus
  }), [projects, search, statusFilter])

  async function saveProject(input: ProjectInput) {
    setSaving(true)
    setError('')
    try {
      const saved = projectModal === 'new' ? await createProject(input) : await updateProject(projectModal!.id, input)
      setProjects((current) => projectModal === 'new' ? [...current, saved].sort((a, b) => a.name.localeCompare(b.name)) : current.map((project) => project.id === saved.id ? saved : project))
      setProjectModal(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the project.')
    } finally {
      setSaving(false)
    }
  }

  async function openAssignment() {
    setAssignmentOpen(true)
    setAssignmentLoading(true)
    setError('')
    try {
      setAssignableExpenses(await getAssignableExpenses())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load unassigned expenses.')
      setAssignmentOpen(false)
    } finally {
      setAssignmentLoading(false)
    }
  }

  async function attachExpenses(expenseIds: string[]) {
    if (!selectedProject) return
    setSaving(true)
    setError('')
    try {
      await assignExpensesToProject(selectedProject.id, expenseIds)
      const [nextProjects, nextExpenses] = await Promise.all([getProjects(), getProjectExpenses(selectedProject.id)])
      setProjects(nextProjects)
      setProjectExpenses(nextExpenses)
      setAssignmentOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not attach the expenses.')
    } finally {
      setSaving(false)
    }
  }

  if (selectedProject) {
    const expenseTotal = sumMoney(projectExpenses.map((expense) => Number(expense.amount)))
    return <>
      <header><div><button className="project-back" onClick={() => setSelectedProjectId(null)}><ArrowLeft size={15} /> All projects</button><p className="eyebrow">PROJECT DETAIL</p><h1>{selectedProject.name}</h1><p><MapPin size={14} /> {selectedProject.location}</p></div><div className="header-actions"><button className="button secondary" onClick={() => setProjectModal(selectedProject)}><Pencil size={16} /> Edit project</button><button className="button primary" onClick={() => void openAssignment()}><Link2 size={16} /> Attach expenses</button></div></header>
      {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

      <section className="project-detail-summary">
        <article><span>Status</span><strong className={`project-status ${selectedProject.status}`}>{projectStatusLabels[selectedProject.status]}</strong><small>Current project stage</small></article>
        <article><span>Estimated cost</span><strong>{selectedProject.estimated_cost === null ? 'Not set' : currency.format(Number(selectedProject.estimated_cost))}</strong><small>Optional project estimate</small></article>
        <article><span>Actual cost</span><strong>{currency.format(Number(selectedProject.actual_cost))}</strong><small>{selectedProject.expense_count} linked expense{Number(selectedProject.expense_count) === 1 ? '' : 's'}</small></article>
        <article><span>Variance</span><strong className={selectedProject.variance !== null && Number(selectedProject.variance) < 0 ? 'negative-amount' : ''}>{selectedProject.variance === null ? '—' : currency.format(Number(selectedProject.variance))}</strong><small>{selectedProject.variance === null ? 'Add an estimate to calculate' : Number(selectedProject.variance) < 0 ? 'Over estimate' : 'Remaining against estimate'}</small></article>
      </section>

      {selectedProject.description && <section className="project-description"><FolderKanban size={19} /><div><strong>Project notes</strong><p>{selectedProject.description}</p></div></section>}

      <section className="panel project-expense-history">
        <div className="panel-heading"><div><h3>Expense history</h3><p>All expenses linked to this project, sorted by the entered date</p></div><div className="project-cost-split"><span>Paid <strong>{currency.format(Number(selectedProject.paid_cost))}</strong></span><span>Pending <strong>{currency.format(Number(selectedProject.pending_cost))}</strong></span></div></div>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Merchant / description</th><th>Category</th><th>Payment</th><th>Status</th><th>Created by</th><th className="amount">Amount</th></tr></thead><tbody>
          {detailLoading ? <tr><td colSpan={7} className="empty">Loading project expenses…</td></tr> : projectExpenses.length === 0 ? <tr><td colSpan={7} className="empty">No expenses are linked to this project yet.</td></tr> : projectExpenses.map((expense) => <tr key={expense.id}><td className="date-cell">{formatDate(expense.expense_date)}</td><td><div className="project-expense-merchant"><strong>{expense.merchant}</strong><span>{expense.description || 'No description'}</span></div></td><td>{expense.category}</td><td>{expense.payment_method}</td><td><span className={`status ${expense.status}`}><i />{expense.status}</span></td><td className="creator-cell">{expense.created_by_email}</td><td className="amount"><strong>{currency.format(Number(expense.amount))}</strong></td></tr>)}
        </tbody>{!detailLoading && <tfoot><tr><td colSpan={6} className="total-label">Total project cost</td><td className="amount total-amount">{currency.format(expenseTotal)}</td></tr></tfoot>}</table></div>
      </section>

      {projectModal && projectModal !== 'new' && <ProjectModal project={projectModal} saving={saving} onClose={() => setProjectModal(null)} onSubmit={saveProject} />}
      {assignmentOpen && <AssignExpensesModal project={selectedProject} expenses={assignableExpenses} loading={assignmentLoading} saving={saving} onClose={() => setAssignmentOpen(false)} onSubmit={attachExpenses} />}
    </>
  }

  return <>
    <header><div><p className="eyebrow">PROJECT COSTS</p><h1>Projects</h1><p>Track each project’s estimated and actual expense cost.</p></div><button className="button primary" onClick={() => setProjectModal('new')}><Plus size={17} /> Add project</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>Project list</h3><p>Open a project to review its linked expense history</p></div></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects…" /></label><label className="filter project-status-filter"><FolderKanban size={16} /><select aria-label="Filter projects by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Current projects</option><option>All projects</option><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label><span className="results">{filteredProjects.length} projects</span></div>
      <div className="table-wrap project-list-table"><table><thead><tr><th>Project</th><th>Location</th><th>Status</th><th className="amount">Estimated cost</th><th className="amount">Actual cost</th><th className="amount">Variance</th><th className="amount">Expenses</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="empty">Loading projects…</td></tr> : filteredProjects.length === 0 ? <tr><td colSpan={8} className="empty">No projects match your filters.</td></tr> : filteredProjects.map((project) => <tr key={project.id}><td><div className="project-list-name"><strong>{project.name}</strong><span>{project.description || 'No project notes'}</span></div></td><td><span className="project-location"><MapPin size={13} /> {project.location}</span></td><td><span className={`project-status ${project.status}`}>{projectStatusLabels[project.status]}</span></td><td className="amount">{project.estimated_cost === null ? '—' : currency.format(Number(project.estimated_cost))}</td><td className="amount"><strong>{currency.format(Number(project.actual_cost))}</strong></td><td className={`amount ${project.variance !== null && Number(project.variance) < 0 ? 'negative-amount' : ''}`}>{project.variance === null ? '—' : currency.format(Number(project.variance))}</td><td className="amount">{project.expense_count}</td><td><button className="button secondary compact-button" onClick={() => setSelectedProjectId(project.id)}>View</button></td></tr>)}
      </tbody></table></div>
      <div className="panel-footer">Showing {filteredProjects.length} of {projects.length} projects <span>Actual cost includes paid and pending expenses</span></div>
    </section>
    {projectModal === 'new' && <ProjectModal saving={saving} onClose={() => setProjectModal(null)} onSubmit={saveProject} />}
  </>
}
