import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

// ─── Design System Constants ──────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    icon: '🏛',
    desc: 'Centered hero, balanced two-column products. Works for every vendor type.',
  },
  {
    id: 'modern',
    name: 'Modern',
    icon: '◼',
    desc: 'Full-width banner, offset logo, asymmetric grid. Bold and contemporary.',
  },
  {
    id: 'rustic',
    name: 'Rustic',
    icon: '🌾',
    desc: 'Warm card-based layout that puts your story front and center.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    icon: '○',
    desc: 'Clean lines, no distractions. Lets your products do the talking.',
  },
]

const COLOR_SCHEMES = [
  {
    id: 'earth',
    name: 'Earth',
    desc: 'Forest greens & warm amber — ideal for farms and produce',
    primary: '#4a7c59',
    accent: '#8b6914',
    bg: '#faf7f2',
    surface: '#ffffff',
    text: '#1c1917',
  },
  {
    id: 'fresh',
    name: 'Fresh',
    desc: 'Vibrant green on white — energetic and clean',
    primary: '#16a34a',
    accent: '#ca8a04',
    bg: '#f0fdf4',
    surface: '#ffffff',
    text: '#052e16',
  },
  {
    id: 'harvest',
    name: 'Harvest',
    desc: 'Warm amber & brown — perfect for baked goods and crafts',
    primary: '#d97706',
    accent: '#b45309',
    bg: '#fffbeb',
    surface: '#ffffff',
    text: '#1c1917',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    desc: 'Cool blue with purple accent — artisan and distinctive',
    primary: '#0284c7',
    accent: '#7c3aed',
    bg: '#f0f9ff',
    surface: '#ffffff',
    text: '#0c4a6e',
  },
  {
    id: 'slate',
    name: 'Slate',
    desc: 'Professional neutral — works for any vendor type',
    primary: '#475569',
    accent: '#334155',
    bg: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
  },
]

const FONT_PAIRINGS = [
  {
    id: 'serif-clean',
    name: 'Classic Serif',
    desc: 'Georgia headings, clean sans body — timeless and readable',
    heading: 'Georgia, "Times New Roman", serif',
    body: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'modern-sans',
    name: 'Modern Sans',
    desc: 'All sans-serif — contemporary and minimal',
    heading: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
    body: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'warm-humanist',
    name: 'Warm Humanist',
    desc: 'Palatino headings, Georgia body — warm and approachable',
    heading: '"Palatino Linotype", Palatino, Georgia, serif',
    body: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'bold-display',
    name: 'Bold Display',
    desc: 'Heavy headings, modern body — confident and energetic',
    heading: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
    body: 'system-ui, -apple-system, sans-serif',
  },
]

