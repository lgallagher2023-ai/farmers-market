import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { StatusBadge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'

const STATUS_ACTIONS = {
  pending:   { label: 'Confirm order',  next: 'confirmed' },
  confirmed: { label: 'Mark ready',     next: 'ready' },
  ready:     { label: 'Mark fulfilled', next: 'fulfilled' },
}

export default function VendorOrders() {
  const { user } = useAuth()
  const [vendorId, setVendorId] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const { data: vp } = await supabase.from('vendor_profiles').select('id').eq('user_id', user.id).single()
    if (!vp) { setLoading(false); return }
    setVendorId(vp.id)

    const { data } = await supabase
      .from('order_items')
      .select(`
        id, fulfillment_status, quantity, subtotal_cents,
        product_name_snapshot, variant_snapshot, price_cents_snapshot,
        created_at, updated_at, cancellation_reason,
        orders!inner(id, created_at, customer_id, fulfillment_method, pickup_or_delivery_at, customer_notes, total_cents, market_appearance_id,
          market_appearances(appearance_date, markets(name))
        )
      `)
      .eq('vendor_id', vp.id)
      .order('created_at', { ascending: false })

    setOrders(data ?? [])
    setLoading(false)
  }

  async function updateStatus(itemId, newStatus) {
    setUpdating(itemId)
    setError('')
    const { error } = await supabase
      .from('order_items')
      .update({ fulfillment_status: newStatus })
      .eq('id', itemId)

    if (error) {
      setError(error.message)
    } else {
      setOrders(prev =>
        prev.map(o => o.id === itemId ? { ...o, fulfillment_status: newStatus } : o)
      )
    }
    setUpdating(null)
  }

  async function cancelItem(itemId) {
    const reason = prompt('Reason for cancellation (required):')
    if (!reason) return
    setUpdating(itemId)
    await supabase.from('order_items')
      .update({ fulfillment_status: 'cancelled', cancellation_reason: reason })
      .eq('id', itemId)
    setOrders(prev =>
      prev.map(o => o.id === itemId ? { ...o, fulfillment_status: 'cancelled', cancellation_reason: reason } : o)
    )
    setUpdating(null)
  }

  const filters = ['pending', 'confirmed', 'ready', 'fulfilled', 'cancelled']
  const filtered = filter === 'all' ? orders : orders.filter(o => o.fulfillment_status === filter)

  const counts = filters.reduce((acc, f) => {
    acc[f] = orders.filter(o => o.fulfillment_status === f).length
    return acc
  }, {})

  if (loading) return <PageLoader />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders</h1>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {['pending', 'confirmed', 'ready', 'fulfilled'].map(s => (
          <div key={s} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            <p className="text-xs text-gray-500 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {f} {counts[f] > 0 && <span className="ml-1 text-xs">({counts[f]})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">No {filter} orders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const order = item.orders
            const action = STATUS_ACTIONS[item.fulfillment_status]
            const variantInfo = item.variant_snapshot

            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8)}</p>
                      <StatusBadge status={item.fulfillment_status} />
                      <span className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="font-medium text-gray-900">
                      {item.quantity}× {item.product_name_snapshot}
                      {variantInfo?.variant_name && variantInfo.variant_name !== 'Default'
                        ? ` — ${variantInfo.variant_name}` : ''}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatCents(item.subtotal_cents)} · {order.fulfillment_method?.replace('_', ' ')}
                    </p>

                    {order.market_appearances && (
                      <p className="text-xs text-gray-400 mt-1">
                        📍 {order.market_appearances.markets?.name} ·{' '}
                        {new Date(order.market_appearances.appearance_date).toLocaleDateString()}
                      </p>
                    )}

                    {order.customer_notes && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                        💬 {order.customer_notes}
                      </p>
                    )}

                    {item.cancellation_reason && (
                      <p className="text-xs text-red-600 mt-1">Cancelled: {item.cancellation_reason}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {action && (
                      <button
                        onClick={() => updateStatus(item.id, action.next)}
                        disabled={updating === item.id}
                        className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {updating === item.id ? '…' : action.label}
                      </button>
                    )}
                    {!['fulfilled', 'cancelled'].includes(item.fulfillment_status) && (
                      <button
                        onClick={() => cancelItem(item.id)}
                        disabled={updating === item.id}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-3 py-1.5 rounded-lg"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
