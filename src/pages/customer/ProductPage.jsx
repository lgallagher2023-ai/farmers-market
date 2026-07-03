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

  // Feature 1 — scarcity + notify me
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)

  // Feature 2 — Pairs well with
  const [pairsWellWith, setPairsWellWith] = useState([])

  // Feature 3 — review photos gallery
  const [reviews, setReviews] = useState([])
  const [lightboxSrc, setLightboxSrc] = useState(null)

  useEffect(() => {
    loadProduct()
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

    const vendorId = p.vendor_profiles.id

    // Run all secondary queries in parallel
    const [variantsRes, pairsRes, reviewsRes, notifyRes] = await Promise.all([
      supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'active')
        .order('variant_name'),

      // Up to 4 other published products from the same vendor, best-sellers first
      supabase
        .from('products')
        .select('id, name, base_price_cents')
        .eq('vendor_id', vendorId)
        .eq('visibility', 'published')
        .neq('id', productId)
        .order('total_units_sold', { ascending: false })
        .limit(4),

      // Published reviews for this product, most-helpful first
      supabase
        .from('reviews')
        .select('id, rating, title, body, photos, vendor_response, created_at, helpful_votes')
        .eq('product_id', productId)
        .eq('status', 'published')
        .order('helpful_votes', { ascending: false })
        .limit(20),

      // Has this user already requested a back-in-stock notification?
      user
        ? supabase
            .from('saved_searches_wishlists')
            .select('id')
            .eq('customer_id', user.id)
            .eq('product_id', productId)
            .eq('notify_back_in_stock', true)
            .eq('status', 'active')
            .limit(1)
        : Promise.resolve({ data: [] }),
    ])

    setProduct(p)
    setVendor(p.vendor_profiles)
    const activeVariants = variantsRes.data ?? []
    setVariants(activeVariants)
    setSelectedVariant(activeVariants[0] ?? null)
    setPairsWellWith(pairsRes.data ?? [])
    setReviews(reviewsRes.data ?? [])
    setNotified((notifyRes.data?.length ?? 0) > 0)
    setLoading(false)
  }

  function handleAddToCart() {
    if (!selectedVariant) return
    if (!user) { navigate('/login', { state: { from: `/products/${productId}` } }); return }

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

  async function handleNotifyMe() {
    if (!user) {
      navigate('/login', { state: { from: `/products/${productId}` } })
      return
    }
    if (notified || notifying) return
    setNotifying(true)
    const { error } = await supabase.from('saved_searches_wishlists').insert({
      customer_id:          user.id,
      save_type:            'wishlisted_product',
      product_id:           product.id,
      notify_back_in_stock: true,
      status:               'active',
    })
    if (!error) setNotified(true)
    setNotifying(false)
  }

  // ── derived values ───────────────────────────────────────────────────────────
  const availableStock = selectedVariant
    ? Math.max(0, (selectedVariant.stock_quantity ?? 0) - (selectedVariant.reserved_quantity ?? 0))
    : 0
  const lowStockThreshold = selectedVariant?.low_stock_threshold ?? 5
  const isLowStock  = availableStock > 0 && availableStock <= lowStockThreshold
  const isOutOfStock = availableStock === 0 && !!selectedVariant

  const reviewPhotos = reviews.flatMap(r => r.photos ?? []).filter(Boolean)

  if (loading) return <PageLoader />
  if (!product) return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      Product not found.
    </div>
  )

  return (
    <div className="pb-32">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="sticky top-0 z-10 m-4 bg-white/80 backdrop-blur rounded-full p-2 text-gray-700 hover:bg-white shadow-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Hero photo placeholder */}
      <div className="h-72 bg-gradient-to-br from-gray-100 to-gray-50 flex flex-col items-center justify-center gap-3 -mt-12">
        <svg className="h-16 w-16 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-300 font-medium">No photo yet</p>
      </div>

      <div className="px-4 mt-4">
        {/* Vendor link */}
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
            <p className="text-sm text-gray-400 line-through">
              {formatCents(product.compare_at_price_cents)}
            </p>
          )}
        </div>

        {/* Rating */}
        {product.average_rating > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            ⭐ {Number(product.average_rating).toFixed(1)} · {product.total_units_sold} sold
          </p>
        )}

        {/* Variants */}
        {variants.length > 1 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {variants[0].variant_type
                ? variants[0].variant_type.charAt(0).toUpperCase() + variants[0].variant_type.slice(1)
                : 'Option'}
            </p>
            <div className="flex flex-wrap gap-2">
              {variants.map(v => {
                const stock = Math.max(0, (v.stock_quantity ?? 0) - (v.reserved_quantity ?? 0))
                const oos   = stock === 0
                return (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVariant(v); setQuantity(1) }}
                    disabled={oos}
                    className={`px-3 py-2 rounded-lg text-sm border-2 transition-colors
                      ${selectedVariant?.id === v.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'}
                      ${oos ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {v.variant_name}
                    {oos && <span className="ml-1 text-xs text-gray-400">· sold out</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity — hidden when out of stock */}
        {!isOutOfStock && (
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
          </div>
        )}

        {/* ── SCARCITY SIGNAL ──────────────────────────────────────────────── */}
        {isLowStock && (
          <div className="mt-3 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-semibold text-amber-600">
              Only {availableStock} left — order soon
            </p>
          </div>
        )}
        {isOutOfStock && (
          <div className="mt-3 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-sm font-semibold text-gray-400">Out of stock</p>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-5">
            <h2 className="font-semibold text-gray-900 mb-1">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Detail tabs */}
        {[
          { label: 'Ingredients',       value: product.ingredients },
          { label: 'Allergen Info',     value: product.allergen_info },
          { label: 'Care Instructions', value: product.care_instructions },
        ].filter(d => d.value).map(d => (
          <div key={d.label} className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{d.label}</p>
            <p className="text-sm text-gray-700">{d.value}</p>
          </div>
        ))}

        {/* ── WRITTEN REVIEWS ──────────────────────────────────────────────── */}
        {reviews.length > 0 && (
          <div className="mt-8">
            <div className="flex items-baseline gap-2 mb-4">
              <h2 className="font-semibold text-gray-900">Reviews</h2>
              <span className="text-sm text-gray-400">({reviews.length})</span>
            </div>

            <div className="space-y-5">
              {reviews.map(r => (
                <div key={r.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                  {/* Stars + date */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-amber-400 tracking-tight">
                      {'★'.repeat(r.rating)}
                      <span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span>
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {r.title && (
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                  )}
                  {r.body && (
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{r.body}</p>
                  )}

                  {/* Inline photo thumbnails for this review */}
                  {r.photos?.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {r.photos.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxSrc(url)}
                          className="h-16 w-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-90 transition-opacity"
                        >
                          <img src={url} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Vendor response */}
                  {r.vendor_response && (
                    <div className="mt-3 pl-3 border-l-2 border-brand-200 bg-brand-50/50 rounded-r-lg py-2 pr-3">
                      <p className="text-xs font-semibold text-brand-700 mb-0.5">Response from {vendor.business_name}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{r.vendor_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CUSTOMER PHOTO GALLERY (beneath written reviews) ─────────────── */}
        {reviewPhotos.length > 0 && (
          <div className="mt-6">
            <h2 className="font-semibold text-gray-900 mb-3">
              Customer photos
              <span className="ml-1.5 text-sm font-normal text-gray-400">({reviewPhotos.length})</span>
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scroll-smooth">
              {reviewPhotos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxSrc(url)}
                  className="h-28 w-28 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={url}
                    alt={`Customer photo ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PAIRS WELL WITH ───────────────────────────────────────────────── */}
        {pairsWellWith.length > 0 && (
          <div className="mt-8 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Pairs well with</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-smooth">
              {pairsWellWith.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="flex-shrink-0 w-36 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left hover:shadow-md transition-shadow"
                >
                  <div className="h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                    <svg className="h-8 w-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">{formatCents(p.base_price_cents)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── STICKY FOOTER — Add to cart / Notify me ──────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-5 space-y-2">
        {added && <Alert type="success" className="py-2">Added to cart!</Alert>}

        {isLowStock && !added && (
          <p className="text-xs font-semibold text-amber-500 text-center">
            ⚡ Only {availableStock} left
          </p>
        )}

        {isOutOfStock ? (
          <Button
            onClick={handleNotifyMe}
            loading={notifying}
            disabled={notified}
            variant="secondary"
            className="w-full"
            size="lg"
          >
            {notified
              ? '✓ You\'ll be notified when it\'s back'
              : 'Notify me when back in stock'}
          </Button>
        ) : (
          <Button
            onClick={handleAddToCart}
            disabled={!selectedVariant}
            className="w-full"
            size="lg"
          >
            {`Add to cart · ${formatCents((selectedVariant?.price_cents ?? product.base_price_cents) * quantity)}`}
          </Button>
        )}
      </div>

      {/* ── PHOTO LIGHTBOX ───────────────────────────────────────────────────── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setLightboxSrc(null)}
            aria-label="Close photo"
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Customer review photo"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
