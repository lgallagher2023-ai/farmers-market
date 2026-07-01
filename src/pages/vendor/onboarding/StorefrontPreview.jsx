import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { generateStorefront } from '../../../lib/anthropic'
import { useAuth } from '../../../context/AuthContext'
import Button from '../../../components/ui/Button'
import { Input, Textarea } from '../../../components/ui/Input'
import Alert from '../../../components/ui/Alert'
import Spinner from '../../../components/ui/Spinner'

export default function StorefrontPreview() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const { vendorProfileId, survey } = location.state ?? {}

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [preview, setPreview] = useState({
    bio: '',
    suggestedBadges: [],
    suggestedCategories: [],
    templateRecommendation: '',
  })

  // Editable fields
  const [bio, setBio] = useState('')
  const [badges, setBadges] = useState([])

  useEffect(() => {
    if (!survey?.description && !survey?.vendorTypes?.length) {
      // No survey data — skip to walkthrough
      navigate('/vendor/signup/walkthrough', { replace: true })
      return
    }
    generatePreview()
  }, [])

  async function generatePreview() {
    try {
      const result = await generateStorefront(
        survey.description,
        survey.vendorTypes.join(', ')
      )
      setPreview(result)
      setBio(result.bio ?? '')
      setBadges(result.suggestedBadges ?? [])
    } catch (err) {
      // Fallback if AI call fails
      setBio(`Welcome to our store! We're excited to serve you at local farmers markets.`)
      setError('AI generation encountered an issue. You can edit the defaults below.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)

    // Save AI generated content for audit
    await supabase.from('ai_generated_content').insert({
      vendor_id: vendorProfileId,
      content_type: 'storefront_bio',
      original_content: preview.bio,
      edited_content: bio !== preview.bio ? bio : null,
      model_version: 'claude-3-5-haiku',
      user_rating: bio !== preview.bio ? 'edited' : 'accepted',
    })

    // Update vendor profile
    await supabase.from('vendor_profiles')
      .update({
        business_description: bio,
        badges,
      })
      .eq('id', vendorProfileId)

    navigate('/vendor/signup/walkthrough', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <div className="text-center">
          <p className="font-medium text-gray-800">Generating your storefront…</p>
          <p className="text-sm text-gray-500 mt-1">Our AI is reading your description and building a head start</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <span className="text-4xl">🎉</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Here's your head start</h1>
          <p className="text-sm text-gray-500 mt-1">
            Our AI generated this from your description. Edit anything before continuing.
          </p>
        </div>

        {error && <Alert type="warning" className="mb-4">{error}</Alert>}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Storefront bio</p>
              <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">AI generated</span>
            </div>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={5}
            />
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Suggested badges</p>
              <div className="flex flex-wrap gap-2">
                {badges.map(badge => (
                  <button
                    key={badge}
                    onClick={() => setBadges(b =>
                      b.includes(badge) ? b.filter(x => x !== badge) : [...b, badge]
                    )}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                      ${badges.includes(badge)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                  >
                    {badge}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Click to toggle on/off</p>
            </div>
          )}

          {/* Template recommendation */}
          {preview.templateRecommendation && (
            <div className="bg-brand-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-brand-700 mb-1">Recommended layout</p>
              <p className="text-sm text-brand-800">{preview.templateRecommendation}</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
          <Button className="flex-1" loading={saving} onClick={handleSave}>
            Save and continue →
          </Button>
        </div>
      </div>
    </div>
  )
}
