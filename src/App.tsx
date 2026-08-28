import { Banknote, FolderKanban, Fuel, HandCoins, Landmark, LockKeyhole, LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, ReceiptText, ShieldCheck, ShoppingBag, Users, WalletCards } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { supabase } from './lib/supabase'
import { getSessionExpiryTime, hasSessionExpired, SESSION_EXPIRED_MESSAGE } from './lib/sessionExpiry'
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
import { CashAccountsModule } from './modules/cash-accounts/CashAccountsModule'
import { ProjectsModule } from './modules/projects/ProjectsModule'
import { BridgeLogo } from './components/BridgeLogo'
import { TrucksModule } from './modules/trucks/TrucksModule'

type ModuleId = 'expenses' | 'projects' | 'trucks' | 'owner-funding' | 'sales' | 'customers' | 'debts' | 'salaries' | 'balance' | 'cash-accounts' | 'access'

function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('expenses')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [role, setRole] = useState<AppRole | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleError, setRoleError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const expirySignOutPending = useRef(false)
  const currentUserId = session?.user.id ?? null

  const expireCurrentSession = useCallback(() => {
    setSession(null)
    setAuthLoading(false)
    setAuthError(SESSION_EXPIRED_MESSAGE)

    if (expirySignOutPending.current) return
    expirySignOutPending.current = true

    // Defer the Auth call so it never runs inside an onAuthStateChange callback.
    window.setTimeout(() => {
      void supabase.auth.signOut({ scope: 'local' })
        .then(({ error }) => {
          if (error) setAuthError(`${SESSION_EXPIRED_MESSAGE} ${error.message}`)
        })
        .finally(() => { expirySignOutPending.current = false })
    }, 0)
  }, [])

  useEffect(() => {
    let cancelled = false

    function applySession(nextSession: Session | null) {
      if (cancelled) return
      if (nextSession && hasSessionExpired(nextSession.user.last_sign_in_at)) {
        expireCurrentSession()
        return
      }

      if (nextSession) setAuthError('')
      setSession(nextSession)
      setAuthLoading(false)
    }

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setAuthError(error.message)
          setSession(null)
          setAuthLoading(false)
          return
        }
        applySession(data.session)
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setAuthError(error.message)
          setSession(null)
          setAuthLoading(false)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession))
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [expireCurrentSession])

  useEffect(() => {
    if (!session) return

    const expiresAt = getSessionExpiryTime(session.user.last_sign_in_at)
    if (expiresAt === null || expiresAt <= Date.now()) {
      expireCurrentSession()
      return
    }

    const verifySessionAge = () => {
      if (hasSessionExpired(session.user.last_sign_in_at)) expireCurrentSession()
    }
    const verifyVisibleSessionAge = () => {
      if (document.visibilityState === 'visible') verifySessionAge()
    }
    const expiryTimer = window.setTimeout(expireCurrentSession, expiresAt - Date.now())

    window.addEventListener('focus', verifySessionAge)
    document.addEventListener('visibilitychange', verifyVisibleSessionAge)
    return () => {
      window.clearTimeout(expiryTimer)
      window.removeEventListener('focus', verifySessionAge)
      document.removeEventListener('visibilitychange', verifyVisibleSessionAge)
    }
  }, [expireCurrentSession, session])

  useEffect(() => {
    if (!currentUserId) {
      setRole(null)
      setRoleLoading(false)
      setRoleError('')
      return
    }

    let cancelled = false
    setRoleLoading(true)
    setRoleError('')
    getCurrentUserRole(currentUserId)
      .then((nextRole) => { if (!cancelled) setRole(nextRole) })
      .catch((error: Error) => { if (!cancelled) setRoleError(error.message) })
      .finally(() => { if (!cancelled) setRoleLoading(false) })

    return () => { cancelled = true }
  }, [currentUserId])

  if (authLoading || (session && roleLoading)) return <div className="auth-page"><div className="auth-loading">Loading…</div></div>
  if (!session) return <AuthScreen initialError={authError} />

  if (roleError || !role) return <div className="auth-page"><div className="auth-card">
    <div className="brand auth-brand"><BridgeLogo /><span className="brand-wordmark">Bridge</span></div>
    <span className="auth-icon"><LockKeyhole size={22} /></span>
    <h1>Access not assigned</h1>
    <p>{roleError || 'Your account does not have an application role yet. Ask an administrator to assign one.'}</p>
    <button className="button secondary access-sign-out" onClick={() => supabase.auth.signOut()}>Sign out</button>
  </div></div>

  const fullAccess = hasFullAccess(role)
  const canManageAccess = role === 'admin'
  const isProjectLead = role === 'project_lead'
  const allowedModules: ModuleId[] = fullAccess
    ? ['expenses', 'projects', 'trucks', 'owner-funding', 'sales', 'customers', 'debts', 'salaries', 'balance', 'cash-accounts', ...(canManageAccess ? ['access' as const] : [])]
    : isProjectLead ? ['expenses', 'cash-accounts'] : ['sales', 'customers']
  const visibleModule: ModuleId = allowedModules.includes(activeModule) ? activeModule : allowedModules[0]

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside>
      <div className="brand"><BridgeLogo /><span className="brand-wordmark">Bridge</span></div>
      <button className="sidebar-collapse" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="primary-navigation" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
      <div className="mobile-controls">
        <select aria-label="Select module" value={visibleModule} onChange={(event) => setActiveModule(event.target.value as ModuleId)}>
          {(fullAccess || isProjectLead) && <option value="expenses">Expenses</option>}
          {fullAccess && <option value="projects">Projects</option>}
          {fullAccess && <option value="trucks">Trucks & fuel</option>}
          {fullAccess && <option value="owner-funding">Owner funding</option>}
          <option value="sales">Sales</option>
          <option value="customers">Customers</option>
          {fullAccess && <option value="debts">Debts</option>}
          {fullAccess && <option value="salaries">Salaries</option>}
          {fullAccess && <option value="balance">Balance</option>}
          {(fullAccess || isProjectLead) && <option value="cash-accounts">Cash accounts</option>}
          {canManageAccess && <option value="access">Access</option>}
        </select>
        <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>
      </div>
      <nav id="primary-navigation">
        {(fullAccess || isProjectLead) && <button title="Expenses" className={visibleModule === 'expenses' ? 'active' : ''} onClick={() => setActiveModule('expenses')}><ReceiptText size={18} /> Expenses</button>}
        {fullAccess && <button title="Projects" className={visibleModule === 'projects' ? 'active' : ''} onClick={() => setActiveModule('projects')}><FolderKanban size={18} /> Projects</button>}
        {fullAccess && <button title="Trucks & fuel" className={visibleModule === 'trucks' ? 'active' : ''} onClick={() => setActiveModule('trucks')}><Fuel size={18} /> Trucks & fuel</button>}
        {fullAccess && <button title="Owner funding" className={visibleModule === 'owner-funding' ? 'active' : ''} onClick={() => setActiveModule('owner-funding')}><Landmark size={18} /> Owner funding</button>}
        <button title="Sales" className={visibleModule === 'sales' ? 'active' : ''} onClick={() => setActiveModule('sales')}><ShoppingBag size={18} /> Sales</button>
        <button title="Customers" className={visibleModule === 'customers' ? 'active' : ''} onClick={() => setActiveModule('customers')}><Users size={18} /> Customers</button>
        {fullAccess && <button title="Debts" className={visibleModule === 'debts' ? 'active' : ''} onClick={() => setActiveModule('debts')}><HandCoins size={18} /> Debts</button>}
        {fullAccess && <button title="Salaries" className={visibleModule === 'salaries' ? 'active' : ''} onClick={() => setActiveModule('salaries')}><Banknote size={18} /> Salaries</button>}
        {fullAccess && <button title="Balance" className={visibleModule === 'balance' ? 'active' : ''} onClick={() => setActiveModule('balance')}><WalletCards size={18} /> Balance</button>}
        {(fullAccess || isProjectLead) && <button title="Cash accounts" className={visibleModule === 'cash-accounts' ? 'active' : ''} onClick={() => setActiveModule('cash-accounts')}><WalletCards size={18} /> Cash accounts</button>}
        {canManageAccess && <><div className="nav-label">Administration</div><button title="Access" className={visibleModule === 'access' ? 'active' : ''} onClick={() => setActiveModule('access')}><ShieldCheck size={18} /> Access</button></>}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile"><div className="avatar">AM</div><div><strong>{roleLabels[role]}</strong><span>{session.user.email}</span></div><button className="icon-button sidebar-menu" title="Sign out" onClick={() => supabase.auth.signOut()}><MoreHorizontal size={18} /></button></div>
      </div>
    </aside>

    <main>{visibleModule === 'expenses' ? <ExpensesModule role={role} currentUserId={session.user.id} /> : visibleModule === 'projects' ? <ProjectsModule /> : visibleModule === 'trucks' ? <TrucksModule /> : visibleModule === 'owner-funding' ? <OwnerFundingModule role={role} currentUserId={session.user.id} /> : visibleModule === 'sales' ? <SalesModule role={role} currentUserId={session.user.id} /> : visibleModule === 'customers' ? <CustomersModule role={role} currentUserId={session.user.id} /> : visibleModule === 'debts' ? <DebtsModule /> : visibleModule === 'salaries' ? <SalariesModule /> : visibleModule === 'cash-accounts' ? <CashAccountsModule role={role} /> : visibleModule === 'access' ? <AccessModule currentUserId={session.user.id} /> : <BalanceModule />}</main>
  </div>
}

export default App
