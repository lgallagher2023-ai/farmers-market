import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCents } from '../../lib/stripe'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'

const STATUS_STEPS = [
  { status: 'pending',   label: 'Order placed',       icon: '🛒' },
  { status: 'confirmed', label: 'Order confirmed',     icon: '✅' },
  { status: 'ready',     label: 'Ready for pickup',    icon: '📦' },
  { status: 'fulfilled', label: 'Picked up / Delivered', icon: '🎉' },
]

export default function OrderTracking() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setOrder(o => ({ ...o, ...payload.new }))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [orderId])

  async function loadOrder() {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          id, product_name_snapshot, variant_snapshot, quantity, price_cents_snapshot, subtotal_cents,
          fulfillment_status, vendor_id,
          vendor_profiles!inner(id, business_name)
        ),
        market_appearances(appearance_date, open_time, markets!inner(name, address, city))
      `)
      .eq('id', orderId)
      .single()

    setOrder(data)
    setLoading(false)
  }

  if (loading) return <PageLoader />
  if (!order) return (
    <div className="flex items-center justify-center h-96 text-gray-400">Order not found.</div>
  )

  const currentStatusIndex = STATUS_STEPS.findIndex(s => s.status === order.status)
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/orders')} className="text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5">
        {/* Status timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {isCancelled ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-2">❌</p>
              <p className="font-semibold text-red-600">Order cancelled</p>
              {order.cancellation_reason && (
                <p className="text-sm text-gray-500 mt-1">{order.cancellation_reason}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {STATUS_STEPS.map((step, i) => {
                const isCompleted = i <= currentStatusIndex
                const isCurrent = i === currentStatusIndex
                return (
                  <div key={step.status} className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-lg flex-shrink-0
                      ${isCompleted ? 'bg-brand-100' : 'bg-gray-100'}`}>
                      {isCompleted ? step.icon : <span className="text-gray-300 text-sm">{i + 1}</span>}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className={`text-sm font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                        {isCurrent && <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">Current</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pickup info */}
        {order.market_appearances && (
          <div className="bg-brand-50 rounded-2xl p-4">
            <p className="text-sm font-semibold text-brand-800 mb-1">📍 Pickup details</p>
            <p className="text-sm text-brand-700">{order.market_appearances.markets?.name}</p>
            <p className="text-xs text-brand-600">
              {new Date(order.market_appearances.appearance_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {order.market_appearances.open_time && ` · ${order.market_appearances.open_time}`}
            </p>
            {order.market_appearances.markets?.address && (
              <p className="text-xs text-brand-600 mt-0.5">{order.market_appearances.markets.address}</p>
            )}
          </div>
        )}

        {/* Items by vendor */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-900 mb-3">Items</p>
          {order.order_items?.map(item => (
            <div key={item.id} className="py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.quantity}× {item.product_name_snapshot}
                  </p>
                  {item.variant_snapshot?.variant_name !== 'Default' && (
                    <p className="text-xs text-gray-500">{item.variant_snapshot?.variant_name}</p>
                  )}
                  <button
                    onClick={() => navigate(`/vendors/${item.vendor_id}`)}
                    className="text-xs text-brand-600 hover:underline mt-0.5"
                  >
                    {item.vendor_profiles?.business_name}
                  </button>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900">{formatCents(item.subtotal_cents)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block
                    ${item.fulfillment_status === 'fulfilled' ? 'bg-green-100 text-green-700'
                    : item.fulfillment_status === 'cancelled' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                    {item.fulfillment_status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-900 mb-3">Payment</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCents(order.subtotal_cents)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Platform fee</span><span>{formatCents(order.platform_fee_cents)}</span></div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>−{formatCents(order.discount_cents)}</span></div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100"><span>Total</span><span>{formatCents(order.total_cents)}</span></div>
          </div>
          <p className={`text-xs mt-2 ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
            {order.payment_status === 'paid' ? '✓ Payment received' : '⏳ Payment pending'}
          </p>
        </div>

        {/* Actions */}
        {order.status === 'fulfilled' && (
          <Button variant="secondary" className="w-full" onClick={() => navigate(`/vendors/${order.order_items?.[0]?.vendor_id}`)}>
            Leave a review
          </Button>
        )}
      </div>
    </div>
  )
}
