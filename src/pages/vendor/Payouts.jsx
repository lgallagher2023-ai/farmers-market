import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { PageLoader } from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'

export default function VendorPayouts() {
  const { user } = useAuth()
  const [vendor, setVendor] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('id, stripe_connect_account_id, payout_schedule')
      .eq('user_id', user.id)
      .single()

    if (!vp) { setLoading(false); return }
    setVendor(vp)

    const { data } = await supabase
      .from('vendor_payouts')
      .select('*')
      .eq('vendor_id', vp.id)
      .order('initiated_at', { ascending: false })

    setPayouts(data ?? [])
    setLoading(false)
  }

  async function connectStripe() {
    // In production: call a Supabase Edge Function that creates a Stripe Connect
    // onboarding link and redirects the vendor to Stripe's hosted flow.
    alert('This would redirect you to Stripe to connect your bank account.\n\nImplement the "create-stripe-connect-link" Edge Function to handle this.')
  }

  if (loading) return <PageLoader />

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payouts</h1>

      {/* Connect banner */}
      {!vendor?.stripe_connect_account_id ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6 text-center">
          <p className="text-2xl mb-3">🏦</p>
          <p className="font-semibold text-yellow-900 mb-1">Connect your bank account</p>
          <p className="text-sm text-yellow-700 mb-4">
            Link your bank via Stripe to receive payouts automatically. All payments are held securely until released.
          </p>
          <Button onClick={connectStripe}>Connect with Stripe</Button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium text-green-800 text-sm">✓ Bank account connected</p>
            <p className="text-xs text-green-600 mt-0.5">Payouts on {vendor.payout_schedule} schedule</p>
          </div>
          <Button variant="secondary" size="sm" onClick={connectStripe}>Manage</Button>
        </div>
      )}

      {/* Payout history */}
      <h2 className="font-semibold text-gray-700 mb-3">Payout history</h2>
      {payouts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400">No payouts yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{formatCents(p.net_payout_cents)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Gross {formatCents(p.gross_sales_cents)} · Fee −{formatCents(p.platform_fee_deducted_cents)}
                    {p.refunds_deducted_cents > 0 && ` · Refunds −${formatCents(p.refunds_deducted_cents)}`}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
