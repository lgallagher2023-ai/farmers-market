import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import Button from '../../../components/ui/Button'
import { Input, Textarea, Select } from '../../../components/ui/Input'

const VENDOR_TYPES = [
  'Produce Farmer', 'Bakery', 'Meat & Poultry', 'Dairy & Cheese',
  'Craft Maker', 'Clothing Designer', 'Herbalist',
]

const FULFILLMENT_OPTIONS = [
  { value: 'market_pickup',    label: 'At a farmers market' },
  { value: 'standalone_pickup',label: 'Scheduled pickup from my location' },
  { value: 'local_delivery',   label: 'Local delivery' },
  { value: 'shipping',         label: 'Shipping' },
]

const SELLING_CHANNELS = [
  'Farmers markets', 'My own website', 'Etsy / online marketplace',
  'Local grocery store', 'CSA / subscription box', 'Social media',
]

const GOALS = [
  'Reach more customers', 'Manage orders more easily', 'Accept pre-orders',
  'Grow my online presence', 'Track inventory', 'Get analytics on my sales',
]

export default function VendorSurvey() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState('intro') // intro | survey | text
  const [loading, setLoading] = useState(false)

  const [survey, setSurvey] = useState({
    vendorTypes: [],
    yearsInBusiness: '',
    approxProducts: '',
    currentChannels: [],
    goals: [],
    fulfillmentMethods: [],
    description: '',
  })

  function toggle(field, value) {
    setSurvey(s => ({
      ...s,
      [field]: s[field].includes(value)
        ? s[field].filter(v => v !== value)
        : [...s[field], value],
    }))
  }

  async function skip() {
    setLoading(true)
    navigate('/vendor/dashboard', { replace: true })
  }

  async function handleSubmit() {
    setLoading(true)

    // Get vendor profile id
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!vp) { setLoading(false); return }

    // Update vendor profile with survey data
    await supabase.from('vendor_profiles')
      .update({
        ai_survey_text: survey.description,
        years_in_business: parseInt(survey.yearsInBusiness) || null,
        fulfillment_methods: survey.fulfillmentMethods,
        onboarding_completed: false, // set true after walkthrough
      })
      .eq('id', vp.id)

    // Navigate to AI-generated storefront preview
    navigate('/vendor/signup/preview', {
      state: {
        vendorProfileId: vp.id,
        survey,
      },
      replace: true,
    })
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center">
          <span className="text-5xl">✨</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Let's set up your storefront</h1>
          <p className="mt-3 text-gray-500 text-sm leading-relaxed">
            Answer a few questions about your business and our AI will give you a head start —
            pre-filled bio, suggested categories, and a storefront layout tailored to your vendor type.
          </p>
          <p className="mt-2 text-xs text-gray-400">All questions are optional and can be skipped.</p>
          <div className="mt-8 space-y-3">
            <Button onClick={() => setStep('survey')} className="w-full" size="lg">
              Let's go
            </Button>
            <button
              onClick={skip}
              disabled={loading}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              Skip setup, go to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Survey ─────────────────────────────────────────────────────────────────
  if (step === 'survey') {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tell us about your business</h2>

          {/* Vendor types */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">What type of vendor are you? <span className="font-normal text-gray-400">(select all that apply)</span></p>
            <div className="grid grid-cols-2 gap-2">
              {VENDOR_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggle('vendorTypes', type)}
                  className={`px-3 py-2.5 rounded-xl text-sm text-left border-2 transition-colors
                    ${survey.vendorTypes.includes(type)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Years / products */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Select
              label="Years in business"
              value={survey.yearsInBusiness}
              onChange={e => setSurvey(s => ({ ...s, yearsInBusiness: e.target.value }))}
            >
              <option value="">Select…</option>
              <option value="0">Less than 1 year</option>
              <option value="1">1–2 years</option>
              <option value="3">3–5 years</option>
              <option value="6">6–10 years</option>
              <option value="11">10+ years</option>
            </Select>
            <Select
              label="Approx. # of products"
              value={survey.approxProducts}
              onChange={e => setSurvey(s => ({ ...s, approxProducts: e.target.value }))}
            >
              <option value="">Select…</option>
              <option value="1">1–10</option>
              <option value="11">11–50</option>
              <option value="51">51–100</option>
              <option value="101">100+</option>
            </Select>
          </div>

          {/* Fulfillment */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Fulfillment methods you offer</p>
            <div className="space-y-2">
              {FULFILLMENT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggle('fulfillmentMethods', value)}
                  className={`w-full px-4 py-3 rounded-xl text-sm text-left border-2 transition-colors
                    ${survey.fulfillmentMethods.includes(value)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Current channels */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Where do you currently sell?</p>
            <div className="grid grid-cols-2 gap-2">
              {SELLING_CHANNELS.map(ch => (
                <button
                  key={ch}
                  onClick={() => toggle('currentChannels', ch)}
                  className={`px-3 py-2.5 rounded-xl text-sm text-left border-2 transition-colors
                    ${survey.currentChannels.includes(ch)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Goals */}
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 mb-2">Primary goals on this platform</p>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(goal => (
                <button
                  key={goal}
                  onClick={() => toggle('goals', goal)}
                  className={`px-3 py-2.5 rounded-xl text-sm text-left border-2 transition-colors
                    ${survey.goals.includes(goal)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('intro')}>Back</Button>
            <Button className="flex-1" onClick={() => setStep('text')}>Continue</Button>
          </div>
          <button onClick={skip} className="w-full text-xs text-gray-400 hover:text-gray-600 mt-3 py-2">
            Skip and go to dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Description text ───────────────────────────────────────────────────────
  if (step === 'text') {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="max-w-lg mx-auto">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Describe your business</h2>
            <p className="text-sm text-gray-500 mt-1">
              Our AI reads this to generate your storefront bio, product suggestions, and more.
              The more detail, the better — share your story, what makes you unique, your best products.
            </p>
          </div>

          <Textarea
            label="Business description"
            value={survey.description}
            onChange={e => setSurvey(s => ({ ...s, description: e.target.value }))}
            rows={8}
            placeholder="e.g. We're a third-generation family farm in upstate New York specializing in heirloom tomatoes and fresh herbs. We've been attending the Burlington Farmers Market every Saturday for 12 years. Our standout products are our brandywine tomatoes and hand-dried herb bundles…"
            hint="Aim for at least 100 words for the best AI results."
          />

          <div className="mt-8 flex gap-3">
            <Button variant="secondary" onClick={() => setStep('survey')}>Back</Button>
            <Button className="flex-1" loading={loading} onClick={handleSubmit}>
              Generate my storefront →
            </Button>
          </div>
          <button onClick={skip} className="w-full text-xs text-gray-400 hover:text-gray-600 mt-3 py-2">
            Skip and go to dashboard
          </button>
        </div>
      </div>
    )
  }
}
