import { RefreshCw, Save, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getManagedUsers, setUserRole } from './accessService'
import { roleLabels, type AppRole, type ManagedUser } from './types'
import { formatDate, formatDateTime } from '../../lib/businessDate'

const roleOptions: AppRole[] = ['admin', 'main_accountant', 'office_accountant']

interface Props { currentUserId: string }

export function AccessModule({ currentUserId }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AppRole | ''>>({})
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const nextUsers = await getManagedUsers()
      setUsers(nextUsers)
      setSelectedRoles(Object.fromEntries(nextUsers.map((user) => [user.user_id, user.role ?? ''])))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  async function saveRole(user: ManagedUser) {
    const nextRole = selectedRoles[user.user_id]
    if (!nextRole || user.user_id === currentUserId) return

    setSavingUserId(user.user_id)
    setError('')
    setSuccess('')
    try {
      await setUserRole(user.user_id, nextRole)
      setUsers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, role: nextRole } : item))
      setSuccess(`${user.email ?? 'User'} is now ${roleLabels[nextRole]}.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the role.')
    } finally {
      setSavingUserId(null)
    }
  }

  return <>
    <header><div><p className="eyebrow">ADMINISTRATION</p><h1>Access</h1><p>Assign application roles to authenticated company users.</p></div><button className="button secondary" disabled={loading} onClick={() => void loadUsers()}><RefreshCw size={16} /> Refresh</button></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
    {success && <div className="error-banner success-banner">{success}<button onClick={() => setSuccess('')}><X size={15} /></button></div>}
    <section className="panel">
      <div className="panel-heading"><div><h3>Company users</h3><p>Only administrators can view this list or change roles</p></div><span className="access-heading-icon"><ShieldCheck size={18} /></span></div>
      <div className="table-wrap access-table"><table><thead><tr><th>User</th><th>Created</th><th>Last sign in</th><th>Application role</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={4} className="empty">Loading users…</td></tr> : users.length === 0 ? <tr><td colSpan={4} className="empty">No authenticated users found.</td></tr> : users.map((user) => {
          const isCurrentUser = user.user_id === currentUserId
          const selectedRole = selectedRoles[user.user_id] ?? ''
          const roleChanged = selectedRole !== '' && selectedRole !== user.role
          return <tr key={user.user_id}>
            <td><div className="access-user"><strong>{user.email ?? 'No email address'}</strong><span>{isCurrentUser ? 'Current account' : user.user_id}</span></div></td>
            <td>{formatDate(user.created_at)}</td>
            <td>{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Never'}</td>
            <td><div className="access-role-control"><select className="role-select" value={selectedRole} disabled={isCurrentUser || savingUserId === user.user_id} onChange={(event) => setSelectedRoles((current) => ({ ...current, [user.user_id]: event.target.value as AppRole | '' }))}><option value="">Unassigned</option>{roleOptions.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select><button className="button primary compact-button" disabled={!roleChanged || isCurrentUser || savingUserId === user.user_id} onClick={() => void saveRole(user)}><Save size={14} /> {savingUserId === user.user_id ? 'Saving…' : 'Save'}</button></div></td>
          </tr>
        })}
      </tbody></table></div>
      <div className="panel-footer">{users.length} authenticated {users.length === 1 ? 'user' : 'users'} <span>Your own Admin role is protected</span></div>
    </section>
  </>
}