const DEFAULT_SECTIONS = [
  { id: 'hero',     label: 'Hero Banner',     desc: 'Banner image, logo & business name', icon: '🖼', visible: true },
  { id: 'about',    label: 'About Us',        desc: 'Your story and description',          icon: '📖', visible: true },
  { id: 'products', label: 'Products',        desc: 'Your product listings',               icon: '🛍', visible: true },
  { id: 'schedule', label: 'Market Schedule', desc: 'Upcoming appearances',                icon: '📅', visible: true },
  { id: 'reviews',  label: 'Reviews',         desc: 'Customer reviews and ratings',        icon: '⭐', visible: true },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StorefrontCustomizer() {
  const { user } = useAuth()

  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [vp,        setVp]        = useState(null)   // vendor_profiles row

  // Design settings
  const [template,     setTemplate]     = useState('classic')
  const [colorScheme,  setColorScheme]  = useState('earth')
  const [fontPairing,  setFontPairing]  = useState('serif-clean')
  const [sections,     setSections]     = useState(DEFAULT_SECTIONS)
  const [bannerUrl,    setBannerUrl]    = useState('')
  const [logoUrl,      setLogoUrl]      = useState('')
  const [bizName,      setBizName]      = useState('')
  const [bizDesc,      setBizDesc]      = useState('')

  // UI
  const [panel,          setPanel]          = useState('template') // template | style | media | sections
  const [mobilePreview,  setMobilePreview]  = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo,   setUploadingLogo]   = useState(false)

  const bannerRef = useRef(null)
  const logoRef   = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (error) { setError('Could not load profile: ' + error.message); setLoading(false); return }

      setVp(data)
      setBannerUrl(data.banner_url ?? '')
      setLogoUrl(data.logo_url ?? '')
      setBizName(data.business_name ?? '')
      setBizDesc(data.business_description ?? '')

      const s = data.storefront_settings ?? {}
      if (s.template)   setTemplate(s.template)
      if (s.colorScheme) setColorScheme(s.colorScheme)
      if (s.fontPairing) setFontPairing(s.fontPairing)
      if (s.sections?.length) {
        // Merge saved sections with defaults (handles new sections added later)
        const saved = s.sections
        const merged = DEFAULT_SECTIONS.map(def => {
          const match = saved.find(sv => sv.id === def.id)
          return match ?? def
        })
        // Preserve saved order
        const orderedIds = saved.map(s => s.id)
        merged.sort((a, b) => {
          const ai = orderedIds.indexOf(a.id)
          const bi = orderedIds.indexOf(b.id)
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
        setSections(merged)
      }
      setLoading(false)
    }
    load()
  }, [user])

  // ── Upload image ──────────────────────────────────────────────────────────
  async function uploadImg(file, folder, setUrl, setUploading, dbField) {
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB'); return }
    setUploading(true)
    setError('')
    const ext  = file.name.split('.').pop()
    const path = `${folder}/${vp.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('vendor-assets')
      .upload(path, file, { upsert: true })
    if (upErr) {
      setError(
        upErr.message.toLowerCase().includes('bucket')
          ? 'Storage bucket not set up yet — run supabase/migrations/002_storage.sql in Supabase first.'
          : 'Upload failed: ' + upErr.message,
      )
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('vendor-assets').getPublicUrl(path)
    await supabase.from('vendor_profiles').update({ [dbField]: publicUrl }).eq('id', vp.id)
    setUrl(publicUrl)
    setUploading(false)
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setError('')
    const newSettings = {
      ...(vp?.storefront_settings ?? {}),
      template,
      colorScheme,
      fontPairing,
      sections,
    }
    const { error } = await supabase
      .from('vendor_profiles')
      .update({ storefront_settings: newSettings })
      .eq('id', vp.id)
    if (error) {
      setError(error.message)
    } else {
      setVp(v => ({ ...v, storefront_settings: newSettings }))
      setSuccess('Storefront settings saved!')
      setTimeout(() => setSuccess(''), 4000)
    }
    setSaving(false)
  }

  const color = COLOR_SCHEMES.find(c => c.id === colorScheme) ?? COLOR_SCHEMES[0]
  const font  = FONT_PAIRINGS.find(f => f.id === fontPairing) ?? FONT_PAIRINGS[0]

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent" />
    </div>
  )

  // ── Mobile preview overlay ────────────────────────────────────────────────
  if (mobilePreview) return (
    <div className="fixed inset-0 z-50 bg-gray-200 flex flex-col" style={{ top: 56 }}>
      <div className="bg-gray-300 px-4 py-2 text-xs text-gray-600 font-medium flex items-center justify-between flex-shrink-0">
        <span>Live Preview</span>
        <button
          onClick={() => setMobilePreview(false)}
          className="text-brand-700 font-semibold"
        >
          ← Back to editor
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <StorefrontPreview
          template={template} color={color} font={font}
          sections={sections} bannerUrl={bannerUrl} logoUrl={logoUrl}
          bizName={bizName} bizDesc={bizDesc}
        />
      </div>
    </div>
  )

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">

      {/* Toolbar */}
      <div className="sticky top-14 md:top-0 z-20 bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Storefront Customization</h1>
          <p className="text-xs text-gray-500 hidden sm:block">How customers see your store</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobilePreview(true)}
            className="md:hidden text-xs font-medium text-brand-700 border border-brand-200 bg-brand-50 px-3 py-1.5 rounded-lg"
          >
            👁 Preview
          </button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(success || error) && (
        <div className="px-4 md:px-6 pt-3 flex-shrink-0">
          {success && <Alert type="success" className="mb-0">{success}</Alert>}
          {error   && <Alert type="error"   className="mb-0">{error}</Alert>}
        </div>
      )}

      {/* Body — settings left, preview right */}
      <div className="flex flex-1">

        {/* ── Settings panel ── */}
        <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col bg-gray-50 border-r border-gray-200">

          {/* Panel tabs */}
          <div className="flex bg-white border-b border-gray-100 overflow-x-auto flex-shrink-0">
            {[
              { id: 'template', label: 'Template' },
              { id: 'style',    label: 'Style' },
              { id: 'media',    label: 'Media' },
              { id: 'sections', label: 'Sections' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPanel(p.id)}
                className={`flex-1 whitespace-nowrap px-3 py-3 text-xs font-semibold border-b-2 transition-colors
                  ${panel === p.id
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">

            {/* ── TEMPLATE ── */}
            {panel === 'template' && (
              <>
                <p className="text-xs text-gray-500 mb-1">Choose an overall layout. All templates show your products, story, and schedule — just with different visual emphasis.</p>
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all
                      ${template === t.id
                        ? 'border-brand-500 bg-brand-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-xl">{t.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${template === t.id ? 'text-brand-700' : 'text-gray-900'}`}>{t.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                      </div>
                      {template === t.id && <span className="text-brand-600 font-bold">✓</span>}
                    </div>
                    <TemplateThumbnail id={t.id} color={color} />
                  </button>
                ))}
              </>
            )}

            {/* ── STYLE ── */}
            {panel === 'style' && (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Color Scheme</p>
                  <p className="text-xs text-gray-500 mb-3">Curated palettes that look great on all screens.</p>
                  <div className="space-y-2">
                    {COLOR_SCHEMES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setColorScheme(c.id)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3
                          ${colorScheme === c.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <div className="flex gap-1 flex-shrink-0">
                          <div className="h-6 w-6 rounded-full border border-white/50 shadow-sm" style={{ background: c.primary }} />
                          <div className="h-6 w-6 rounded-full border border-white/50 shadow-sm" style={{ background: c.accent }} />
                          <div className="h-6 w-6 rounded-full border border-gray-200"           style={{ background: c.bg }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${colorScheme === c.id ? 'text-brand-700' : 'text-gray-900'}`}>{c.name}</p>
                          <p className="text-xs text-gray-500 truncate">{c.desc}</p>
                        </div>
                        {colorScheme === c.id && <span className="text-brand-600 flex-shrink-0">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Font Pairing</p>
                  <p className="text-xs text-gray-500 mb-3">Typography sets the tone for your brand voice.</p>
                  <div className="space-y-2">
                    {FONT_PAIRINGS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFontPairing(f.id)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all
                          ${fontPairing === f.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm font-medium ${fontPairing === f.id ? 'text-brand-700' : 'text-gray-900'}`}>{f.name}</p>
                          {fontPairing === f.id && <span className="text-brand-600">✓</span>}
                        </div>
                        <p style={{ fontFamily: f.heading }} className="text-sm text-gray-800 leading-tight">Fresh From the Farm</p>
                        <p style={{ fontFamily: f.body }}   className="text-xs text-gray-500 mt-0.5">Local produce, artisan crafts & more</p>
                        <p className="text-xs text-gray-400 mt-1.5">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── MEDIA ── */}
            {panel === 'media' && (
              <>
                {/* Banner */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Banner Image</p>
                  <p className="text-xs text-gray-500 mb-3">Shown at the top of your storefront. 1200 × 400 px recommended.</p>
                  <div
                    className="rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-100 h-28 flex items-center justify-center mb-3 relative cursor-pointer hover:border-brand-300 transition-colors"
                    onClick={() => bannerRef.current?.click()}
                  >
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-gray-400 pointer-events-none">
                        <p className="text-3xl mb-1">🖼</p>
                        <p className="text-xs">Click to upload banner</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" loading={uploadingBanner} onClick={() => bannerRef.current?.click()}>
                      {bannerUrl ? 'Change banner' : 'Upload banner'}
                    </Button>
                    {bannerUrl && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={async () => {
                          await supabase.from('vendor_profiles').update({ banner_url: null }).eq('id', vp.id)
                          setBannerUrl('')
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={bannerRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, 'banners', setBannerUrl, setUploadingBanner, 'banner_url') }}
                  />
                </div>

                {/* Logo */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Logo</p>
                  <p className="text-xs text-gray-500 mb-3">Shown over the banner and in search results. Square image recommended.</p>
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-brand-300 transition-colors"
                      onClick={() => logoRef.current?.click()}
                    >
                      {logoUrl
                        ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                        : <span className="text-2xl text-gray-300">🌿</span>}
                    </div>
                    <div>
                      <Button variant="secondary" size="sm" loading={uploadingLogo} onClick={() => logoRef.current?.click()}>
                        {logoUrl ? 'Change logo' : 'Upload logo'}
                      </Button>
                      <p className="text-xs text-gray-500 mt-1.5">JPG, PNG or WebP · Max 5 MB</p>
                      {logoUrl && (
                        <button
                          className="text-xs text-red-500 hover:underline mt-1"
                          onClick={async () => {
                            await supabase.from('vendor_profiles').update({ logo_url: null }).eq('id', vp.id)
                            setLogoUrl('')
                          }}
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    ref={logoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImg(f, 'logos', setLogoUrl, setUploadingLogo, 'logo_url') }}
                  />
                </div>
              </>
            )}

            {/* ── SECTIONS ── */}
            {panel === 'sections' && (
              <>
                <p className="text-xs text-gray-500 mb-2">Drag to reorder. Toggle to show or hide each section.</p>
                <SectionDragList items={sections} onChange={setSections} />
              </>
            )}
          </div>
        </div>

        {/* ── Preview panel (desktop) ── */}
        <div className="hidden md:flex flex-1 flex-col bg-gray-300 sticky top-0 self-start h-screen overflow-hidden">
          {/* Browser chrome bar */}
          <div className="bg-gray-400 px-4 py-2 text-xs text-gray-700 font-medium flex items-center gap-3 flex-shrink-0">
            <span className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
            </span>
            <span className="bg-gray-200 rounded px-3 py-0.5 flex-1 truncate text-gray-600">
              farmers-market.app/vendors/{vp?.id?.slice(0, 12)}…
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <StorefrontPreview
              template={template} color={color} font={font}
              sections={sections} bannerUrl={bannerUrl} logoUrl={logoUrl}
              bizName={bizName} bizDesc={bizDesc}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Template Thumbnail ───────────────────────────────────────────────────────

function TemplateThumbnail({ id, color }) {
  const wrap = {
    borderRadius: 8,
    overflow: 'hidden',
    height: 64,
    background: color.bg,
    border: `1px solid ${color.primary}22`,
    position: 'relative',
  }

  const mini = {
    classic: (
      <div style={wrap}>
        <div style={{ height: 20, background: color.primary }} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
          <div style={{ height: 10, width: 10, borderRadius: '50%', background: color.surface, border: `2px solid ${color.primary}` }} />
          <div style={{ height: 4, width: 60, borderRadius: 2, background: color.text + '55' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '0 8px' }}>
          {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: 12, borderRadius: 4, background: color.surface, border: `1px solid ${color.primary}22` }} />)}
        </div>
      </div>
    ),
    modern: (
      <div style={wrap}>
        <div style={{ height: 28, background: color.primary, position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: -8, left: 10, height: 20, width: 20, borderRadius: 6, background: color.surface, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
        </div>
        <div style={{ padding: '10px 8px 4px', display: 'flex', gap: 4 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: 10, borderRadius: 3, background: color.surface, border: `1px solid ${color.primary}22` }} />)}
        </div>
      </div>
    ),
    rustic: (
      <div style={wrap}>
        <div style={{ height: 14, background: color.accent }} />
        <div style={{ display: 'flex', gap: 6, padding: 6 }}>
          <div style={{ height: 36, width: 36, borderRadius: 6, background: color.surface, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
            <div style={{ height: 4, borderRadius: 2, background: color.text + '55' }} />
            <div style={{ height: 3, width: '70%', borderRadius: 2, background: color.text + '33' }} />
            <div style={{ height: 3, width: '85%', borderRadius: 2, background: color.text + '22' }} />
          </div>
        </div>
      </div>
    ),
    minimal: (
      <div style={{ ...wrap, background: color.surface }}>
        <div style={{ padding: '8px 8px 4px' }}>
          <div style={{ height: 5, width: 80, borderRadius: 2, background: color.text + '88', marginBottom: 3 }} />
          <div style={{ height: 3, width: 50, borderRadius: 2, background: color.text + '33', marginBottom: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ height: 18, borderRadius: 3, background: color.bg }} />)}
          </div>
        </div>
      </div>
    ),
  }

  return mini[id] ?? null
}

// ─── Drag-and-drop Section List ───────────────────────────────────────────────

function SectionDragList({ items, onChange }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  function reorder(from, to) {
    if (from === null || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  function toggle(idx) {
    onChange(items.map((item, i) => i === idx ? { ...item, visible: !item.visible } : item))
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={item.id}
          draggable
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx) }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverIdx(idx) }}
          onDrop={e => { e.preventDefault(); reorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
          className={`bg-white rounded-xl border-2 p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing select-none transition-all
            ${overIdx === idx && dragIdx !== idx ? 'border-brand-400 shadow-md scale-[1.01]' : 'border-gray-200 hover:border-gray-300'}
            ${dragIdx === idx ? 'opacity-40 scale-95' : 'opacity-100'}`}
        >
          {/* Drag handle */}
          <svg className="h-5 w-5 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7" cy="4"  r="1.5" /><circle cx="13" cy="4"  r="1.5" />
            <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="16" r="1.5" /><circle cx="13" cy="16" r="1.5" />
          </svg>

          <span className="text-lg flex-shrink-0">{item.icon}</span>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${item.visible ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</p>
            <p className="text-xs text-gray-400 truncate">{item.desc}</p>
          </div>

          {/* Toggle switch */}
          <button
            onClick={() => toggle(idx)}
            aria-label={item.visible ? 'Hide section' : 'Show section'}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0 focus:outline-none
              ${item.visible ? 'bg-brand-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform
              ${item.visible ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}
      <p className="text-xs text-center text-gray-400 pt-1">Drag to reorder · Toggle to show or hide</p>
    </div>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function StorefrontPreview({ template, color, font, sections, bannerUrl, logoUrl, bizName, bizDesc }) {
  const visible = sections.filter(s => s.visible)

  const cs = {
    container: { background: color.bg, fontFamily: font.body, color: color.text, minHeight: '100%' },
    heading:   { fontFamily: font.heading },
    card:      { background: color.surface, borderRadius: 12, border: `1px solid ${color.primary}18`, padding: 10 },
    btn:       { background: color.primary, color: '#fff', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', display: 'inline-block' },
    section:   { padding: '14px 16px 0' },
    h2:        { fontSize: 15, fontWeight: 700, marginBottom: 10 },
  }

  const sectionMap = {
    hero: (
      <div key="hero">
        {/* Banner */}
        <div style={{
          height: template === 'modern' ? 180 : template === 'minimal' ? 80 : 130,
          background: bannerUrl ? undefined : `linear-gradient(135deg, ${color.primary}, ${color.accent})`,
          position: 'relative', overflow: 'hidden',
        }}>
          {bannerUrl && <img src={bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {template === 'minimal' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
              <h1 style={{ ...cs.heading, color: '#fff', fontSize: 20, fontWeight: 700 }}>
                {bizName || 'Your Business'}
              </h1>
            </div>
          )}
        </div>

        {/* Logo + header row */}
        <div style={{ padding: '0 16px', marginTop: template === 'modern' ? -24 : -18, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{
              height: template === 'modern' ? 52 : 44, width: template === 'modern' ? 52 : 44,
              borderRadius: 10, background: color.surface, border: `2px solid ${color.surface}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🌿'}
            </div>
            <span style={cs.btn}>+ Follow</span>
          </div>

          {template !== 'minimal' && (
            <h1 style={{ ...cs.heading, fontSize: 17, fontWeight: 700, marginBottom: 3 }}>
              {bizName || 'Your Business Name'}
            </h1>
          )}
          <p style={{ fontSize: 11, color: color.text + 'aa', display: 'flex', gap: 10 }}>
            <span>⭐ 4.8 · 12 reviews</span>
            <span>48 followers</span>
          </p>

          {/* Rustic: story teaser in hero */}
          {template === 'rustic' && bizDesc && (
            <p style={{ fontSize: 11, color: color.text + 'bb', marginTop: 6, lineHeight: 1.5, borderLeft: `3px solid ${color.accent}`, paddingLeft: 8 }}>
              {bizDesc.slice(0, 120)}{bizDesc.length > 120 ? '…' : ''}
            </p>
          )}
        </div>
      </div>
    ),

    about: bizDesc ? (
      <div key="about" style={cs.section}>
        <p style={{ ...cs.heading, ...cs.h2 }}>About Us</p>
        <p style={{ fontSize: 12, lineHeight: 1.65, color: color.text + 'cc' }}>
          {bizDesc.slice(0, 240)}{bizDesc.length > 240 ? '…' : ''}
        </p>
      </div>
    ) : null,

    products: (
      <div key="products" style={cs.section}>
        <p style={{ ...cs.heading, ...cs.h2 }}>Products</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: template === 'minimal' ? '1fr 1fr 1fr' : template === 'modern' ? '1fr 1fr 1fr' : '1fr 1fr',
          gap: 8,
        }}>
          {[
            { name: 'Heirloom Tomatoes', price: '$4.99', emoji: '🍅' },
            { name: 'Fresh Basil',       price: '$2.49', emoji: '🌿' },
            { name: 'Farm Eggs (doz)',   price: '$6.99', emoji: '🥚' },
            ...(template === 'minimal' || template === 'modern' ? [{ name: 'Raw Honey', price: '$12.00', emoji: '🍯' }] : []),
          ].map((p, i) => (
            <div key={i} style={cs.card}>
              <div style={{
                height: template === 'minimal' ? 40 : 56, borderRadius: 8, background: color.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, marginBottom: 6,
              }}>
                {p.emoji}
              </div>
              <p style={{ fontSize: 11, fontWeight: 500, color: color.text, lineHeight: 1.3 }}>{p.name}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: color.primary, marginTop: 3 }}>{p.price}</p>
            </div>
          ))}
        </div>
      </div>
    ),

    schedule: (
      <div key="schedule" style={cs.section}>
        <p style={{ ...cs.heading, ...cs.h2 }}>Upcoming Markets</p>
        {[
          { name: 'Downtown Farmers Market', date: 'Sat, Aug 3 · 8am – 1pm', booth: 'Booth 14' },
          { name: 'Westside Community Market', date: 'Sun, Aug 11 · 9am – 2pm', booth: '' },
        ].map((a, i) => (
          <div key={i} style={{ ...cs.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: color.text }}>{a.name}</p>
              <p style={{ fontSize: 11, color: color.text + '88', marginTop: 2 }}>{a.date}{a.booth ? ` · ${a.booth}` : ''}</p>
            </div>
            <span style={{ fontSize: 10, color: color.primary, fontWeight: 600, background: color.bg, padding: '2px 6px', borderRadius: 6 }}>
              Pre-order
            </span>
          </div>
        ))}
      </div>
    ),

    reviews: (
      <div key="reviews" style={cs.section}>
        <p style={{ ...cs.heading, ...cs.h2 }}>Reviews</p>
        {[
          { rating: 5, text: 'The freshest tomatoes I\'ve ever tasted. Back every weekend!' },
          { rating: 5, text: 'Wonderful vendor, great quality, very fair prices.' },
        ].map((r, i) => (
          <div key={i} style={{ ...cs.card, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
              {[0,1,2,3,4].map(j => (
                <span key={j} style={{ fontSize: 11, color: j < r.rating ? '#f59e0b' : '#e5e7eb' }}>★</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: color.text + 'cc', lineHeight: 1.5 }}>{r.text}</p>
          </div>
        ))}
      </div>
    ),
  }

  if (visible.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9ca3af', fontSize: 13, fontFamily: 'system-ui' }}>
      All sections hidden — toggle some on in Sections
    </div>
  )

  return (
    <div style={cs.container}>
      {visible.map(s => sectionMap[s.id] ?? null)}
      <div style={{ height: 32 }} />
    </div>
  )
}
