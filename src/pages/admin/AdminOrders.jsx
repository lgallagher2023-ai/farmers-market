import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCents } from '../../lib/stripe'
import { StatusBadge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { Input } from '../../components/ui/Input'

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(vendor_id, product_name_snapshot, quantity, vendor_profiles!inner(business_name))')
      .order('created_at', { ascending: false })
      .limit(100)

    setOrders(data ?? [])
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter
    const matchSearch = !search || o.id.includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  if (loading) return <PageLoader />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Orders</h1>

      <div className="flex items-center gap-3 mb-4">
        <Input
          className="max-w-xs"
          placeholder="Search by order ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['all', 'pending', 'confirmed', 'fulfilled', 'cancelled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors
                ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Items</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Platform fee</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No orders found</td></tr>
            )}
            {filtered.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.id.slice(0, 8)}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-800">
                    {order.order_items?.[0]?.product_name_snapshot}
                    {order.order_items?.length > 1 && (
                      <span className="text-gray-400"> +{order.order_items.length - 1} more</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[...new Set(order.order_items?.map(i => i.vendor_profiles?.business_name))].join(', ')}
                  </p>
                </td>
                <td className="px-4 py-3 font-medium">{formatCents(order.total_cents)}</td>
                <td className="px-4 py-3 text-gray-500">{formatCents(order.platform_fee_cents)}</td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
