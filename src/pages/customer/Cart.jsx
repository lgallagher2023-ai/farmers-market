import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { formatCents } from '../../lib/stripe'
import Button from '../../components/ui/Button'

const PLATFORM_FEE_PERCENT = Number(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? 10)

export default function Cart() {
  const navigate = useNavigate()
  const { items, itemsByVendor, subtotalCents, discountCents, couponCode, updateQuantity, removeItem, clearCart } = useCart()

  const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEE_PERCENT / 100)
  const totalCents = subtotalCents + platformFeeCents - discountCents

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <span className="text-5xl mb-4">🛒</span>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-sm text-gray-500 mb-6">Browse vendors to find something you'll love</p>
        <Button onClick={() => navigate('/')}>Discover vendors</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Cart</h1>
        </div>
        <button onClick={clearCart} className="text-xs text-red-500 hover:underline">Clear all</button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Items grouped by vendor */}
        {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => (
          <div key={vendorId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">
                {vendorItems[0]?.vendorName ?? 'Vendor'}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {vendorItems.map(item => (
                <div key={item.variantId} className="px-4 py-3 flex items-start gap-3">
                  <div className="h-14 w-14 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    <svg className="h-6 w-6 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {item.variantSnapshot?.variant_name && item.variantSnapshot.variant_name !== 'Default' && (
                      <p className="text-xs text-gray-500">{item.variantSnapshot.variant_name}</p>
                    )}
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatCents(item.priceCents * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center border border-gray-200 rounded-lg text-sm">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="px-2 py-1 text-gray-500 hover:text-gray-700"
                      >−</button>
                      <span className="px-2 py-1 font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="px-2 py-1 text-gray-500 hover:text-gray-700"
                      >+</button>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-gray-300 hover:text-red-400 p-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Price breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
            <span>{formatCents(platformFeeCents)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount {couponCode && `(${couponCode})`}</span>
              <span>−{formatCents(discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>{formatCents(totalCents)}</span>
          </div>
        </div>
      </div>

      {/* Checkout button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe">
        <Button
          onClick={() => navigate('/checkout')}
          className="w-full"
          size="lg"
        >
          Proceed to checkout · {formatCents(totalCents)}
        </Button>
      </div>
    </div>
  )
}
