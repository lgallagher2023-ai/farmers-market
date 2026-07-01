import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { useTrackBehavior } from '../../hooks/useTrackBehavior'
import { PageLoader } from '../../components/ui/Spinner'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const track = useTrackBehavior()
  const [vendors, setVendors] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHome()
    track('page_view', 'home', null, { referral_source: 'direct' })
  }, [])

  async function loadHome() {
    const [vendorRes, orderRes] = await Promise.all([
      supabase
        .from('vendor_profiles')
        .select('id, business_name, business_description, logo_url, banner_url, average_rating, follower_count, badges')
        .eq('status', 'active')
        .order('follower_count', { ascending: false })
        .limit(20),

      user ? supabase
        .from('orders')
        .select('id, created_at, status, total_cents, order_items(product_name_snapshot)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
        : Promise.resolve({ data: [] }),
    ])

    setVendors(vendorRes.data ?? [])
    setRecentOrders(orderRes.data ?? [])
    setLoading(false)
  }

  function handleVendorClick(vendorId) {
    track('vendor_view', 'vendor', vendorId, { referral_source: 'home_feed' })
    navigate(`/vendors/${vendorId}`)
  }

  if (loading) return <PageLoader />

  return (
    <div className="pb-6">
      {/* Hero / greeting */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-8 text-white">
        <p className="text-sm font-medium opacity-80 mb-1">Good {greeting()} 👋</p>
        <h1 className="text-2xl font-bold">Discover local vendors</h1>
        <p className="text-sm opacity-75 mt-1">Fresh from your community, straight to you</p>

        {/* Search bar */}
        <button
          onClick={() => navigate('/search')}
          className="mt-4 w-full bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-white/80 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search vendors, products…
        </button>
      </div>

      {/* Order Again */}
      {recentOrders.length > 0 && (
        <section className="px-4 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Order again</h2>
            <button onClick={() => navigate('/orders')} className="text-xs text-brand-600 hover:underline">See all</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {recentOrders.map(order => (
              <button
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex-shrink-0 bg-white border border-gray-100 rounded-xl p-3 text-left min-w-[160px] shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-xs text-gray-400 mb-1">#{order.id.slice(0, 8)}</p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {order.order_items?.[0]?.product_name_snapshot ?? 'Order'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{formatCents(order.total_cents)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Vendor rows */}
      <section className="px-4 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Popular vendors</h2>
          <button onClick={() => navigate('/browse')} className="text-xs text-brand-600 hover:underline">See all</button>
        </div>
        {vendors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <p className="text-4xl mb-3">🌿</p>
            <p className="text-gray-500 text-sm">No vendors yet — check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {vendors.map(vendor => (
              <VendorCard key={vendor.id} vendor={vendor} onClick={() => handleVendorClick(vendor.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function VendorCard({ vendor, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow text-left w-full"
    >
      {/* Banner */}
      <div className="h-24 bg-gradient-to-r from-brand-100 to-brand-200 relative">
        {vendor.banner_url && (
          <img src={vendor.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Logo */}
        <div className="absolute -bottom-4 left-4 h-10 w-10 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-lg">
          {vendor.logo_url
            ? <img src={vendor.logo_url} alt="" className="h-full w-full rounded-full object-cover" />
            : '🌿'}
        </div>
      </div>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900">{vendor.business_name}</p>
            {vendor.business_description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{vendor.business_description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {vendor.average_rating > 0 && (
              <p className="text-sm font-medium text-gray-700">⭐ {vendor.average_rating.toFixed(1)}</p>
            )}
            <p className="text-xs text-gray-400">{vendor.follower_count} followers</p>
          </div>
        </div>
        {vendor.badges?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {vendor.badges.slice(0, 3).map(badge => (
              <span key={badge} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{badge}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
