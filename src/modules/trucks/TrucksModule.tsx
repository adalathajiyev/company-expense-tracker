import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, CreditCard, Fuel, Plus, RefreshCw, Truck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDate } from '../../lib/businessDate'
import type { CashAccount } from '../cash-accounts/types'
import { getCashAccounts } from '../cash-accounts/cashAccountService'
import type { ProjectOption } from '../projects/types'
import { getProjectOptions } from '../projects/projectService'
import { AddFuelCardModal, AddFuelProviderModal, AddTruckModal, AllocateFuelCardModal, TopUpProviderModal } from './components/FleetModals'
import { createFuelCard, createFuelCardAllocation, createFuelProvider, createFuelProviderTopup, createTruck, getFuelCardBalances, getFuelCardLedger, getFuelProviderBalances, getTruckSummaries } from './truckService'
import type { FuelCardAllocationInput, FuelCardBalance, FuelCardInput, FuelCardLedgerEntry, FuelProviderBalance, FuelProviderInput, FuelProviderTopupInput, TruckInput, TruckSummary } from './types'
import { fuelCardAssignmentLabels, getFuelCardAssignment } from './types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN' })

export function TrucksModule() {
  const [trucks, setTrucks] = useState<TruckSummary[]>([])
  const [providers, setProviders] = useState<FuelProviderBalance[]>([])
  const [cards, setCards] = useState<FuelCardBalance[]>([])
  const [ledger, setLedger] = useState<FuelCardLedgerEntry[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [truckModalOpen, setTruckModalOpen] = useState(false)
  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [topupProvider, setTopupProvider] = useState<FuelProviderBalance | null>(null)
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [error, setError] = useState('')

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextTrucks, nextProviders, nextCards, nextLedger, nextProjects, nextAccounts] = await Promise.all([getTruckSummaries(), getFuelProviderBalances(), getFuelCardBalances(), getFuelCardLedger(), getProjectOptions(), getCashAccounts()])
      setTrucks(nextTrucks)
      setProviders(nextProviders)
      setCards(nextCards)
      setLedger(nextLedger)
      setProjects(nextProjects)
      setCashAccounts(nextAccounts)
      setSelectedCardId((current) => nextCards.some((card) => card.id === current) ? current : nextCards[0]?.id ?? '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load trucks and fuel balances.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  const totalPrepaid = useMemo(() => providers.reduce((sum, provider) => sum + Number(provider.total_prepaid_balance), 0), [providers])
  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? null
  const selectedLedger = ledger.filter((entry) => entry.card_id === selectedCardId)

  async function save(action: () => Promise<void>, close: () => void) {
    setSaving(true)
    setError('')
    try {
      await action()
      close()
      await loadWorkspace()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the fleet change.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <header><div><p className="eyebrow">FLEET & PREPAID FUEL</p><h1>Trucks & fuel</h1><p>Manage trucks, petrol providers, fuel cards, and verified fuel costs.</p></div><div className="header-actions"><button className="button secondary" disabled={loading} onClick={() => void loadWorkspace()}><RefreshCw size={16} /> Refresh</button><button className="button secondary" onClick={() => setProviderModalOpen(true)}><Fuel size={16} /> Add provider</button><button className="button secondary" disabled={providers.length === 0} onClick={() => setCardModalOpen(true)}><CreditCard size={16} /> Add card</button><button className="button primary" onClick={() => setTruckModalOpen(true)}><Plus size={16} /> Add truck</button></div></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <section className="fuel-total-summary"><div><span>Total prepaid fuel balance</span><strong>{loading ? 'Loading…' : currency.format(totalPrepaid)}</strong><small>Provider main balances plus balances allocated to cards</small></div><span className="balance-hero-icon"><Fuel size={27} /></span></section>

    <section className="fuel-provider-grid">
      {loading ? <div className="fuel-empty-card">Loading petrol providers…</div> : providers.length === 0 ? <div className="fuel-empty-card">Add the two petrol providers your company works with.</div> : providers.map((provider) => <article key={provider.id} className="fuel-provider-card"><span><small>Petrol provider</small><i className={provider.is_active ? 'active' : ''}>{provider.is_active ? 'Active' : 'Inactive'}</i></span><h3>{provider.name}</h3><div><span><small>Main platform</small><strong>{currency.format(Number(provider.main_balance))}</strong></span><span><small>Across cards</small><strong>{currency.format(Number(provider.cards_balance))}</strong></span></div><footer><small>{provider.last_topup_date ? `Last top-up ${formatDate(provider.last_topup_date)}` : 'No top-ups recorded'}</small><button className="button secondary compact-button" disabled={!provider.is_active} onClick={() => setTopupProvider(provider)}><Plus size={14} /> Top up</button></footer></article>)}
    </section>

    <section className="panel fuel-cards-panel"><div className="panel-heading"><div><h3>Fuel cards</h3><p>Balances allocated from each provider platform</p></div><button className="button secondary compact-button" disabled={cards.filter((card) => card.is_active).length === 0} onClick={() => setAllocationOpen(true)}><ArrowRightLeft size={15} /> Move balance</button></div><div className="table-wrap fuel-cards-table"><table><thead><tr><th>Card</th><th>Provider</th><th>Assignment</th><th>Custodian</th><th>Status</th><th className="amount">Allocated</th><th className="amount">Fuel used</th><th className="amount">Balance</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="empty">Loading cards…</td></tr> : cards.length === 0 ? <tr><td colSpan={8} className="empty">No fuel cards have been added.</td></tr> : cards.map((card) => <tr key={card.id} className={selectedCardId === card.id ? 'selected-table-row' : ''} onClick={() => setSelectedCardId(card.id)}><td><div className="fuel-card-name"><strong>{card.name}</strong><span>{card.card_number}</span></div></td><td>{card.provider_name}</td><td><span className="category blue">{fuelCardAssignmentLabels[card.assignment_type]}</span><small className="fuel-assignment-name">{getFuelCardAssignment(card)}</small></td><td>{card.custodian_name || '—'}</td><td><span className={`status ${card.is_active ? 'paid' : 'pending'}`}><i />{card.is_active ? 'active' : 'inactive'}</span></td><td className="amount">{currency.format(Number(card.allocated_amount) - Number(card.returned_amount))}</td><td className="amount">{currency.format(Number(card.purchased_amount))}</td><td className={`amount ${Number(card.balance) < 0 ? 'negative-amount' : 'cash-entry-inflow'}`}><strong>{currency.format(Number(card.balance))}</strong></td></tr>)}</tbody></table></div></section>

    {selectedCard && <section className="panel fuel-ledger-panel"><div className="panel-heading"><div><h3>{selectedCard.name} ledger</h3><p>{selectedCard.provider_name} · {getFuelCardAssignment(selectedCard)}</p></div><button className="button secondary compact-button" onClick={() => setAllocationOpen(true)}><ArrowRightLeft size={15} /> Move balance</button></div><div className="table-wrap fuel-ledger-table"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Recorded by</th><th className="amount">Movement</th><th /></tr></thead><tbody>{selectedLedger.length === 0 ? <tr><td colSpan={6} className="empty">No card movements or purchases yet.</td></tr> : selectedLedger.map((entry) => <tr key={entry.entry_key}><td className="date-cell">{formatDate(entry.transaction_date)}</td><td><span className={`category ${entry.kind === 'fuel_purchase' ? 'orange' : 'green'}`}>{entry.kind.replace(/_/g, ' ')}</span></td><td>{entry.description}</td><td className="creator-cell">{entry.created_by_email}</td><td className={`amount cash-entry-${entry.direction}`}><strong>{entry.direction === 'inflow' ? '+' : '−'}{currency.format(Number(entry.amount))}</strong></td><td className="amount">{entry.direction === 'inflow' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</td></tr>)}</tbody></table></div><div className="panel-footer">{selectedLedger.length} ledger {selectedLedger.length === 1 ? 'entry' : 'entries'}<span>Current balance: {currency.format(Number(selectedCard.balance))}</span></div></section>}

    <section className="panel trucks-panel"><div className="panel-heading"><div><h3>Truck cost overview</h3><p>Expenses and fuel readings linked to each truck</p></div></div><div className="table-wrap trucks-table"><table><thead><tr><th>Truck</th><th>Make / model</th><th>Tank capacity</th><th>Status</th><th className="amount">Fuel purchased</th><th className="amount">Latest tank reading</th><th className="amount">Fuel cost</th><th className="amount">Total cost</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="empty">Loading trucks…</td></tr> : trucks.length === 0 ? <tr><td colSpan={8} className="empty">No trucks have been added.</td></tr> : trucks.map((truck) => <tr key={truck.id}><td><div className="truck-name"><span className="truck-icon"><Truck size={16} /></span><div><strong>{truck.name}</strong><span>{truck.registration_number}</span></div></div></td><td>{truck.make_model || '—'}</td><td>{Number(truck.tank_capacity_liters)} L</td><td><span className={`status ${truck.is_active ? 'paid' : 'pending'}`}><i />{truck.is_active ? 'active' : 'inactive'}</span></td><td className="amount">{Number(truck.fuel_liters).toLocaleString('en-US', { maximumFractionDigits: 3 })} L</td><td className="amount">{truck.latest_tank_reading_liters === null ? '—' : <><strong>{Number(truck.latest_tank_reading_liters).toLocaleString('en-US', { maximumFractionDigits: 2 })} L</strong>{truck.last_tank_reading_date && <small className="fuel-assignment-name">{formatDate(truck.last_tank_reading_date)}</small>}</>}</td><td className="amount">{currency.format(Number(truck.fuel_cost))}</td><td className="amount"><strong>{currency.format(Number(truck.total_cost))}</strong></td></tr>)}</tbody></table></div></section>

    {truckModalOpen && <AddTruckModal saving={saving} onClose={() => setTruckModalOpen(false)} onSubmit={(input: TruckInput) => save(() => createTruck(input), () => setTruckModalOpen(false))} />}
    {providerModalOpen && <AddFuelProviderModal saving={saving} onClose={() => setProviderModalOpen(false)} onSubmit={(input: FuelProviderInput) => save(() => createFuelProvider(input), () => setProviderModalOpen(false))} />}
    {cardModalOpen && <AddFuelCardModal providers={providers} trucks={trucks} projects={projects} cashAccounts={cashAccounts} saving={saving} onClose={() => setCardModalOpen(false)} onSubmit={(input: FuelCardInput) => save(() => createFuelCard(input), () => setCardModalOpen(false))} />}
    {topupProvider && <TopUpProviderModal provider={topupProvider} saving={saving} onClose={() => setTopupProvider(null)} onSubmit={(input: FuelProviderTopupInput) => save(() => createFuelProviderTopup(input), () => setTopupProvider(null))} />}
    {allocationOpen && <AllocateFuelCardModal cards={cards} providers={providers} initialCardId={selectedCardId} saving={saving} onClose={() => setAllocationOpen(false)} onSubmit={(input: FuelCardAllocationInput) => save(() => createFuelCardAllocation(input), () => setAllocationOpen(false))} />}
  </>
}
