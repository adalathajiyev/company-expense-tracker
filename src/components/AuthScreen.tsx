import { useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BridgeLogo } from './BridgeLogo'

interface Props { initialError?: string }

export function AuthScreen({ initialError = '' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return <div className="auth-page">
    <div className="auth-card">
      <div className="brand auth-brand"><BridgeLogo /><span className="brand-wordmark">Bridge</span></div>
      <span className="auth-icon"><LockKeyhole size={22} /></span>
      <h1>Sign in</h1>
      <p>Use your company account to manage financial records.</p>
      <form onSubmit={signIn}>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="button primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  </div>
}
