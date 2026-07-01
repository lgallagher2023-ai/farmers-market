import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function Profile() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name:  profile?.last_name  ?? '',
    phone:      profile?.phone      ?? '',
  })

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    const { error } = await supabase
      .from('users')
      .update({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        phone:      form.phone.trim(),
      })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
    } else {
      await refreshProfile()
      setSuccess(true)
      setEditing(false)
      setTimeout(() => setSuccess(false), 3000)
    }
    setLoading(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .map(s => s[0].toUpperCase())
    .join('') || '?'

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center py-6">
        <div className="h-20 w-20 rounded-full bg-brand-100 text-brand-700 font-bold text-2xl flex items-center justify-center mb-3">
          {initials}
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {profile?.first_name} {profile?.last_name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
      </div>

      {success && <Alert type="success" className="mb-4">Profile updated.</Alert>}
      {error   && <Alert type="error"   className="mb-4">{error}</Alert>}

      {/* Account info card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Account info</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-brand-600 hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={form.first_name} onChange={set('first_name')} />
              <Input label="Last name"  value={form.last_name}  onChange={set('last_name')} />
            </div>
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
            <div className="flex gap-2 pt-1">
              <Button size="sm" loading={loading} onClick={handleSave}>Save</Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <dl className="space-y-3 text-sm">
            <Row label="First name" value={profile?.first_name} />
            <Row label="Last name"  value={profile?.last_name} />
            <Row label="Email"      value={user?.email} />
            <Row label="Phone"      value={profile?.phone || '—'} />
          </dl>
        )}
      </div>

      {/* Orders shortcut */}
      <button
        onClick={() => navigate('/orders')}
        className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 flex items-center justify-between hover:shadow-md transition-shadow"
      >
        <span className="font-medium text-gray-900">My orders</span>
        <span className="text-gray-400">→</span>
      </button>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full text-red-600 font-medium text-sm py-3 rounded-2xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right">{value}</dd>
    </div>
  )
}
