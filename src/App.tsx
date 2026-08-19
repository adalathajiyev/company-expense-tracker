import { Banknote, HandCoins, Landmark, MoreHorizontal, ReceiptText, Settings, ShoppingBag, WalletCards } from 'lucide-react'
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

function App() {
  const [activeModule, setActiveModule] = useState<'expenses' | 'owner-funding' | 'sales' | 'debts' | 'salaries' | 'balance'>('expenses')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthLoading(false) })
    return () => data.subscription.unsubscribe()
  }, [])

  if (authLoading) return <div className="auth-page"><div className="auth-loading">Loading…</div></div>
  if (!session) return <AuthScreen />

  return <div className="app-shell">
    <aside>
      <div className="brand"><span className="brand-mark"><span /></span><span>Ledgerly</span></div>
      <nav>
        <button className={activeModule === 'expenses' ? 'active' : ''} onClick={() => setActiveModule('expenses')}><ReceiptText size={18} /> Expenses</button>
        <button className={activeModule === 'owner-funding' ? 'active' : ''} onClick={() => setActiveModule('owner-funding')}><Landmark size={18} /> Owner funding</button>
        <button className={activeModule === 'sales' ? 'active' : ''} onClick={() => setActiveModule('sales')}><ShoppingBag size={18} /> Sales</button>
        <button className={activeModule === 'debts' ? 'active' : ''} onClick={() => setActiveModule('debts')}><HandCoins size={18} /> Debts</button>
        <button className={activeModule === 'salaries' ? 'active' : ''} onClick={() => setActiveModule('salaries')}><Banknote size={18} /> Salaries</button>
        <button className={activeModule === 'balance' ? 'active' : ''} onClick={() => setActiveModule('balance')}><WalletCards size={18} /> Balance</button>
        <div className="nav-label">Workspace</div>
        <a><Settings size={18} /> Settings</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="profile"><div className="avatar">AM</div><div><strong>Atlas & Co.</strong><span>{session.user.email}</span></div><button className="icon-button sidebar-menu" title="Sign out" onClick={() => supabase.auth.signOut()}><MoreHorizontal size={18} /></button></div>
      </div>
    </aside>

    <main>{activeModule === 'expenses' ? <ExpensesModule /> : activeModule === 'owner-funding' ? <OwnerFundingModule /> : activeModule === 'sales' ? <SalesModule /> : activeModule === 'debts' ? <DebtsModule /> : activeModule === 'salaries' ? <SalariesModule /> : <BalanceModule />}</main>
  </div>
}

export default App
