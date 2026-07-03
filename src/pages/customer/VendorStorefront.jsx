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

  const [vendor, setVendor]       = useState(null)
  const [products, setProducts]   = useState([])
  const [appearances, setAppearances] = useState([])
  const [reviews, setReviews]     = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading]     = useState(true)
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
    <div className="flex flex-col items-center justify-center h-96 gap-3 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
      <p className="text-gray-500 text-sm">Vendor not found or not yet approved.</p>
    </div>
  )

  const totalStock = p => (p.product_variants ?? []).filter(v => v.status === 'active').reduce((s, v) => s + (v.stock_quantity ?? 0), 0)
  const inStock    = p => totalStock(p) > 0

  return (
    <div className="pb-10 bg-gray-50 min-h-screen">

      {/* ── Hero banner ──────────────────────────────────────────────────────── */}
      <div className="relative h-52 bg-gradient-to-br from-brand-600 to-brand-800 overflow-hidden">
        {vendor.banner_url && (
          <img
            src={vendor.banner_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Bottom vignette so the logo floats cleanly off the banner */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm rounded-full p-2.5 text-white hover:bg-black/50 transition-colors shadow"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* ── Identity card ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 pb-5 shadow-sm">
        {/* Logo + Follow aligned to the edge of the banner */}
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="h-20 w-20 rounded-2xl bg-white border-[3px] border-white shadow-lg flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" />
              : <span>🌿</span>}
          </div>
          <div className="mb-1">
            <Button
              variant={isFollowing ? 'secondary' : 'primary'}
              size="sm"
              loading={followLoading}
              onClick={toggleFollow}
            >
              {isFollowing ? '✓ Following' : '+ Follow'}
            </Button>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900">{vendor.business_name}</h1>

        {/* Metadata row */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {(vendor.average_rating ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-sm">
              <span className="text-amber-400 text-base">★</span>
              <span className="font-semibold text-gray-800">{Number(vendor.average_rating).toFixed(1)}</span>
              {reviews.length > 0 && <span className="text-gray-400 text-xs">({reviews.length})</span>}
            </span>
          )}
          <span className="text-sm text-gray-500">{vendor.follower_count ?? 0} followers</span>
          {products.length > 0 && (
            <span className="text-sm text-gray-500">{products.length} products</span>
          )}
        </div>

        {/* Badges */}
        {vendor.badges?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {vendor.badges.map(b => (
              <span key={b} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-0.5 rounded-full font-medium">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* ── About ──────────────────────────────────────────────────────────── */}
        {vendor.business_description && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-brand-50 border-b border-brand-100 flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-widest">About</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-gray-700 leading-relaxed">{vendor.business_description}</p>
            </div>
          </div>
        )}

        {/* ── Upcoming market dates ──────────────────────────────────────────── */}
        {appearances.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Upcoming Market Dates</h2>
            <div className="space-y-2.5">
              {appearances.map(a => {
                const d       = new Date(a.appearance_date + 'T12:00:00')
                const month   = d.toLocaleDateString('en-US', { month: 'short' })
                const day     = d.getDate()
                const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
                const city    = a.markets?.city ? ` · ${a.markets.city}` : ''
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
                    {/* Calendar chip */}
                    <div className="flex-shrink-0 w-12 h-12 bg-brand-600 rounded-xl flex flex-col items-center justify-center text-white shadow-sm">
                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-80 leading-none">{month}</span>
                      <span className="text-xl font-extrabold leading-tight">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {a.markets?.name}{city}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {weekday}
                        {a.open_time  && ` · ${a.open_time.slice(0, 5)}`}
                        {a.close_time && `–${a.close_time.slice(0, 5)}`}
                        {a.booth_number && ` · Booth ${a.booth_number}`}
                      </p>
                    </div>
                    {a.pre_orders_accepted && (
                      <span className="flex-shrink-0 text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                        Pre-orders
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Products ───────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Products</h2>
            {products.length > 0 && (
              <span className="text-xs text-gray-400 font-medium">
                {products.filter(inStock).length} in stock
              </span>
            )}
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">No products listed yet</p>
              <p className="text-xs text-gray-400 mt-1">Check back soon!</p>
            </div>
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
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5
                    ${!inStock(p) ? 'opacity-60' : ''}`}
                >
                  {/* Product image area */}
                  <div className="h-36 bg-gradient-to-br from-gray-50 to-gray-100 relative flex items-center justify-center">
                    <svg className="h-10 w-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>

                    {/* Top-left: Featured */}
                    {p.is_featured && (
                      <span className="absolute top-2 left-2 text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full font-semibold shadow-sm">
                        ✦ Featured
                      </span>
                    )}
                    {/* Top-right: Sale */}
                    {p.compare_at_price_cents && inStock(p) && (
                      <span className="absolute top-2 right-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold shadow-sm">
                        Sale
                      </span>
                    )}
                    {/* Out-of-stock overlay */}
                    {!inStock(p) && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="text-xs font-semibold text-gray-500 bg-white/90 px-3 py-1 rounded-full shadow-sm border border-gray-200">
                          Out of stock
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{p.name}</p>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <p className="text-sm font-bold text-gray-900">{formatCents(p.base_price_cents)}</p>
                      {p.compare_at_price_cents && (
                        <p className="text-xs text-gray-400 line-through">{formatCents(p.compare_at_price_cents)}</p>
                      )}
                    </div>
                    {(p.average_rating ?? 0) > 0 && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-0.5">
                        <span className="text-amber-400">★</span>
                        {Number(p.average_rating).toFixed(1)}
                        {p.total_units_sold > 0 && <span className="ml-1 text-gray-300">· {p.total_units_sold} sold</span>}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Reviews ────────────────────────────────────────────────────────── */}
        {reviews.length > 0 && (
          <div>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-base font-semibold text-gray-900">Reviews</h2>
              {(vendor.average_rating ?? 0) > 0 && (
                <span className="text-sm text-amber-500 font-medium">
                  ★ {Number(vendor.average_rating).toFixed(1)}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{reviews.length} shown</span>
            </div>

            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-amber-400 tracking-tight leading-none">
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
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
