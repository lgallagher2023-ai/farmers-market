import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import Button from '../../../components/ui/Button'

const STEPS = [
  {
    icon: '📦',
    title: 'Add your products',
    description: 'Create product listings with photos, variants (sizes, flavors, colors), and stock quantities. Your products appear on your storefront and in customer searches.',
    action: 'Try it: Products → New Product',
    route: '/vendor/products',
  },
  {
    icon: '📅',
    title: 'Schedule a market appearance',
    description: 'Tell customers when and where to find you. Set pre-order windows, product availability, and booth details. Followers get notified automatically.',
    action: 'Try it: Schedule → Add Appearance',
    route: '/vendor/schedule',
  },
  {
    icon: '📊',
    title: 'Manage incoming orders',
    description: 'New orders appear here in real time. Confirm, mark ready, and fulfill orders. Customers track their order status live.',
    action: 'Try it: Orders',
    route: '/vendor/orders',
  },
  {
    icon: '🎨',
    title: 'Customize your storefront',
    description: 'Choose a template designed for your vendor type, pick a color scheme, and arrange your sections. Preview before publishing.',
    action: 'Try it: Storefront',
    route: '/vendor/storefront',
  },
  {
    icon: '📦',
    title: 'Track your inventory',
    description: 'Set low-stock thresholds and get alerts before you run out. The platform can automatically hide items when they\'re sold out.',
    action: 'Try it: Inventory',
    route: '/vendor/inventory',
  },
]

export default function Walkthrough() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [completing, setCompleting] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  async function finish() {
    setCompleting(true)
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (vp) {
      await supabase.from('vendor_profiles')
        .update({ onboarding_completed: true })
        .eq('id', vp.id)
    }

    navigate('/vendor/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors
                ${i <= step ? 'bg-brand-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <span className="text-5xl">{current.icon}</span>
          <h2 className="mt-4 text-xl font-bold text-gray-900">{current.title}</h2>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">{current.description}</p>

          <div className="mt-6 bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Quick action</p>
            <button
              onClick={() => navigate(current.route)}
              className="text-sm text-brand-600 font-medium hover:underline"
            >
              {current.action}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          {isLast ? (
            <Button className="flex-1" loading={completing} onClick={finish}>
              Go to dashboard 🎉
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setStep(s => s + 1)}>
              Next
            </Button>
          )}
        </div>

        <button
          onClick={finish}
          disabled={completing}
          className="w-full text-xs text-gray-400 hover:text-gray-600 mt-3 py-2"
        >
          Skip walkthrough
        </button>
      </div>
    </div>
  )
}
