import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const PRODUCT_CATEGORIES = [
  { id: null, label: '🥬 Produce',         key: 'Produce' },
  { id: null, label: '🥩 Meats',           key: 'Meats' },
  { id: null, label: '🧀 Dairy',           key: 'Dairy' },
  { id: null, label: '🥐 Baked Goods',     key: 'Baked Goods' },
  { id: null, label: '🍬 Candies & Sweets',key: 'Candies & Sweets' },
  { id: null, label: '🍿 Snacks',          key: 'Snacks' },
  { id: null, label: '🥤 Beverages',       key: 'Beverages' },
  { id: null, label: '🎨 Crafts',          key: 'Crafts' },
  { id: null, label: '👕 Clothing',        key: 'Clothing' },
  { id: null, label: '💊 Health & Wellness',key: 'Health & Wellness' },
]

const FULFILLMENT_OPTIONS = [
  { value: 'market',   label: '🏪 At a farmers market' },
  { value: 'pickup',   label: '📦 Scheduled pickup' },
  { value: 'delivery', label: '🚚 Local delivery' },
  { value: 'shipping', label: '📮 Shipped to me' },
]

export default function CustomerSurvey() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState('intro') // intro | zip | categories | fulfillment
  const [zipCode, setZipCode] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedFulfillment, setSelectedFulfillment] = useState([])
  const [loading, setLoading] = useState(false)

  function toggleCategory(key) {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    )
  }

  function toggleFulfillment(val) {
    setSelectedFulfillment(prev =>
      prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]
    )
  }

  async function skip() {
    setLoading(true)
    await supabase.from('customer_profiles')
      .update({ survey_skipped: true })
      .eq('user_id', user.id)
    navigate('/', { replace: true })
  }

  async function finish() {
    setLoading(true)

    // Resolve category IDs from names
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('category_type', 'product')
      .in('name', selectedCategories)

    const categoryIds = (cats ?? []).map(c => c.id)

    await supabase.from('customer_profiles')
      .update({
        zip_code: zipCode.trim() || null,
        product_preferences: categoryIds,
        fulfillment_preferences: selectedFulfillment,
        survey_completed_at: new Date().toISOString(),
        survey_skipped: false,
      })
      .eq('user_id', user.id)

    // Track behavior event
    await supabase.from('user_behavior').insert({
      customer_id: user.id,
      event_type: 'survey_completed',
      entity_type: 'customer',
      entity_id: user.id,
    })

    navigate('/', { replace: true })
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center">
          <span className="text-5xl">🎯</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Personalize your experience</h1>
          <p className="mt-3 text-gray-500 text-sm leading-relaxed">
            Answer 3 quick questions so we can show you the vendors and products you care about most.
            You can always update this later.
          </p>
          <div className="mt-8 space-y-3">
            <Button onClick={() => setStep('zip')} className="w-full" size="lg">
              Get started (takes 30 sec)
            </Button>
            <button
              onClick={skip}
              disabled={loading}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Zip code ───────────────────────────────────────────────────────────────
  if (step === 'zip') {
    return (
      <SurveyShell step={1} total={3} onSkip={skip} loading={loading}>
        <h2 className="text-xl font-bold text-gray-900">Where are you located?</h2>
        <p className="text-sm text-gray-500 mt-1">We'll show you vendors and markets near you.</p>
        <div className="mt-6">
          <Input
            label="Zip code"
            value={zipCode}
            onChange={e => setZipCode(e.target.value)}
            placeholder="e.g. 90210"
            maxLength={10}
          />
        </div>
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" onClick={() => setStep('intro')}>Back</Button>
          <Button className="flex-1" onClick={() => setStep('categories')}>Continue</Button>
        </div>
      </SurveyShell>
    )
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  if (step === 'categories') {
    return (
      <SurveyShell step={2} total={3} onSkip={skip} loading={loading}>
        <h2 className="text-xl font-bold text-gray-900">What are you looking for?</h2>
        <p className="text-sm text-gray-500 mt-1">Select all that apply.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {PRODUCT_CATEGORIES.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className={`px-3 py-3 rounded-xl text-sm font-medium text-left border-2 transition-colors
                ${selectedCategories.includes(key)
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" onClick={() => setStep('zip')}>Back</Button>
          <Button className="flex-1" onClick={() => setStep('fulfillment')}>Continue</Button>
        </div>
      </SurveyShell>
    )
  }

  // ── Fulfillment ────────────────────────────────────────────────────────────
  if (step === 'fulfillment') {
    return (
      <SurveyShell step={3} total={3} onSkip={skip} loading={loading}>
        <h2 className="text-xl font-bold text-gray-900">How do you want to receive your goods?</h2>
        <p className="text-sm text-gray-500 mt-1">Select all that apply.</p>
        <div className="mt-6 space-y-2">
          {FULFILLMENT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleFulfillment(value)}
              className={`w-full px-4 py-4 rounded-xl text-sm font-medium text-left border-2 transition-colors
                ${selectedFulfillment.includes(value)
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" onClick={() => setStep('categories')}>Back</Button>
          <Button className="flex-1" loading={loading} onClick={finish}>Finish</Button>
        </div>
      </SurveyShell>
    )
  }
}

function SurveyShell({ step, total, onSkip, loading, children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="max-w-sm w-full">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brand-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        {children}
        <button
          onClick={onSkip}
          disabled={loading}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 py-2"
        >
          Skip survey
        </button>
      </div>
    </div>
  )
}
