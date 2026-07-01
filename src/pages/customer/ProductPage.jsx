import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { formatCents } from '../../lib/stripe'
import { useTrackBehavior } from '../../hooks/useTrackBehavior'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

export default function ProductPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addItem } = useCart()
  const track = useTrackBehavior()

  const [product, setProduct] = useState(null)
  const [vendor, setVendor] = useState(null)
  const [variants, setVariants] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    loadProduct()
    // Increment view count
    supabase.from('products').update({ total_views: supabase.rpc('coalesce', {}) }).eq('id', productId).then(() => {})
    track('product_view', 'product', productId, { referral_source: 'direct' })
  }, [productId])

  async function loadProduct() {
    const { data: p } = await supabase
      .from('products')
      .select('*, vendor_profiles!inner(id, business_name, average_rating, status)')
      .eq('id', productId)
      .eq('visibility', 'published')
      .single()

    if (!p || p.vendor_profiles?.status !== 'active') {
      setLoading(false)
      return
    }

    const { data: v } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'active')
      .order('variant_name')

    setProduct(p)
    setVendor(p.vendor_profiles)
    const activeVariants = v ?? []
    setVariants(activeVariants)
    setSelectedVariant(activeVariants[0] ?? null)
    setLoading(false)
  }

  function handleAddToCart() {
    if (!selectedVariant) return
    if (!user) { navigate('/login'); return }

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      vendorId: vendor.id,
      name: product.name,
      variantSnapshot: {
        variant_name: selectedVariant.variant_name,
        variant_type: selectedVariant.variant_type,
        sku: selectedVariant.sku,
      },
      priceCents: selectedVariant.price_cents,
      quantity,
    })

    track('add_to_cart', 'product', product.id, {
      funnel_stage: 'cart',
      referral_source: 'product_page',
    })

    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  const availableStock = selectedVariant
    ? (selectedVariant.stock_quantity ?? 0) - (selectedVariant.reserved_quantity ?? 0)
    : 0

  if (loading) return <PageLoader />
  if (!product) return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      Product not found.
    </div>
  )

  return (
    <div className="pb-24">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="sticky top-0 z-10 m-4 bg-white/80 backdrop-blur rounded-full p-2 text-gray-700 hover:bg-white shadow-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Photo */}
      <div className="h-72 bg-gray-100 flex items-center justify-center text-6xl text-gray-200 -mt-12">
        📷
      </div>

      <div className="px-4 mt-4">
        {/* Vendor */}
        <button
          onClick={() => navigate(`/vendors/${vendor.id}`)}
          className="text-xs text-brand-600 hover:underline font-medium"
        >
          {vendor.business_name} →
        </button>

        <h1 className="text-xl font-bold text-gray-900 mt-1">{product.name}</h1>

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-bold text-gray-900">
            {formatCents(selectedVariant?.price_cents ?? product.base_price_cents)}
          </p>
          {product.compare_at_price_cents && (
            <p className="text-sm text-gray-400 line-through">{formatCents(product.compare_at_price_cents)}</p>
          )}
        </div>

        {/* Rating */}
        {product.average_rating > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            ⭐ {product.average_rating.toFixed(1)} · {product.total_units_sold} sold
          </p>
        )}

        {/* Variants */}
        {variants.length > 1 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {variants[0].variant_type ? variants[0].variant_type.charAt(0).toUpperCase() + variants[0].variant_type.slice(1) : 'Option'}
            </p>
            <div className="flex flex-wrap gap-2">
              {variants.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  disabled={(v.stock_quantity - (v.reserved_quantity ?? 0)) <= 0}
                  className={`px-3 py-2 rounded-lg text-sm border-2 transition-colors
                    ${selectedVariant?.id === v.id
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'}
                    ${(v.stock_quantity - (v.reserved_quantity ?? 0)) <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {v.variant_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mt-4 flex items-center gap-3">
          <p className="text-sm font-medium text-gray-700">Quantity</p>
          <div className="flex items-center border border-gray-200 rounded-lg">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="px-3 py-2 text-gray-600 hover:text-gray-900"
            >−</button>
            <span className="px-3 py-2 text-sm font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(availableStock, q + 1))}
              disabled={quantity >= availableStock}
              className="px-3 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >+</button>
          </div>
          <span className="text-xs text-gray-400">{availableStock} available</span>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mt-5">
            <h2 className="font-semibold text-gray-900 mb-1">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Detail tabs */}
        {[
          { label: 'Ingredients', value: product.ingredients },
          { label: 'Allergen Info', value: product.allergen_info },
          { label: 'Care Instructions', value: product.care_instructions },
        ].filter(d => d.value).map(d => (
          <div key={d.label} className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{d.label}</p>
            <p className="text-sm text-gray-700">{d.value}</p>
          </div>
        ))}
      </div>

      {/* Sticky add to cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe">
        {added && <Alert type="success" className="mb-2">Added to cart!</Alert>}
        <Button
          onClick={handleAddToCart}
          disabled={availableStock === 0 || !selectedVariant}
          className="w-full"
          size="lg"
        >
          {availableStock === 0 ? 'Out of stock' : `Add to cart · ${formatCents((selectedVariant?.price_cents ?? product.base_price_cents) * quantity)}`}
        </Button>
      </div>
    </div>
  )
}
