import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCents } from '../../lib/stripe'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'

export default function OrderConfirmation() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Checkout passes order data in navigation state to avoid a Supabase read
  // (which would fail for guest users blocked by RLS). We use it if present.
  const stateData  = location.state ?? {}
  const isGuest    = stateData.isGuest ?? false
  const guestEmail = stateData.guestEmail ?? null
  const guestName  = stateData.guestName ?? null

  const [order, setOrder] = useState(stateData.orderSummary ?? null)
  const [loading, setLoading] = useState(!stateData.orderSummary)

  useEffect(() => {
    // Only hit Supabase if we didn't get the summary via state (authenticated flow)
    if (stateData.orderSummary) return

    supabase
      .from('orders')
      .select('*, order_items(product_name_snapshot, variant_snapshot, quantity, price_cents_snapshot, subtotal_cents, vendor_profiles!inner(business_name))')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        setOrder(data)
        setLoading(false)
      })
  }, [orderId])

  if (loading) return <PageLoader />
  if (!order)  return <div className="flex items-center justify-center h-96 text-gray-400">Order not found.</div>

  // Normalise item shape — state-based and Supabase-based differ slightly
  const orderItems = order.items ?? order.order_items ?? []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        {/* Success checkmark */}
        <div className="text-center mb-8">
          <div className="relative h-28 w-28 mx-auto mb-5">
            {/* Outer pulsing halo */}
            <div className="absolute inset-0 rounded-full bg-brand-100 animate-pulse" />
            {/* Mid ring */}
            <div className="absolute inset-3 rounded-full bg-brand-200" />
            {/* Inner circle */}
            <div className="absolute inset-6 rounded-full bg-brand-600 flex items-center justify-center shadow-lg">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You're all set! 🎉</h1>
          <p className="text-sm text-gray-500 mt-1.5">Thank you for supporting local vendors</p>
          <p className="font-mono text-xs text-gray-400 mt-2">
            Order #{(order.id ?? orderId).slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Confirmation email notice for guests */}
        {isGuest && guestEmail && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4 text-sm text-blue-800">
            <p className="font-medium">Confirmation sent</p>
            <p className="mt-0.5 text-blue-600">
              A receipt will be emailed to <span className="font-semibold">{guestEmail}</span>.
            </p>
          </div>
        )}

        {/* Order details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">What you ordered</p>
          <div className="space-y-2">
            {orderItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.quantity}× {item.product_name_snapshot}
                  {item.variant_snapshot?.variant_name !== 'Default' && ` (${item.variant_snapshot?.variant_name})`}
                </span>
                <span className="font-medium text-gray-900">{formatCents(item.subtotal_cents)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatCents(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Platform fee</span>
              <span>{formatCents(order.platform_fee_cents)}</span>
            </div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>−{formatCents(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>Total charged</span>
              <span>{formatCents(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* CTA buttons — differ for guest vs authenticated */}
        {!isGuest ? (
          <div className="space-y-3">
            <Button onClick={() => navigate(`/orders/${orderId}`)} className="w-full">
              Track my order
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')} className="w-full">
              Continue shopping
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Guest: invite to create an account */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🌿</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Create a free account</p>
                  <p className="text-xs text-gray-500 mt-0.5">Track orders, save favourites & check out faster</p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/signup', {
                  state: { prefillEmail: guestEmail, prefillName: guestName },
                })}
                className="w-full"
                size="sm"
              >
                Create account
              </Button>
              <button
                onClick={() => navigate('/')}
                className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 py-1"
              >
                No thanks, continue browsing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
