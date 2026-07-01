import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCents } from '../../lib/stripe'
import { PageLoader } from '../../components/ui/Spinner'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [vendorsRes, ordersRes, marketsRes] = await Promise.all([
      supabase.from('vendor_profiles').select('id, status'),
      supabase.from('orders').select('id, total_cents, status, platform_fee_cents, created_at'),
      supabase.from('markets').select('id, status'),
    ])

    const vendors = vendorsRes.data ?? []
    const orders = ordersRes.data ?? []
    const markets = marketsRes.data ?? []

    const today = new Date().toISOString().split('T')[0]
    const todayOrders = orders.filter(o => o.created_at?.startsWith(today))

    setStats({
      vendors: {
        total: vendors.length,
        pending: vendors.filter(v => v.status === 'pending').length,
        active: vendors.filter(v => v.status === 'active').length,
      },
      orders: {
        total: orders.length,
        today: todayOrders.length,
        gmv: orders.reduce((s, o) => s + (o.total_cents ?? 0), 0),
        platformRevenue: orders.reduce((s, o) => s + (o.platform_fee_cents ?? 0), 0),
      },
      markets: {
        total: markets.length,
        active: markets.filter(m => m.status === 'active').length,
      },
    })
    setLoading(false)
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active vendors" value={stats.vendors.active} />
        <StatCard
          label="Pending approval"
          value={stats.vendors.pending}
          color={stats.vendors.pending > 0 ? 'yellow' : 'gray'}
          onClick={() => navigate('/admin/vendors')}
          actionLabel={stats.vendors.pending > 0 ? 'Review →' : null}
        />
        <StatCard label="Total orders" value={stats.orders.total} />
        <StatCard label="Orders today" value={stats.orders.today} color="green" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="Gross merchandise value" value={formatCents(stats.orders.gmv)} />
        <StatCard label="Platform revenue" value={formatCents(stats.orders.platformRevenue)} color="green" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          onClick={() => navigate('/admin/vendors')}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
        >
          <p className="text-sm font-semibold text-gray-700 mb-1">Vendor approvals</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.vendors.pending}</p>
          <p className="text-xs text-gray-400 mt-1">awaiting review</p>
        </div>
        <div
          onClick={() => navigate('/admin/markets')}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
        >
          <p className="text-sm font-semibold text-gray-700 mb-1">Markets</p>
          <p className="text-3xl font-bold text-gray-900">{stats.markets.active}</p>
          <p className="text-xs text-gray-400 mt-1">active of {stats.markets.total}</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, onClick, actionLabel }) {
  const colors = { yellow: 'text-yellow-600', green: 'text-green-600', gray: 'text-gray-900' }
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color] ?? 'text-gray-900'}`}>{value}</p>
      {actionLabel && <p className="text-xs text-brand-600 mt-1">{actionLabel}</p>}
    </div>
  )
}
