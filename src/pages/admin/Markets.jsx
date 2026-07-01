import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { Input, Textarea, Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'
import { PageLoader } from '../../components/ui/Spinner'

const defaultForm = {
  name: '', address: '', city: '', state: '', zip_code: '',
  lat: '', lng: '', description: '', typical_days: [],
  organizer_name: '', organizer_contact: '', website_url: '', category: 'general',
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AdminMarkets() {
  const { user } = useAuth()
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMarket, setEditingMarket] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('markets')
      .select('*')
      .order('name')
    setMarkets(data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditingMarket(null)
    setForm(defaultForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(market) {
    setEditingMarket(market)
    setForm({
      name: market.name ?? '',
      address: market.address ?? '',
      city: market.city ?? '',
      state: market.state ?? '',
      zip_code: market.zip_code ?? '',
      lat: market.lat ?? '',
      lng: market.lng ?? '',
      description: market.description ?? '',
      typical_days: market.typical_days ?? [],
      organizer_name: market.organizer_name ?? '',
      organizer_contact: market.organizer_contact ?? '',
      website_url: market.website_url ?? '',
      category: market.category ?? 'general',
    })
    setError('')
    setShowModal(true)
  }

  function setField(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      typical_days: f.typical_days.includes(day)
        ? f.typical_days.filter(d => d !== day)
        : [...f.typical_days, day],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Market name is required'); return }
    setSaving(true)
    setError('')

    const data = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip_code: form.zip_code.trim() || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      description: form.description.trim() || null,
      typical_days: form.typical_days,
      organizer_name: form.organizer_name.trim() || null,
      organizer_contact: form.organizer_contact.trim() || null,
      website_url: form.website_url.trim() || null,
      category: form.category,
    }

    let err
    if (editingMarket) {
      const res = await supabase.from('markets').update(data).eq('id', editingMarket.id)
      err = res.error
    } else {
      const res = await supabase.from('markets').insert(data)
      err = res.error

      // Log admin action
      if (!err) {
        await supabase.from('admin_actions').insert({
          admin_user_id: user.id,
          action_type: 'market_creation',
          entity_type: 'market',
          reason: `Created market: ${form.name}`,
        })
      }
    }

    if (err) {
      setError(err.message)
    } else {
      setShowModal(false)
      await load()
    }
    setSaving(false)
  }

  async function toggleStatus(market) {
    const next = market.status === 'active' ? 'inactive' : 'active'
    await supabase.from('markets').update({ status: next }).eq('id', market.id)
    setMarkets(m => m.map(x => x.id === market.id ? { ...x, status: next } : x))
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Markets</h1>
        <Button onClick={openCreate}>+ Create market</Button>
      </div>

      <div className="space-y-3">
        {markets.length === 0 && (
          <div className="text-center py-16 text-gray-400">No markets yet. Create the first one.</div>
        )}
        {markets.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{m.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {m.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{[m.city, m.state].filter(Boolean).join(', ')}</p>
              {m.typical_days?.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{m.typical_days.join(', ')}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => openEdit(m)} className="text-sm text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50">
                Edit
              </button>
              <button onClick={() => toggleStatus(m)} className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                {m.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingMarket ? 'Edit market' : 'Create market'} size="xl">
        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Market name" value={form.name} onChange={setField('name')} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Address" value={form.address} onChange={setField('address')} />
            <Input label="City" value={form.city} onChange={setField('city')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="State" value={form.state} onChange={setField('state')} placeholder="CA" />
            <Input label="Zip code" value={form.zip_code} onChange={setField('zip_code')} />
            <Select label="Category" value={form.category} onChange={setField('category')}>
              <option value="general">General</option>
              <option value="artisan">Artisan</option>
              <option value="seasonal">Seasonal</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" type="number" step="any" value={form.lat} onChange={setField('lat')} hint="For map feature" />
            <Input label="Longitude" type="number" step="any" value={form.lng} onChange={setField('lng')} />
          </div>
          <Textarea label="Description" value={form.description} onChange={setField('description')} rows={3} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Typical market days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors
                    ${form.typical_days.includes(d) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Organizer name" value={form.organizer_name} onChange={setField('organizer_name')} />
            <Input label="Organizer contact" value={form.organizer_contact} onChange={setField('organizer_contact')} />
          </div>
          <Input label="Website URL" type="url" value={form.website_url} onChange={setField('website_url')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">
              {editingMarket ? 'Save changes' : 'Create market'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
