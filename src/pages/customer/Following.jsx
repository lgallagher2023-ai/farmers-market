import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader } from '../../components/ui/Spinner'

export default function Following() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [follows,      setFollows]      = useState([])   // [{follow_row + vendor_profiles}]
  const [appearances,  setAppearances]  = useState([])   // upcoming market appearances
  const [loading,      setLoading]      = useState(true)
  const [unfollowing,  setUnfollowing]  = useState({})   // { [followId]: true }

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)

    // Fetch active follows + joined vendor data in one call
    const { data: followData, error: followErr } = await supabase
      .from('follows')
      .select(`
        id,
        created_at,
        status,
        vendor_id,
        vendor_profiles (
          id,
          business_name,
          business_description,
          logo_url,
          banner_url,
          average_rating,
          follower_count,
          status,
          business_type,
          categories ( name )
        )
      `)
      .eq('customer_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (followErr) {
      setLoading(false)
      return
    }

    // Only keep follows where vendor is still active
    const activeFollows = (followData ?? []).filter(
      f => f.vendor_profiles?.status === 'active'
    )
    setFollows(activeFollows)

    // Fetch upcoming appearances for those vendor IDs
    if (activeFollows.length > 0) {
      const vendorIds = activeFollows.map(f => f.vendor_id)
      const today = new Date().toISOString().split('T')[0]

      const { data: appData } = await supabase
        .from('market_appearances')
        .select(`
          id,
          vendor_id,
          appearance_date,
          open_time,
          close_time,
          booth_number,
          pre_orders_accepted,
          markets ( name, city, state ),
          vendor_profiles ( business_name, logo_url )
        `)
        .in('vendor_id', vendorIds)
        .eq('status', 'scheduled')
        .gte('appearance_date', today)
        .order('appearance_date', { ascending: true })
        .limit(30)

      setAppearances(appData ?? [])
    }

    setLoading(false)
  }

  async function handleUnfollow(followId, vendorId) {
    setUnfollowing(u => ({ ...u, [followId]: true }))

    const { error } = await supabase
      .from('follows')
      .update({ status: 'inactive' })
      .eq('id', followId)

    if (!error) {
      setFollows(f => f.filter(row => row.id !== followId))
      setAppearances(a => a.filter(ap => ap.vendor_id !== vendorId))
    }

    setUnfollowing(u => { const next = { ...u }; delete next[followId]; return next })
  }

  if (loading) return <PageLoader />

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Following</h1>
        <p className="text-xs text-gray-500">
          {follows.length === 0
            ? 'Vendors you follow will appear here'
            : `${follows.length} vendor${follows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Empty state */}
      {follows.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <span className="text-6xl mb-5">🌿</span>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No vendors yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Follow vendors to keep up with their market appearances, new products, and promotions.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
          >
            Discover vendors
          </button>
        </div>
      )}

      {/* Followed vendors */}
      {follows.length > 0 && (
        <section className="px-4 pt-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Vendors you follow</h2>
          <div className="space-y-3">
            {follows.map(follow => (
              <VendorCard
                key={follow.id}
                follow={follow}
                unfollowing={!!unfollowing[follow.id]}
                onUnfollow={() => handleUnfollow(follow.id, follow.vendor_id)}
                onNavigate={() => navigate(`/vendors/${follow.vendor_id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming market appearances */}
      {appearances.length > 0 && (
        <section className="px-4 pt-7">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Upcoming at markets</h2>
          <div className="space-y-2">
            {appearances.map(ap => (
              <AppearanceCard key={ap.id} appearance={ap} />
            ))}
          </div>
        </section>
      )}

      {/* If following but no upcoming appearances */}
      {follows.length > 0 && appearances.length === 0 && (
        <div className="px-4 pt-7">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Upcoming at markets</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-2xl mb-2">📅</p>
            <p className="text-sm text-gray-500">
              None of your followed vendors have upcoming market dates scheduled yet.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vendor Card ─────────────────────────────────────────────────────────────

function VendorCard({ follow, unfollowing, onUnfollow, onNavigate }) {
  const vp = follow.vendor_profiles
  if (!vp) return null

  const categoryName = vp.categories?.name ?? null
  const followDate   = new Date(follow.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Banner */}
      <button
        onClick={onNavigate}
        className="w-full relative h-24 bg-gradient-to-r from-brand-100 to-brand-200 block focus:outline-none"
      >
        {vp.banner_url ? (
          <img
            src={vp.banner_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl opacity-20"
          >
            🌿
          </div>
        )}
      </button>

      {/* Info row */}
      <div className="px-4 pb-4">
        {/* Logo + name row */}
        <div className="flex items-start justify-between gap-3 -mt-5 mb-2">
          <button onClick={onNavigate} className="flex items-end gap-3 flex-1 min-w-0 focus:outline-none">
            <div className="h-10 w-10 rounded-xl bg-white border-2 border-white shadow-md flex-shrink-0 overflow-hidden flex items-center justify-center text-lg">
              {vp.logo_url
                ? <img src={vp.logo_url} alt="" className="h-full w-full object-cover" />
                : '🌿'}
            </div>
            <div className="pb-0.5 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate leading-tight">{vp.business_name}</p>
              {categoryName && (
                <p className="text-xs text-brand-600 font-medium">{categoryName}</p>
              )}
            </div>
          </button>

          {/* Unfollow button */}
          <button
            onClick={onUnfollow}
            disabled={unfollowing}
            className="mt-6 flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            {unfollowing ? 'Unfollowing…' : 'Unfollow'}
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {vp.average_rating > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              {Number(vp.average_rating).toFixed(1)}
            </span>
          )}
          {vp.follower_count > 0 && (
            <span>{vp.follower_count} followers</span>
          )}
          <span className="ml-auto">Following since {followDate}</span>
        </div>

        {/* Description snippet */}
        {vp.business_description && (
          <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {vp.business_description}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Appearance Card ──────────────────────────────────────────────────────────

function AppearanceCard({ appearance }) {
  const ap = appearance
  const market = ap.markets
  const vendor = ap.vendor_profiles

  const dateStr = new Date(ap.appearance_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  // Days from today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const apDate = new Date(ap.appearance_date + 'T00:00:00')
  const diffDays = Math.round((apDate - today) / 86400000)
  const badge = diffDays === 0
    ? 'Today'
    : diffDays === 1
    ? 'Tomorrow'
    : `In ${diffDays} days`
  const badgeColor = diffDays <= 1
    ? 'bg-green-100 text-green-700'
    : diffDays <= 7
    ? 'bg-brand-50 text-brand-700'
    : 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
      {/* Vendor logo */}
      <div className="h-10 w-10 rounded-lg flex-shrink-0 overflow-hidden bg-brand-50 flex items-center justify-center text-base">
        {vendor?.logo_url
          ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover rounded-lg" />
          : '🌿'}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{vendor?.business_name}</p>
        <p className="text-xs text-gray-500 truncate">
          {market?.name}
          {market?.city ? ` · ${market.city}${market.state ? `, ${market.state}` : ''}` : ''}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {dateStr}
          {ap.open_time  ? ` · ${formatTime(ap.open_time)}`  : ''}
          {ap.close_time ? ` – ${formatTime(ap.close_time)}` : ''}
          {ap.booth_number ? ` · Booth ${ap.booth_number}` : ''}
        </p>
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
          {badge}
        </span>
        {ap.pre_orders_accepted && (
          <span className="text-xs text-blue-600 font-medium">Pre-orders</span>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}
