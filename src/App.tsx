import { Banknote, HandCoins, Landmark, LockKeyhole, LogOut, MoreHorizontal, ReceiptText, ShieldCheck, ShoppingBag, Users, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { supabase } from './lib/supabase'
import { ExpensesModule } from './modules/expenses/ExpensesModule'
import { OwnerFundingModule } from './modules/owner-funding/OwnerFundingModule'
import { SalesModule } from './modules/sales/SalesModule'
import { BalanceModule } from './modules/balance/BalanceModule'
import { DebtsModule } from './modules/debts/DebtsModule'
import { SalariesModule } from './modules/salaries/SalariesModule'
import { getCurrentUserRole } from './modules/access/accessService'
import { hasFullAccess, roleLabels, type AppRole } from './modules/access/types'
import { AccessModule } from './modules/access/AccessModule'
import { CustomersModule } from './modules/customers/CustomersModule'

type ModuleId = 'expenses' | 'owner-funding' | 'sales' | 'customers' | 'debts' | 'salaries' | 'balance' | 'access'

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('expenses')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [role, setRole] = useState<AppRole | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleError, setRoleError] = useState('')

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) setAuthError(error.message)
        setSession(data.session)
      })
      .catch((error: Error) => setAuthError(error.message))
      .finally(() => setAuthLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setAuthError(''); setSession(nextSession); setAuthLoading(false) })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setRole(null)
      setRoleLoading(false)
      setRoleError('')
      return
    }

    let cancelled = false
    setRoleLoading(true)
    setRoleError('')
    getCurrentUserRole(session.user.id)
      .then((nextRole) => { if (!cancelled) setRole(nextRole) })
      .catch((error: Error) => { if (!cancelled) setRoleError(error.message) })
      .finally(() => { if (!cancelled) setRoleLoading(false) })

    return () => { cancelled = true }
  }, [session])

  if (authLoading || (session && roleLoading)) return <div className="auth-page"><div className="auth-loading">Loading…</div></div>
  if (!session) return <AuthScreen initialError={authError} />

  if (roleError || !role) return <div className="auth-page"><div className="auth-card">
    <div className="brand auth-brand"><span className="brand-mark"><span /></span><span>Ledgerly</span></div>
    <span className="auth-icon"><LockKeyhole size={22} /></span>
    <h1>Access not assigned</h1>
    <p>{roleError || 'Your account does not have an application role yet. Ask an administrator to assign one.'}</p>
    <button className="button secondary access-sign-out" onClick={() => supabase.auth.signOut()}>Sign out</button>
  </div></div>

  const fullAccess = hasFullAccess(role)
  const canManageAccess = role === 'admin'
  const visibleModule: ModuleId = !fullAccess
    ? activeModule === 'customers' ? 'customers' : 'sales'
    : activeModule === 'access' && !canManageAccess ? 'expenses' : activeModule

  return <div className="app-shell">
    <aside>
      <div className="brand"><span className="brand-mark"><span /></span><span>Ledgerly</span></div>
      <div className="mobile-controls">
        <select aria-label="Select module" value={visibleModule} onChange={(event) => setActiveModule(event.target.value as ModuleId)}>
          {fullAccess && <option value="expenses">Expenses</option>}
          {fullAccess && <option value="owner-funding">Owner funding</option>}
          <option value="sales">Sales</option>
          <option value="customers">Customers</option>
          {fullAccess && <option value="debts">Debts</option>}
          {fullAccess && <option value="salaries">Salaries</option>}
          {fullAccess && <option value="balance">Balance</option>}
          {canManageAccess && <option value="access">Access</option>}
        </select>
        <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>
      </div>
      <nav>
        {fullAccess && <button className={visibleModule === 'expenses' ? 'active' : ''} onClick={() => setActiveModule('expenses')}><ReceiptText size={18} /> Expenses</button>}
        {fullAccess && <button className={visibleModule === 'owner-funding' ? 'active' : ''} onClick={() => setActiveModule('owner-funding')}><Landmark size={18} /> Owner funding</button>}
        <button className={visibleModule === 'sales' ? 'active' : ''} onClick={() => setActiveModule('sales')}><ShoppingBag size={18} /> Sales</button>
        <button className={visibleModule === 'customers' ? 'active' : ''} onClick={() => setActiveModule('customers')}><Users size={18} /> Customers</button>
        {fullAccess && <button className={visibleModule === 'debts' ? 'active' : ''} onClick={() => setActiveModule('debts')}><HandCoins size={18} /> Debts</button>}
        {fullAccess && <button className={visibleModule === 'salaries' ? 'active' : ''} onClick={() => setActiveModule('salaries')}><Banknote size={18} /> Salaries</button>}
        {fullAccess && <button className={visibleModule === 'balance' ? 'active' : ''} onClick={() => setActiveModule('balance')}><WalletCards size={18} /> Balance</button>}
        {canManageAccess && <><div className="nav-label">Administration</div><button className={visibleModule === 'access' ? 'active' : ''} onClick={() => setActiveModule('access')}><ShieldCheck size={18} /> Access</button></>}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile"><div className="avatar">AM</div><div><strong>{roleLabels[role]}</strong><span>{session.user.email}</span></div><button className="icon-button sidebar-menu" title="Sign out" onClick={() => supabase.auth.signOut()}><MoreHorizontal size={18} /></button></div>
      </div>
    </aside>

    <main>{visibleModule === 'expenses' ? <ExpensesModule role={role} currentUserId={session.user.id} /> : visibleModule === 'owner-funding' ? <OwnerFundingModule role={role} currentUserId={session.user.id} /> : visibleModule === 'sales' ? <SalesModule role={role} currentUserId={session.user.id} /> : visibleModule === 'customers' ? <CustomersModule role={role} currentUserId={session.user.id} /> : visibleModule === 'debts' ? <DebtsModule /> : visibleModule === 'salaries' ? <SalariesModule /> : visibleModule === 'access' ? <AccessModule currentUserId={session.user.id} /> : <BalanceModule />}</main>
  </div>
}

export default App
