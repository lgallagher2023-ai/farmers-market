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
  const [rows, setRows] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHome()
    track('page_view', 'home', null, { referral_source: 'direct' })
  }, [])

  async function loadHome() {
    const today = new Date()

    // ── This weekend's dates ──────────────────────────────────────────────────
    const weekendDates = getWeekendDates(today)

    // ── New this week = joined in the last 7 days ─────────────────────────────
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString()

    const [vendorRes, categoryRes, appearanceRes, orderRes] = await Promise.all([
      // All active vendors — we slice/filter client-side per row
      supabase
        .from('vendor_profiles')
        .select('id, business_name, business_description, logo_url, banner_url, average_rating, follower_count, badges, created_at, business_type')
        .eq('status', 'active')
        .limit(200),

      // Vendor-type categories (for labelling rows by business type)
      supabase
        .from('categories')
        .select('id, name')
        .eq('category_type', 'vendor_type')
        .eq('status', 'active'),

      // Market appearances this weekend (non-cancelled)
      weekendDates.length > 0
        ? supabase
            .from('market_appearances')
            .select('vendor_id')
            .in('appearance_date', weekendDates)
            .neq('status', 'cancelled')
        : Promise.resolve({ data: [] }),

      // Recent orders for "Order again" strip
      user
        ? supabase
            .from('orders')
            .select('id, created_at, status, total_cents, order_items(product_name_snapshot)')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3)
        : Promise.resolve({ data: [] }),
    ])

    const allVendors = vendorRes.data ?? []

    // Build a lookup: category UUID → display name
    const catMap = Object.fromEntries(
      (categoryRes.data ?? []).map(c => [c.id, c.name])
    )

    // Annotate vendors with their category name
    const vendors = allVendors.map(v => ({
      ...v,
      categoryName: catMap[v.business_type] ?? null,
    }))

    // Set of vendor IDs appearing this weekend
    const weekendVendorIds = new Set(
      (appearanceRes.data ?? []).map(a => a.vendor_id)
    )

    // ── Build rows ────────────────────────────────────────────────────────────

    const builtRows = []

    // 1. At markets this weekend
    const weekendVendors = vendors
      .filter(v => weekendVendorIds.has(v.id))
      .slice(0, 12)
    if (weekendVendors.length > 0) {
      builtRows.push({
        label: weekendRowLabel(today),
        vendors: weekendVendors,
      })
    }

    // 2. New vendors this week
    const newVendors = vendors
      .filter(v => v.created_at >= weekAgoStr)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 12)
    if (newVendors.length > 0) {
      builtRows.push({ label: 'New This Week', vendors: newVendors })
    }

    // 3. One row per vendor-type category, sorted by vendor count (largest first)
    //    Within each row: vendors ordered by average_rating desc
    const categoryGroups = {}
    vendors.forEach(v => {
      if (!v.categoryName) return
      if (!categoryGroups[v.categoryName]) categoryGroups[v.categoryName] = []
      categoryGroups[v.categoryName].push(v)
    })

    Object.entries(categoryGroups)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 4)                                 // up to 4 category rows
      .forEach(([catName, catVendors]) => {
        const sorted = [...catVendors]
          .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
          .slice(0, 12)
        builtRows.push({
          label: `Top ${catName} Vendors`,
          vendors: sorted,
        })
      })

    // 4. Highest rated (quality signal; shows regardless of category)
    const topRated = vendors
      .filter(v => (v.average_rating ?? 0) >= 4.0)
      .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
      .slice(0, 12)
    if (topRated.length > 0) {
      builtRows.push({ label: 'Highest Rated', vendors: topRated })
    }

    // 5. Fallback: most-followed vendors (always visible if any vendors exist)
    if (builtRows.length === 0 && vendors.length > 0) {
      const popular = [...vendors]
        .sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))
        .slice(0, 12)
      builtRows.push({ label: 'Popular Vendors', vendors: popular })
    }

    setRows(builtRows)
    setRecentOrders(orderRes.data ?? [])
    setLoading(false)
  }

  function handleVendorClick(vendorId) {
    track('vendor_view', 'vendor', vendorId, { referral_source: 'home_feed' })
    navigate(`/vendors/${vendorId}`)
  }

  if (loading) return <PageLoader />

  return (
    <div className="pb-8">
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
        <section className="pt-6">
          <div className="flex items-center justify-between mb-3 px-4">
            <h2 className="font-semibold text-gray-900">Order again</h2>
            <button onClick={() => navigate('/orders')} className="text-xs text-brand-600 hover:underline">See all</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 px-4">
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

      {/* Dynamic vendor rows */}
      {rows.length === 0 ? (
        <div className="px-4 pt-6">
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <p className="text-4xl mb-3">🌿</p>
            <p className="text-gray-500 text-sm">No vendors yet — check back soon!</p>
          </div>
        </div>
      ) : (
        rows.map(row => (
          <section key={row.label} className="pt-6">
            <div className="flex items-center justify-between mb-3 px-4">
              <h2 className="font-semibold text-gray-900">{row.label}</h2>
              <button
                onClick={() => navigate('/search')}
                className="text-xs text-brand-600 hover:underline"
              >
                See all
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 px-4">
              {row.vendors.map(vendor => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  onClick={() => handleVendorClick(vendor.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

// ── Compact horizontal-scroll vendor card ────────────────────────────────────

function VendorCard({ vendor, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-44 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow text-left"
    >
      {/* Banner */}
      <div className="h-20 bg-gradient-to-r from-brand-100 to-brand-200 relative">
        {vendor.banner_url && (
          <img src={vendor.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Logo badge */}
        <div className="absolute -bottom-3 left-3 h-8 w-8 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center text-sm">
          {vendor.logo_url
            ? <img src={vendor.logo_url} alt="" className="h-full w-full rounded-full object-cover" />
            : '🌿'}
        </div>
      </div>

      <div className="px-3 pt-5 pb-3">
        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
          {vendor.business_name}
        </p>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {(vendor.average_rating ?? 0) > 0 && (
            <span className="text-xs text-gray-500">
              ⭐ {Number(vendor.average_rating).toFixed(1)}
            </span>
          )}
          {vendor.categoryName && (
            <span className="text-xs text-brand-600 truncate">{vendor.categoryName}</span>
          )}
        </div>

        {vendor.badges?.length > 0 && (
          <span className="inline-block mt-1.5 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full truncate max-w-full">
            {vendor.badges[0]}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

/**
 * Returns the ISO date strings for this weekend (upcoming Sat + Sun).
 * If today is Saturday: [today, tomorrow].
 * If today is Sunday:   [today] (weekend is ending).
 * Otherwise:            [next Saturday, next Sunday].
 */
function getWeekendDates(today = new Date()) {
  const d = today.getDay() // 0=Sun … 6=Sat
  if (d === 6) {
    // Saturday
    const sat = today.toISOString().split('T')[0]
    const sun = new Date(today)
    sun.setDate(today.getDate() + 1)
    return [sat, sun.toISOString().split('T')[0]]
  }
  if (d === 0) {
    // Sunday (end of weekend)
    return [today.toISOString().split('T')[0]]
  }
  // Mon–Fri: look ahead to Saturday and Sunday
  const daysToSat = 6 - d
  const sat = new Date(today)
  sat.setDate(today.getDate() + daysToSat)
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return [sat.toISOString().split('T')[0], sun.toISOString().split('T')[0]]
}

/**
 * Returns the weekend section label based on what day it is.
 */
function weekendRowLabel(today = new Date()) {
  const d = today.getDay()
  if (d === 6) return 'At Markets Today'
  if (d === 0) return 'At Markets Today'
  // How many days until Saturday?
  const daysToSat = 6 - d
  if (daysToSat === 1) return 'At Markets Tomorrow'
  return 'Vendors at Markets This Weekend'
}
