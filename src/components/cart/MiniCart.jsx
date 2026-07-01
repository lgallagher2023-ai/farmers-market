import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { formatCents } from '../../lib/stripe'

const PLATFORM_FEE_PERCENT = Number(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? 10)

/**
 * MiniCart — slide-in sidebar triggered when a customer adds an item.
 * Mounted globally inside CartProvider so it works from any page.
 * Uses a translucent backdrop; clicking it closes the panel.
 */
export default function MiniCart() {
  const navigate = useNavigate()
  const {
    items, itemsByVendor, subtotalCents, discountCents,
    miniCartOpen, closeMiniCart, updateQuantity, removeItem,
  } = useCart()

  const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEE_PERCENT / 100)
  const totalCents = subtotalCents + platformFeeCents - discountCents

  // Close on Escape key
  useEffect(() => {
    if (!miniCartOpen) return
    function onKey(e) { if (e.key === 'Escape') closeMiniCart() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [miniCartOpen, closeMiniCart])

  // Prevent body scroll while open
  useEffect(() => {
    if (miniCartOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [miniCartOpen])

  if (!miniCartOpen) return null

  function goToCheckout() {
    closeMiniCart()
    navigate('/checkout')
  }

  function goToCart() {
    closeMiniCart()
    navigate('/cart')
  }

  return (
    <>
      {/* Backdrop — semi-transparent, click to dismiss */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={closeMiniCart}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.22s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Your cart</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {items.length === 0
                ? 'No items yet'
                : `${items.reduce((s, i) => s + i.quantity, 0)} item${items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={closeMiniCart}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close cart"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <span className="text-5xl mb-4">🛒</span>
            <p className="text-gray-500 font-medium">Your cart is empty</p>
            <p className="text-sm text-gray-400 mt-1">Add items from a vendor to get started</p>
            <button
              onClick={closeMiniCart}
              className="mt-5 text-sm font-medium text-brand-600 hover:underline"
            >
              Continue browsing
            </button>
          </div>
        )}

        {/* Items — scrollable */}
        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => (
              <div key={vendorId}>
                {/* Vendor label */}
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {vendorItems[0]?.vendorName ?? 'Vendor'}
                  </p>
                </div>

                {/* Items for this vendor */}
                {vendorItems.map(item => (
                  <div key={item.variantId} className="px-5 py-4 border-b border-gray-50 flex gap-3">
                    {/* Thumbnail */}
                    <div className="h-14 w-14 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-lg">
                      📷
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight truncate">{item.name}</p>
                      {item.variantSnapshot?.variant_name && item.variantSnapshot.variant_name !== 'Default' && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.variantSnapshot.variant_name}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatCents(item.priceCents * item.quantity)}
                      </p>
                    </div>

                    {/* Qty controls + remove */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                        aria-label="Remove item"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="flex items-center border border-gray-200 rounded-lg text-sm">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors"
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-medium text-gray-900 text-xs">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-r-lg transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Footer — totals + CTA */}
        {items.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-100 px-5 pt-4 pb-6 space-y-3 bg-white">
            {/* Price breakdown */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatCents(subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                <span>{formatCents(platformFeeCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>−{formatCents(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                <span>Total</span>
                <span>{formatCents(totalCents)}</span>
              </div>
            </div>

            {/* Buttons */}
            <button
              onClick={goToCheckout}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Checkout · {formatCents(totalCents)}
            </button>
            <button
              onClick={goToCart}
              className="w-full border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              View full cart
            </button>
          </div>
        )}
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
