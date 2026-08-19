import { CalendarDays, Download, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { emptyFunding, fundingDirections } from './constants'
import { createOwnerFunding, getOwnerFunding, removeOwnerFunding } from './ownerFundingService'
import type { OwnerFunding, OwnerFundingInput } from './types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export function OwnerFundingModule() {
  const [funding, setFunding] = useState<OwnerFunding[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(`month:${currentMonth}`)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<OwnerFundingInput>(emptyFunding)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getOwnerFunding().then(setFunding).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])

  const periods = useMemo(() => {
    const months = [...new Set(funding.map((item) => item.funding_date.slice(0, 7)).concat(currentMonth))].sort().reverse()
    return { months, years: [...new Set(months.map((month) => month.slice(0, 4)))].sort().reverse() }
  }, [funding])
  const filtered = useMemo(() => funding.filter((item) => {
    const value = period.split(':')[1]
    return item.funding_date.startsWith(value) && `${item.owner_name} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
  }), [funding, search, period])
  const total = filtered.reduce((sum, item) => sum + (item.direction === 'incoming' ? Number(item.amount) : -Number(item.amount)), 0)

  async function addFunding(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { const item = await createOwnerFunding(form); setFunding((current) => [item, ...current]); setModalOpen(false); setForm(emptyFunding) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add owner funding.') }
    finally { setSaving(false) }
  }

  async function deleteFunding(id: string) {
    if (!window.confirm('Are you sure you want to delete this owner funding entry?')) return
    try { await removeOwnerFunding(id); setFunding((current) => current.filter((item) => item.id !== id)) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete owner funding.') }
  }

  function exportCsv() {
    const rows = [['Date', 'Owner', 'Description', 'Direction', 'Amount'], ...filtered.map((item) => [item.funding_date, item.owner_name, item.description ?? '', item.direction, String(item.amount)])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `owner-funding-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <>
    <header><div><p className="eyebrow">OWNER TRANSACTIONS</p><h1>Owner funding</h1><p>Record cash received from or paid to the company owner.</p></div><div className="header-actions"><button className="button secondary" onClick={exportCsv}><Download size={16} /> Export</button><button className="button primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Add transaction</button></div></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>Owner cash transactions</h3><p>Incoming contributions and outgoing payments</p></div><label className="period-select"><CalendarDays size={15} /><select value={period} onChange={(e) => setPeriod(e.target.value)}><optgroup label="Whole year">{periods.years.map((year) => <option key={year} value={`year:${year}`}>{year} — whole year</option>)}</optgroup><optgroup label="By month">{periods.months.map((month) => <option key={month} value={`month:${month}`}>{monthFormatter.format(new Date(`${month}-01T12:00:00`))}</option>)}</optgroup></select></label></div>
      <div className="toolbar"><label className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search owner funding..." /></label><span className="results">{filtered.length} entries</span></div>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Owner / description</th><th>Direction</th><th className="amount">Amount</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="empty">Loading funding…</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="empty">No funding entries for this period.</td></tr> : filtered.map((item) => <tr key={item.id}><td className="date-cell">{dateFormatter.format(new Date(`${item.funding_date}T12:00:00`))}</td><td><div className="merchant"><span className={`merchant-icon ${item.direction === 'incoming' ? 'green' : 'orange'}`}>{item.owner_name[0]}</span><div><strong>{item.owner_name}</strong><span>{item.description || 'No description'}</span></div></div></td><td><span className={`status ${item.direction === 'incoming' ? 'paid' : 'pending'}`}><i />{item.direction}</span></td><td className="amount"><strong>{item.direction === 'incoming' ? '+' : '−'}{currency.format(Number(item.amount))}</strong></td><td><button className="icon-button delete" onClick={() => deleteFunding(item.id)} title="Delete funding"><Trash2 size={15} /></button></td></tr>)}</tbody>{!loading && <tfoot><tr><td colSpan={3} className="total-label">Net owner cash flow</td><td className="amount total-amount">{currency.format(total)}</td><td /></tr></tfoot>}</table></div>
      <div className="panel-footer">Showing {filtered.length} of {funding.length} entries <span>Updated just now</span></div>
    </section>
    {modalOpen && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}><div className="modal"><div className="modal-head"><div><span className="modal-icon"><Plus size={20} /></span><div><h3>Add owner transaction</h3><p>Record incoming or outgoing owner cash</p></div></div><button className="icon-button" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form onSubmit={addFunding}><div className="form-grid"><label className="wide">Owner name<span>*</span><input autoFocus required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner's name" /></label><label>Date<span>*</span><input type="date" required value={form.funding_date} onChange={(e) => setForm({ ...form, funding_date: e.target.value })} /></label><label>Direction<span>*</span><select required value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as OwnerFundingInput['direction'] })}>{fundingDirections.map((direction) => <option key={direction} value={direction}>{direction === 'incoming' ? 'Incoming from owner' : 'Outgoing to owner'}</option>)}</select></label><label>Amount<span>*</span><div className="money-input"><span>₼</span><input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div></label><label className="wide">Description<textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Purpose of this transaction" /></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Add transaction'}</button></div></form></div></div>}
  </>
}
