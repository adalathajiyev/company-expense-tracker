import { CalendarDays, Download, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createEmptyFunding, fundingDirections } from './constants'
import { createOwnerFunding, getOwnerFunding, removeOwnerFunding } from './ownerFundingService'
import type { OwnerFunding, OwnerFundingInput } from './types'
import { canDeleteOwnedRecord, type AppRole } from '../access/types'
import { formatDate, getBusinessDate, getBusinessMonth } from '../../lib/businessDate'
import { sumMoney } from '../../lib/money'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

interface Props { role: AppRole; currentUserId: string }

export function OwnerFundingModule({ role, currentUserId }: Props) {
  const currentMonth = getBusinessMonth()
  const [funding, setFunding] = useState<OwnerFunding[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<OwnerFundingInput>(createEmptyFunding)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getOwnerFunding().then(setFunding).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])

  const periods = useMemo(() => {
    const months = [...new Set(funding.map((item) => item.funding_date.slice(0, 7)).concat(currentMonth))].sort().reverse()
    return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() }
  }, [funding, currentMonth])
  const ownerNames = useMemo(() => {
    const seen = new Set<string>()
    return funding.flatMap((item) => {
      const ownerName = item.owner_name.trim()
      const normalizedName = ownerName.toLocaleLowerCase()
      if (!ownerName || seen.has(normalizedName)) return []
      seen.add(normalizedName)
      return [ownerName]
    })
  }, [funding])
  const filtered = useMemo(() => funding.filter((item) => {
    const value = period.split(':')[1]
    return item.funding_date.startsWith(value) && `${item.owner_name} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
  }), [funding, search, period])
  const total = sumMoney(filtered.map((item) => item.direction === 'incoming' ? Number(item.amount) : -Number(item.amount)))

  async function addFunding(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { const item = await createOwnerFunding(form); setFunding((current) => [item, ...current]); setModalOpen(false); setForm(createEmptyFunding()) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add owner funding.') }
    finally { setSaving(false) }
  }

  async function deleteFunding(id: string) {
    if (!window.confirm('Are you sure you want to delete this owner funding entry?')) return
    try { await removeOwnerFunding(id); setFunding((current) => current.filter((item) => item.id !== id)) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete owner funding.') }
  }

  function exportCsv() {
    const rows = [['Date', 'Owner', 'Description', 'Direction', 'Created by', 'Amount'], ...filtered.map((item) => [formatDate(item.funding_date), item.owner_name, item.description ?? '', item.direction, item.created_by_email, String(item.amount)])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `owner-funding-${getBusinessDate()}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <>
    <header><div><p className="eyebrow">OWNER TRANSACTIONS</p><h1>Owner funding</h1><p>Record cash received from or paid to the company owner.</p></div><div className="header-actions"><button className="button secondary" onClick={exportCsv}><Download size={16} /> Export</button><button className="button primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add transaction</button></div></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>Owner cash transactions</h3><p>Incoming contributions and outgoing payments</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(e) => setPeriod(e.target.value)}><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search owner funding..." /></label><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Owner / description</th><th>Direction</th><th>Created by</th><th className="amount">Amount</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="empty">Loading funding…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="empty">No funding entries for this period.</td></tr> : filtered.map((item) => { const canDelete = canDeleteOwnedRecord(role, currentUserId, item.created_by); return <tr key={item.id}><td className="date-cell">{formatDate(item.funding_date)}</td><td><div className="merchant"><span className={`merchant-icon ${item.direction === 'incoming' ? 'green' : 'orange'}`}>{item.owner_name[0]}</span><div><strong>{item.owner_name}</strong><span>{item.description || 'No description'}</span></div></div></td><td><span className={`status ${item.direction === 'incoming' ? 'paid' : 'pending'}`}><i />{item.direction}</span></td><td className="creator-cell">{item.created_by_email}</td><td className="amount"><strong>{item.direction === 'incoming' ? '+' : '−'}{currency.format(Number(item.amount))}</strong></td><td><button className="icon-button delete" disabled={!canDelete} onClick={() => deleteFunding(item.id)} title={canDelete ? 'Delete funding' : 'Only the creator or an Admin can delete this entry'}><Trash2 size={15} /></button></td></tr> })}</tbody>{!loading && <tfoot><tr><td colSpan={4} className="total-label">Net owner cash flow</td><td className="amount total-amount">{currency.format(total)}</td><td /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {funding.length} entries <span>Updated just now</span></div>
    </section>
    {modalOpen && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}><div className="modal"><div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add owner transaction</h3><p>Record incoming or outgoing owner cash</p></div></div><button className="icon-button" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form onSubmit={addFunding}><div className="form-grid"><label className="wide">Owner name<span>*</span><input autoFocus required list="owner-funding-owner-suggestions" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner's name" /><datalist id="owner-funding-owner-suggestions">{ownerNames.map((ownerName) => <option key={ownerName} value={ownerName} />)}</datalist></label><label>Date<span>*</span><input type="date" required value={form.funding_date} onChange={(e) => setForm({ ...form, funding_date: e.target.value })} /></label><label>Direction<span>*</span><select required value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as OwnerFundingInput['direction'] })}>{fundingDirections.map((direction) => <option key={direction} value={direction}>{direction === 'incoming' ? 'Incoming from owner' : 'Outgoing to owner'}</option>)}</select></label><label>Amount<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })} /></div></label><label className="wide">Description<textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Purpose of this transaction" /></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add transaction'}</button></div></form></div></div>}
  </>
}
