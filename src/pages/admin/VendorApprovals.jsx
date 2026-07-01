import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader } from '../../components/ui/Spinner'
import { StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

export default function AdminVendorApprovals() {
  const { user } = useAuth()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [acting, setActing] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('*, users!inner(email, first_name, last_name, created_at)')
      .order('created_at', { ascending: false })

    setVendors(data ?? [])
    setLoading(false)
  }

  async function updateStatus(vendor, newStatus, reason = null) {
    setActing(vendor.id)
    setError('')

    const { error } = await supabase
      .from('vendor_profiles')
      .update({ status: newStatus })
      .eq('id', vendor.id)

    if (error) {
      setError(error.message)
    } else {
      // Log admin action (Architecture Rule #5 — every action timestamped)
      await supabase.from('admin_actions').insert({
        admin_user_id: user.id,
        action_type: newStatus === 'active' ? 'vendor_approval' : 'vendor_suspension',
        entity_type: 'vendor',
        entity_id: vendor.id,
        reason,
        previous_state: { status: vendor.status },
        new_state: { status: newStatus },
      })

      setVendors(v => v.map(x => x.id === vendor.id ? { ...x, status: newStatus } : x))
    }
    setActing(null)
  }

  async function approve(vendor) {
    await updateStatus(vendor, 'active')
  }

  async function suspend(vendor) {
    const reason = prompt('Reason for suspension:')
    if (!reason) return
    await updateStatus(vendor, 'suspended', reason)
  }

  async function reinstate(vendor) {
    await updateStatus(vendor, 'active', 'Reinstated by admin')
  }

  const filtered = vendors.filter(v =>
    filter === 'all' ? true : v.status === filter
  )

  const counts = { pending: 0, active: 0, suspended: 0 }
  vendors.forEach(v => { if (counts[v.status] !== undefined) counts[v.status]++ })

  if (loading) return <PageLoader />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vendor Approvals</h1>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-700">{counts.pending}</p>
          <p className="text-sm text-yellow-600">Pending review</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{counts.active}</p>
          <p className="text-sm text-green-600">Active vendors</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-700">{counts.suspended}</p>
          <p className="text-sm text-red-600">Suspended</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {['pending', 'active', 'suspended', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
              ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No vendors in this category</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(vendor => (
            <div key={vendor.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{vendor.business_name}</p>
                    <StatusBadge status={vendor.status} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {vendor.users?.first_name} {vendor.users?.last_name} · {vendor.users?.email}
                  </p>
                  {vendor.contact_phone && (
                    <p className="text-sm text-gray-500">{vendor.contact_phone}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Signed up {new Date(vendor.users?.created_at).toLocaleDateString()}
                  </p>

                  {/* Survey summary */}
                  {vendor.ai_survey_text && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Business description</p>
                      <p className="text-sm text-gray-700 line-clamp-3">{vendor.ai_survey_text}</p>
                    </div>
                  )}

                  {vendor.fulfillment_methods?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {vendor.fulfillment_methods.map(m => (
                        <span key={m} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {m.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  {vendor.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => approve(vendor)}
                        disabled={acting === vendor.id}
                      >
                        {acting === vendor.id ? '…' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => suspend(vendor)}
                        disabled={acting === vendor.id}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {vendor.status === 'active' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => suspend(vendor)}
                      disabled={acting === vendor.id}
                    >
                      Suspend
                    </Button>
                  )}
                  {vendor.status === 'suspended' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reinstate(vendor)}
                      disabled={acting === vendor.id}
                    >
                      Reinstate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
