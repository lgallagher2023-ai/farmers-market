import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

const TABS = ['Public Profile', 'Contact & Address', 'Account Settings']

export default function VendorProfile() {
  const { profile, user, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [vendorProfile, setVendorProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const logoInputRef = useRef(null)

  // ── Public Profile state ────────────────────────────────────────────────
  const [publicForm, setPublicForm] = useState({
    business_name: '',
    business_description: '',
    years_in_business: '',
    logo_url: '',
  })
  const [social, setSocial] = useState({
    website: '', instagram: '', facebook: '', twitter: '',
  })

  // ── Contact state ───────────────────────────────────────────────────────
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    contact_email: '',
    contact_phone: '',
    physical_address: '',
  })

  // ── Account state ───────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [notifications, setNotifications] = useState({
    new_orders: true, low_stock: true, payouts: true, marketing: false,
  })

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        setError('Could not load profile: ' + error.message)
        setLoading(false)
        return
      }
      setVendorProfile(data)
      setPublicForm({
        business_name:        data.business_name ?? '',
        business_description: data.business_description ?? '',
        years_in_business:    data.years_in_business ?? '',
        logo_url:             data.logo_url ?? '',
      })
      setSocial({
        website:   data.storefront_settings?.social?.website   ?? '',
        instagram: data.storefront_settings?.social?.instagram ?? '',
        facebook:  data.storefront_settings?.social?.facebook  ?? '',
        twitter:   data.storefront_settings?.social?.twitter   ?? '',
      })
      setContactForm({
        first_name:       profile?.first_name    ?? '',
        last_name:        profile?.last_name     ?? '',
        contact_email:    data.contact_email     ?? '',
        contact_phone:    data.contact_phone     ?? '',
        physical_address: data.physical_address  ?? '',
      })
      setNotifications({
        new_orders: data.storefront_settings?.notifications?.new_orders ?? true,
        low_stock:  data.storefront_settings?.notifications?.low_stock  ?? true,
        payouts:    data.storefront_settings?.notifications?.payouts    ?? true,
        marketing:  data.storefront_settings?.notifications?.marketing  ?? false,
      })
      setLoading(false)
    }
    load()
  }, [user, profile])

  // ── Logo upload ─────────────────────────────────────────────────────────
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB')
      return
    }
    setUploadingLogo(true)
    setError('')
    const ext  = file.name.split('.').pop()
    const path = `logos/${vendorProfile.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('vendor-assets')
      .upload(path, file, { upsert: true })

    if (upErr) {
      // Bucket may not exist yet — show helpful message
      setError(
        upErr.message.includes('not found') || upErr.message.includes('Bucket')
          ? 'Storage bucket not set up yet. Run the storage SQL in Supabase, then retry.'
          : 'Upload failed: ' + upErr.message
      )
      setUploadingLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('vendor-assets')
      .getPublicUrl(path)

    // Persist immediately
    await supabase
      .from('vendor_profiles')
      .update({ logo_url: publicUrl })
      .eq('id', vendorProfile.id)

    setPublicForm(f => ({ ...f, logo_url: publicUrl }))
    setVendorProfile(v => ({ ...v, logo_url: publicUrl }))
    showSuccess('Logo updated!')
    setUploadingLogo(false)
  }

  // ── Save Public Profile ─────────────────────────────────────────────────
  async function savePublic(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const newSettings = {
      ...(vendorProfile.storefront_settings ?? {}),
      social: {
        website:   social.website.trim(),
        instagram: social.instagram.trim(),
        facebook:  social.facebook.trim(),
        twitter:   social.twitter.trim(),
      },
    }
    const { error } = await supabase
      .from('vendor_profiles')
      .update({
        business_name:        publicForm.business_name.trim(),
        business_description: publicForm.business_description.trim(),
        years_in_business:    publicForm.years_in_business ? Number(publicForm.years_in_business) : null,
        storefront_settings:  newSettings,
      })
      .eq('id', vendorProfile.id)

    if (error) setError(error.message)
    else {
      setVendorProfile(v => ({ ...v, ...publicForm, storefront_settings: newSettings }))
      showSuccess('Public profile saved!')
    }
    setSaving(false)
  }

  // ── Save Contact ────────────────────────────────────────────────────────
  async function saveContact(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Update users table (name)
    const { error: userErr } = await supabase
      .from('users')
      .update({
        first_name: contactForm.first_name.trim(),
        last_name:  contactForm.last_name.trim(),
      })
      .eq('id', user.id)

    // Update vendor_profiles (contact info)
    const { error: vpErr } = await supabase
      .from('vendor_profiles')
      .update({
        contact_email:    contactForm.contact_email.trim(),
        contact_phone:    contactForm.contact_phone.trim(),
        physical_address: contactForm.physical_address.trim(),
      })
      .eq('id', vendorProfile.id)

    const err = userErr || vpErr
    if (err) {
      setError(err.message)
    } else {
      await refreshProfile()
      showSuccess('Contact info saved!')
    }
    setSaving(false)
  }

  // ── Save Notification Prefs ─────────────────────────────────────────────
  async function saveNotifications() {
    setSaving(true)
    setError('')
    const newSettings = {
      ...(vendorProfile.storefront_settings ?? {}),
      notifications,
    }
    const { error } = await supabase
      .from('vendor_profiles')
      .update({ storefront_settings: newSettings })
      .eq('id', vendorProfile.id)

    if (error) setError(error.message)
    else {
      setVendorProfile(v => ({ ...v, storefront_settings: newSettings }))
      showSuccess('Notification preferences saved!')
    }
    setSaving(false)
  }

  // ── Change Password ─────────────────────────────────────────────────────
  async function changePassword(e) {
    e.preventDefault()
    setPwError('')
    if (pwForm.next.length < 8) {
      setPwError('Password must be at least 8 characters')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwords do not match')
      return
    }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    if (error) {
      setPwError(error.message)
    } else {
      setPwForm({ current: '', next: '', confirm: '' })
      showSuccess('Password updated!')
    }
    setPwSaving(false)
  }

  function showSuccess(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3500)
  }

  const initials = [profile?.first_name, profile?.last_name]
    .filter(Boolean).map(s => s[0].toUpperCase()).join('') || 'V'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Vendor Profile</h1>
      <p className="text-sm text-gray-500 mb-6">Manage your public listing and account settings</p>

      {/* Toasts */}
      {success && <Alert type="success" className="mb-5">{success}</Alert>}
      {error   && <Alert type="error"   className="mb-5">{error}</Alert>}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(i); setError(''); setSuccess('') }}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === i
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Public Profile ── */}
      {activeTab === 0 && (
        <form onSubmit={savePublic} className="space-y-6">
          {/* Logo */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Business Logo</h2>
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                {publicForm.logo_url ? (
                  <img
                    src={publicForm.logo_url}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-gray-400">
                    {initials}
                  </div>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? 'Uploading…' : 'Upload photo'}
                </Button>
                <p className="text-xs text-gray-500 mt-1.5">JPG, PNG or WebP · Max 5 MB</p>
                {publicForm.logo_url && (
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline mt-1"
                    onClick={async () => {
                      await supabase.from('vendor_profiles').update({ logo_url: null }).eq('id', vendorProfile.id)
                      setPublicForm(f => ({ ...f, logo_url: '' }))
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          {/* Business info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Business Info</h2>
            <Input
              label="Business name"
              value={publicForm.business_name}
              onChange={e => setPublicForm(f => ({ ...f, business_name: e.target.value }))}
              required
            />
            <Textarea
              label="About us / Story"
              value={publicForm.business_description}
              onChange={e => setPublicForm(f => ({ ...f, business_description: e.target.value }))}
              rows={5}
              hint="Tell customers who you are, how you got started, and what makes your products special."
              placeholder="We've been farming this land since 1998…"
            />
            <Input
              label="Years in business"
              type="number"
              min="0"
              max="200"
              value={publicForm.years_in_business}
              onChange={e => setPublicForm(f => ({ ...f, years_in_business: e.target.value }))}
              placeholder="e.g. 10"
            />
          </div>

          {/* Social links */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Social & Web Links</h2>
            <Input
              label="Website"
              type="url"
              value={social.website}
              onChange={e => setSocial(s => ({ ...s, website: e.target.value }))}
              placeholder="https://yourfarm.com"
            />
            <Input
              label="Instagram"
              value={social.instagram}
              onChange={e => setSocial(s => ({ ...s, instagram: e.target.value }))}
              placeholder="@yourhandle"
            />
            <Input
              label="Facebook"
              value={social.facebook}
              onChange={e => setSocial(s => ({ ...s, facebook: e.target.value }))}
              placeholder="facebook.com/yourpage"
            />
            <Input
              label="Twitter / X"
              value={social.twitter}
              onChange={e => setSocial(s => ({ ...s, twitter: e.target.value }))}
              placeholder="@yourhandle"
            />
          </div>

          <Button type="submit" loading={saving} size="lg" className="w-full">
            Save public profile
          </Button>
        </form>
      )}

      {/* ── Tab 1: Contact & Address ── */}
      {activeTab === 1 && (
        <form onSubmit={saveContact} className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Your Name</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                value={contactForm.first_name}
                onChange={e => setContactForm(f => ({ ...f, first_name: e.target.value }))}
              />
              <Input
                label="Last name"
                value={contactForm.last_name}
                onChange={e => setContactForm(f => ({ ...f, last_name: e.target.value }))}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Contact Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account email</label>
              <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                {user?.email}
              </p>
              <p className="text-xs text-gray-400 mt-1">To change your login email, contact support.</p>
            </div>
            <Input
              label="Contact email (shown on storefront)"
              type="email"
              value={contactForm.contact_email}
              onChange={e => setContactForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="business@example.com"
            />
            <Input
              label="Contact phone"
              type="tel"
              value={contactForm.contact_phone}
              onChange={e => setContactForm(f => ({ ...f, contact_phone: e.target.value }))}
              placeholder="(555) 000-0000"
            />
            <Input
              label="Physical address (optional)"
              value={contactForm.physical_address}
              onChange={e => setContactForm(f => ({ ...f, physical_address: e.target.value }))}
              placeholder="123 Main St, Springfield, IL 62701"
              hint="Only shown if you offer local pickup from your farm or shop."
            />
          </div>

          <Button type="submit" loading={saving} size="lg" className="w-full">
            Save contact info
          </Button>
        </form>
      )}

      {/* ── Tab 2: Account Settings ── */}
      {activeTab === 2 && (
        <div className="space-y-6">
          {/* Password change */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
            {pwError && <Alert type="error" className="mb-4">{pwError}</Alert>}
            <form onSubmit={changePassword} className="space-y-3">
              <Input
                label="New password"
                type="password"
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <Input
                label="Confirm new password"
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <Button type="submit" loading={pwSaving} size="md">
                Update password
              </Button>
            </form>
          </div>

          {/* Notification preferences */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Notification Preferences</h2>
            <p className="text-sm text-gray-500 mb-4">Choose what you want to be notified about.</p>
            <div className="space-y-3">
              {[
                { key: 'new_orders', label: 'New orders', desc: 'When a customer places an order with you' },
                { key: 'low_stock',  label: 'Low stock alerts', desc: 'When a product nears its stock threshold' },
                { key: 'payouts',    label: 'Payout updates', desc: 'When a payout is initiated or completed' },
                { key: 'marketing',  label: 'Marketing & tips', desc: 'Platform news, vendor tips, and promotions' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={notifications[key]}
                    onChange={e => setNotifications(n => ({ ...n, [key]: e.target.checked }))}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Button
                type="button"
                loading={saving}
                size="md"
                onClick={saveNotifications}
              >
                Save preferences
              </Button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-red-100 p-5">
            <h2 className="font-semibold text-red-700 mb-1">Danger Zone</h2>
            <p className="text-sm text-gray-500 mb-3">
              To close your vendor account or request a data export, please contact{' '}
              <a href="mailto:support@farmersmarket.app" className="text-brand-600 hover:underline">
                support@farmersmarket.app
              </a>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
