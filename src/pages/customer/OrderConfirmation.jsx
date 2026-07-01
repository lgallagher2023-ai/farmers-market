import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCents } from '../../lib/stripe'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'

export default function OrderConfirmation() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  if (!order) return <div className="flex items-center justify-center h-96 text-gray-400">Order not found.</div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        {/* Success */}
        <div className="text-center mb-8">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Order confirmed!</h1>
          <p className="text-sm text-gray-500 mt-1">Thank you for supporting local vendors</p>
          <p className="font-mono text-xs text-gray-400 mt-2">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>

        {/* Order details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">What you ordered</p>
          <div className="space-y-2">
            {order.order_items?.map((item, i) => (
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
              <span>Subtotal</span><span>{formatCents(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Platform fee</span><span>{formatCents(order.platform_fee_cents)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>Total charged</span><span>{formatCents(order.total_cents)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate(`/orders/${orderId}`)}
            className="w-full"
          >
            Track my order
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Continue shopping
          </Button>
        </div>
      </div>
    </div>
  )
}
