import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'

export default function VendorSchedule() {
  const { user } = useAuth()
  const [vendorId, setVendorId] = useState(null)
  const [appearances, setAppearances] = useState([])
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const defaultForm = {
    market_id: '', appearance_date: '', open_time: '', close_time: '',
    booth_number: '', customer_notes: '', pre_orders_accepted: false,
    pre_order_cutoff_at: '', online_during_market: false,
  }
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: vp } = await supabase.from('vendor_profiles').select('id').eq('user_id', user.id).single()
    if (!vp) { setLoading(false); return }
    setVendorId(vp.id)

    const [appRes, mktRes] = await Promise.all([
      supabase
        .from('market_appearances')
        .select('*, markets!inner(name, city, state)')
        .eq('vendor_id', vp.id)
        .order('appearance_date', { ascending: true }),
      supabase
        .from('markets')
        .select('id, name, city, state')
        .eq('status', 'active')
        .order('name'),
    ])

    setAppearances(appRes.data ?? [])
    setMarkets(mktRes.data ?? [])
    setLoading(false)
  }

  function setField(field) {
    return (e) => setForm(f => ({
      ...f,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.market_id) { setError('Select a market'); return }
    if (!form.appearance_date) { setError('Date is required'); return }
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('market_appearances').insert({
      vendor_id: vendorId,
      market_id: form.market_id,
      appearance_date: form.appearance_date,
      open_time: form.open_time || null,
      close_time: form.close_time || null,
      booth_number: form.booth_number || null,
      customer_notes: form.customer_notes || null,
      pre_orders_accepted: form.pre_orders_accepted,
      pre_order_cutoff_at: form.pre_order_cutoff_at || null,
      online_during_market: form.online_during_market,
      status: 'scheduled',
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setShowModal(false)
      setForm(defaultForm)
      await loadData()
    }
    setSaving(false)
  }

  async function cancelAppearance(id) {
    const reason = prompt('Reason for cancellation:')
    if (!reason) return
    await supabase.from('market_appearances')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', id)
    setAppearances(a => a.map(x => x.id === id ? { ...x, status: 'cancelled', cancellation_reason: reason } : x))
  }

  const upcoming = appearances.filter(a => a.appearance_date >= new Date().toISOString().split('T')[0] && a.status !== 'cancelled')
  const past = appearances.filter(a => a.appearance_date < new Date().toISOString().split('T')[0] || a.status === 'cancelled')

  if (loading) return <PageLoader />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Market Schedule</h1>
        <Button onClick={() => setShowModal(true)}>+ Add appearance</Button>
      </div>

      {/* Upcoming */}
      <h2 className="font-semibold text-gray-700 mb-3">Upcoming</h2>
      {upcoming.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 mb-6">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500 mb-3">No upcoming market appearances</p>
          <Button onClick={() => setShowModal(true)}>Schedule your first appearance</Button>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {upcoming.map(a => (
            <AppearanceCard key={a.id} appearance={a} onCancel={cancelAppearance} />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <h2 className="font-semibold text-gray-700 mb-3">Past & Cancelled</h2>
          <div className="space-y-3">
            {past.map(a => (
              <AppearanceCard key={a.id} appearance={a} past />
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Schedule market appearance" size="lg">
        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Market" value={form.market_id} onChange={setField('market_id')} required>
            <option value="">Select a market…</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.city}, {m.state}</option>
            ))}
          </Select>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Date" type="date" value={form.appearance_date} onChange={setField('appearance_date')} required />
            <Input label="Open time" type="time" value={form.open_time} onChange={setField('open_time')} />
            <Input label="Close time" type="time" value={form.close_time} onChange={setField('close_time')} />
          </div>

          <Input label="Booth / table number" value={form.booth_number} onChange={setField('booth_number')} placeholder="e.g. B12" />
          <Input label="Customer-facing notes" value={form.customer_notes} onChange={setField('customer_notes')} placeholder="e.g. Look for the green tent near the east entrance" />

          <div className="space-y-3 bg-gray-50 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.pre_orders_accepted} onChange={setField('pre_orders_accepted')} className="rounded" />
              Accept pre-orders for this appearance
            </label>
            {form.pre_orders_accepted && (
              <Input
                label="Pre-order cutoff"
                type="datetime-local"
                value={form.pre_order_cutoff_at}
                onChange={setField('pre_order_cutoff_at')}
                hint="Customers cannot pre-order after this time"
              />
            )}
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.online_during_market} onChange={setField('online_during_market')} className="rounded" />
              Accept online orders for booth pickup during market hours
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Save appearance</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function AppearanceCard({ appearance: a, onCancel, past }) {
  const date = new Date(a.appearance_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900">{a.markets?.name}</p>
            <StatusBadge status={a.status} />
          </div>
          <p className="text-sm text-gray-600">{date}</p>
          {(a.open_time || a.close_time) && (
            <p className="text-xs text-gray-400 mt-0.5">{a.open_time} – {a.close_time}</p>
          )}
          {a.booth_number && <p className="text-xs text-gray-500 mt-0.5">Booth {a.booth_number}</p>}
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            {a.pre_orders_accepted && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Pre-orders on</span>}
            {a.online_during_market && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Online during market</span>}
          </div>
        </div>
        {!past && a.status === 'scheduled' && (
          <button
            onClick={() => onCancel(a.id)}
            className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
