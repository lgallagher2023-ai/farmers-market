import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { PageLoader } from '../../components/ui/Spinner'
import { StatusBadge } from '../../components/ui/Badge'

export default function VendorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('id, business_name, status, average_rating, follower_count, stripe_connect_account_id')
      .eq('user_id', user.id)
      .single()

    if (!vp) { setLoading(false); return }

    const now = new Date()
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [ordersRes, lowStockRes, appearancesRes] = await Promise.all([
      supabase
        .from('order_items')
        .select('order_id, fulfillment_status, vendor_payout_cents, created_at, orders!inner(status, created_at)')
        .eq('vendor_id', vp.id),

      supabase
        .from('product_variants')
        .select('id, variant_name, stock_quantity, low_stock_threshold, products!inner(name, vendor_id)')
        .eq('products.vendor_id', vp.id)
        .eq('status', 'active'),

      supabase
        .from('market_appearances')
        .select('id, appearance_date, market_id, status, markets!inner(name)')
        .eq('vendor_id', vp.id)
        .gte('appearance_date', new Date().toISOString().split('T')[0])
        .order('appearance_date', { ascending: true })
        .limit(5),
    ])

    const items = ordersRes.data ?? []
    const today = items.filter(i => i.created_at >= startOfDay)
    const pending = items.filter(i => i.fulfillment_status === 'pending')
    const confirmed = items.filter(i => i.fulfillment_status === 'confirmed')

    setData({
      vendor: vp,
      stats: {
        newOrders: pending.length,
        pendingOrders: confirmed.length,
        completedToday: today.filter(i => i.fulfillment_status === 'fulfilled').length,
        revenueToday: today.reduce((s, i) => s + (i.vendor_payout_cents ?? 0), 0),
        revenueWeek: items.filter(i => i.created_at >= startOfWeek)
          .reduce((s, i) => s + (i.vendor_payout_cents ?? 0), 0),
        revenueMonth: items.filter(i => i.created_at >= startOfMonth)
          .reduce((s, i) => s + (i.vendor_payout_cents ?? 0), 0),
      },
      // Filter client-side: PostgREST can't compare two columns directly
      lowStock: (lowStockRes.data ?? []).filter(v => v.stock_quantity <= v.low_stock_threshold),
      appearances: appearancesRes.data ?? [],
      pendingItems: pending.slice(0, 5),
    })
    setLoading(false)
  }

  if (loading) return <PageLoader />
  if (!data) return <div className="p-8 text-gray-500">Could not load dashboard.</div>

  const { vendor, stats, lowStock, appearances } = data

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendor.business_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendor.status === 'pending'
              ? '⏳ Awaiting admin approval — your storefront is not yet public'
              : `⭐ ${vendor.average_rating.toFixed(1)} · ${vendor.follower_count} followers`}
          </p>
        </div>
        <StatusBadge status={vendor.status} />
      </div>

      {/* Stripe Connect banner */}
      {!vendor.stripe_connect_account_id && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-yellow-800 text-sm">Connect your bank account to receive payouts</p>
            <p className="text-xs text-yellow-600 mt-0.5">You can accept orders now, but payouts require Stripe Connect.</p>
          </div>
          <button
            onClick={() => navigate('/vendor/payouts')}
            className="text-sm font-medium text-yellow-700 border border-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-100"
          >
            Set up →
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="New orders" value={stats.newOrders} sub="awaiting confirmation" color="yellow" onClick={() => navigate('/vendor/orders')} />
        <StatCard label="Pending" value={stats.pendingOrders} sub="confirmed, not fulfilled" onClick={() => navigate('/vendor/orders')} />
        <StatCard label="Fulfilled today" value={stats.completedToday} sub="orders" color="green" />
        <StatCard label="Revenue today" value={formatCents(stats.revenueToday)} sub="your payout share" color="green" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Revenue this week" value={formatCents(stats.revenueWeek)} />
        <StatCard label="Revenue this month" value={formatCents(stats.revenueMonth)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Inventory alerts</h2>
            <button onClick={() => navigate('/vendor/inventory')} className="text-xs text-brand-600 hover:underline">
              Manage →
            </button>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">All products well stocked ✓</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.products?.name}</p>
                    <p className="text-xs text-gray-500">{v.variant_name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    v.stock_quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {v.stock_quantity === 0 ? 'Out of stock' : `${v.stock_quantity} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming appearances */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming appearances</h2>
            <button onClick={() => navigate('/vendor/schedule')} className="text-xs text-brand-600 hover:underline">
              Schedule →
            </button>
          </div>
          {appearances.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">No upcoming market dates</p>
              <button
                onClick={() => navigate('/vendor/schedule')}
                className="text-sm text-brand-600 font-medium hover:underline"
              >
                + Schedule an appearance
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {appearances.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.markets?.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(a.appearance_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, onClick }) {
  const colors = {
    yellow: 'text-yellow-600',
    green:  'text-green-600',
  }
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color] ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
