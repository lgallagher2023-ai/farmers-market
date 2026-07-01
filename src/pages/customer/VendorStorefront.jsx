import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { useTrackBehavior } from '../../hooks/useTrackBehavior'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'

export default function VendorStorefront() {
  const { vendorId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const track = useTrackBehavior()

  const [vendor, setVendor] = useState(null)
  const [products, setProducts] = useState([])
  const [appearances, setAppearances] = useState([])
  const [reviews, setReviews] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    loadStorefront()
    track('vendor_view', 'vendor', vendorId, { referral_source: 'direct' })
  }, [vendorId])

  async function loadStorefront() {
    const [vendorRes, productsRes, appearancesRes, reviewsRes] = await Promise.all([
      supabase
        .from('vendor_profiles')
        .select('id, business_name, business_description, logo_url, banner_url, average_rating, follower_count, badges, fulfillment_methods, storefront_settings')
        .eq('id', vendorId)
        .eq('status', 'active')
        .single(),

      supabase
        .from('products')
        .select('id, name, base_price_cents, compare_at_price_cents, average_rating, total_units_sold, is_featured, product_variants(stock_quantity, status)')
        .eq('vendor_id', vendorId)
        .eq('visibility', 'published')
        .order('is_featured', { ascending: false }),

      supabase
        .from('market_appearances')
        .select('id, appearance_date, open_time, close_time, booth_number, pre_orders_accepted, markets!inner(name, city, state)')
        .eq('vendor_id', vendorId)
        .eq('status', 'scheduled')
        .gte('appearance_date', new Date().toISOString().split('T')[0])
        .order('appearance_date')
        .limit(5),

      supabase
        .from('reviews')
        .select('id, rating, title, body, created_at')
        .eq('vendor_id', vendorId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    setVendor(vendorRes.data)
    setProducts(productsRes.data ?? [])
    setAppearances(appearancesRes.data ?? [])
    setReviews(reviewsRes.data ?? [])

    if (user) {
      const { data: follow } = await supabase
        .from('follows')
        .select('id, status')
        .eq('customer_id', user.id)
        .eq('vendor_id', vendorId)
        .single()
      setIsFollowing(follow?.status === 'active')
    }

    setLoading(false)
  }

  async function toggleFollow() {
    if (!user) { navigate('/login'); return }
    setFollowLoading(true)

    const { data: existing } = await supabase
      .from('follows')
      .select('id, status')
      .eq('customer_id', user.id)
      .eq('vendor_id', vendorId)
      .single()

    if (existing) {
      const newStatus = existing.status === 'active' ? 'inactive' : 'active'
      await supabase.from('follows').update({ status: newStatus }).eq('id', existing.id)
      setIsFollowing(newStatus === 'active')
    } else {
      await supabase.from('follows').insert({ customer_id: user.id, vendor_id: vendorId })
      setIsFollowing(true)
      track('follow', 'vendor', vendorId)
    }

    setFollowLoading(false)
  }

  if (loading) return <PageLoader />
  if (!vendor) return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      Vendor not found or not yet approved.
    </div>
  )

  const totalStock = (p) => (p.product_variants ?? []).filter(v => v.status === 'active').reduce((s, v) => s + (v.stock_quantity ?? 0), 0)
  const inStock = (p) => totalStock(p) > 0

  return (
    <div className="pb-8">
      {/* Banner */}
      <div className="relative h-40 bg-gradient-to-r from-brand-100 to-brand-200">
        {vendor.banner_url && (
          <img src={vendor.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-white/80 backdrop-blur rounded-full p-2 text-gray-700 hover:bg-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="px-4 -mt-8 relative">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div className="h-16 w-16 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center text-2xl">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
              : '🌿'}
          </div>
          <Button
            variant={isFollowing ? 'secondary' : 'primary'}
            size="sm"
            loading={followLoading}
            onClick={toggleFollow}
          >
            {isFollowing ? '✓ Following' : '+ Follow'}
          </Button>
        </div>

        <h1 className="text-xl font-bold text-gray-900">{vendor.business_name}</h1>

        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
          {vendor.average_rating > 0 && (
            <span>⭐ {vendor.average_rating.toFixed(1)} ({reviews.length} reviews)</span>
          )}
          <span>{vendor.follower_count} followers</span>
        </div>

        {vendor.badges?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {vendor.badges.map(b => (
              <span key={b} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{b}</span>
            ))}
          </div>
        )}

        {vendor.business_description && (
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{vendor.business_description}</p>
        )}
      </div>

      {/* Upcoming appearances */}
      {appearances.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="font-semibold text-gray-900 mb-3">Upcoming market dates</h2>
          <div className="space-y-2">
            {appearances.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.markets?.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.appearance_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {a.open_time && ` · ${a.open_time}`}
                    {a.booth_number && ` · Booth ${a.booth_number}`}
                  </p>
                </div>
                {a.pre_orders_accepted && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Pre-orders</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section className="px-4 mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">Products</h2>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">No products listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  track('product_view', 'product', p.id, { referral_source: 'storefront' })
                  navigate(`/products/${p.id}`)
                }}
                disabled={!inStock(p)}
                className={`bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-left transition-shadow hover:shadow-md
                  ${!inStock(p) ? 'opacity-50' : ''}`}
              >
                <div className="h-28 bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-3xl text-gray-300">
                  📷
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{p.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm font-semibold text-gray-900">{formatCents(p.base_price_cents)}</p>
                  {!inStock(p) && <span className="text-xs text-red-500">Out of stock</span>}
                </div>
                {p.is_featured && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mt-1 inline-block">Featured</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="font-semibold text-gray-900 mb-3">Reviews</h2>
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < r.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                  ))}
                  <span className="text-xs text-gray-400 ml-1">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.title && <p className="text-sm font-medium text-gray-900">{r.title}</p>}
                {r.body && <p className="text-sm text-gray-600 mt-0.5">{r.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
