import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { StatusBadge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'

export default function Orders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('orders')
      .select('id, status, created_at, total_cents, payment_status, order_items(product_name_snapshot, quantity)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <PageLoader />

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 mb-4">No orders yet</p>
          <button onClick={() => navigate('/')} className="text-brand-600 font-medium hover:underline text-sm">
            Start shopping →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <button
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8).toUpperCase()}</p>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm text-gray-700 mb-1">
                {order.order_items?.map(i => `${i.quantity}× ${i.product_name_snapshot}`).join(', ')}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                <span className="font-medium text-gray-700">{formatCents(order.total_cents)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
