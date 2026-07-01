import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { dollarsToCents, formatCents } from '../../lib/stripe'
import Button from '../../components/ui/Button'
import { Input, Textarea, Select } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

const VARIANT_TYPES = ['flavor', 'size', 'color', 'material']

export default function ProductForm() {
  const { productId } = useParams()
  const isEdit = Boolean(productId)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [vendorId, setVendorId] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    tags: '',
    base_price: '',
    compare_at_price: '',
    cost_per_item: '',
    ingredients: '',
    allergen_info: '',
    care_instructions: '',
    visibility: 'draft',
    is_featured: false,
  })

  const [variants, setVariants] = useState([
    { variant_name: 'Default', variant_type: null, price: '', sku: '', barcode: '', stock_quantity: '0', low_stock_threshold: '5' }
  ])

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    const { data: vp } = await supabase
      .from('vendor_profiles').select('id').eq('user_id', user.id).single()
    if (vp) setVendorId(vp.id)

    const { data: cats } = await supabase
      .from('categories').select('id, name, category_type, parent_category_id')
      .eq('status', 'active').eq('category_type', 'product').order('display_order')
    setCategories(cats ?? [])

    if (isEdit) {
      const { data: product } = await supabase
        .from('products').select('*, product_variants(*)').eq('id', productId).single()
      if (product) {
        setForm({
          name: product.name ?? '',
          description: product.description ?? '',
          category_id: product.category_id ?? '',
          subcategory_id: product.subcategory_id ?? '',
          tags: (product.tags ?? []).join(', '),
          base_price: product.base_price_cents ? (product.base_price_cents / 100).toFixed(2) : '',
          compare_at_price: product.compare_at_price_cents ? (product.compare_at_price_cents / 100).toFixed(2) : '',
          cost_per_item: product.cost_per_item_cents ? (product.cost_per_item_cents / 100).toFixed(2) : '',
          ingredients: product.ingredients ?? '',
          allergen_info: product.allergen_info ?? '',
          care_instructions: product.care_instructions ?? '',
          visibility: product.visibility ?? 'draft',
          is_featured: product.is_featured ?? false,
        })
        if (product.product_variants?.length) {
          setVariants(product.product_variants.map(v => ({
            id: v.id,
            variant_name: v.variant_name,
            variant_type: v.variant_type,
            price: v.price_cents ? (v.price_cents / 100).toFixed(2) : '',
            sku: v.sku ?? '',
            barcode: v.barcode ?? '',
            stock_quantity: String(v.stock_quantity ?? 0),
            low_stock_threshold: String(v.low_stock_threshold ?? 5),
          })))
        }
      }
      setLoading(false)
    }
  }

  function setField(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }

  function setVariantField(index, field) {
    return (e) => setVariants(v => v.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))
  }

  function addVariant() {
    setVariants(v => [...v, { variant_name: '', variant_type: null, price: '', sku: '', barcode: '', stock_quantity: '0', low_stock_threshold: '5' }])
  }

  function removeVariant(index) {
    setVariants(v => v.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Product name is required'); return }
    if (!vendorId) { setError('Vendor profile not found'); return }
    setSaving(true)
    setError('')

    const productData = {
      vendor_id: vendorId,
      name: form.name.trim(),
      description: form.description.trim(),
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      base_price_cents: form.base_price ? dollarsToCents(form.base_price) : 0,
      compare_at_price_cents: form.compare_at_price ? dollarsToCents(form.compare_at_price) : null,
      cost_per_item_cents: form.cost_per_item ? dollarsToCents(form.cost_per_item) : 0,
      ingredients: form.ingredients.trim() || null,
      allergen_info: form.allergen_info.trim() || null,
      care_instructions: form.care_instructions.trim() || null,
      visibility: form.visibility,
      is_featured: form.is_featured,
    }

    let finalProductId = productId

    if (isEdit) {
      const { error: updateError } = await supabase.from('products').update(productData).eq('id', productId)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    } else {
      const { data: newProduct, error: insertError } = await supabase.from('products').insert(productData).select('id').single()
      if (insertError) { setError(insertError.message); setSaving(false); return }
      finalProductId = newProduct.id
    }

    // Upsert variants
    for (const variant of variants) {
      const variantData = {
        product_id: finalProductId,
        variant_name: variant.variant_name || 'Default',
        variant_type: variant.variant_type || null,
        price_cents: variant.price ? dollarsToCents(variant.price) : dollarsToCents(form.base_price || '0'),
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        stock_quantity: parseInt(variant.stock_quantity) || 0,
        low_stock_threshold: parseInt(variant.low_stock_threshold) || 5,
      }

      if (variant.id) {
        await supabase.from('product_variants').update(variantData).eq('id', variant.id)
      } else {
        await supabase.from('product_variants').insert(variantData)
      }
    }

    navigate('/vendor/products')
  }

  const topCategories = categories.filter(c => !c.parent_category_id)
  const subcategories = categories.filter(c => c.parent_category_id === form.category_id)

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/vendor/products')} className="text-gray-400 hover:text-gray-600">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit product' : 'New product'}</h1>
      </div>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Section title="Basic information">
          <Input label="Product name" value={form.name} onChange={setField('name')} required />
          <Textarea label="Description" value={form.description} onChange={setField('description')} rows={4} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.category_id} onChange={setField('category_id')}>
              <option value="">Select category…</option>
              {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Subcategory" value={form.subcategory_id} onChange={setField('subcategory_id')} disabled={!subcategories.length}>
              <option value="">Select subcategory…</option>
              {subcategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input label="Tags (comma separated)" value={form.tags} onChange={setField('tags')} placeholder="organic, seasonal, gluten-free" />
        </Section>

        {/* Pricing */}
        <Section title="Pricing">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Price ($)" type="number" step="0.01" min="0" value={form.base_price} onChange={setField('base_price')} placeholder="0.00" required />
            <Input label="Compare-at price ($)" type="number" step="0.01" min="0" value={form.compare_at_price} onChange={setField('compare_at_price')} hint="Original price if on sale" />
            <Input label="Cost per item ($)" type="number" step="0.01" min="0" value={form.cost_per_item} onChange={setField('cost_per_item')} hint="Private — for your margin tracking" />
          </div>
        </Section>

        {/* Variants */}
        <Section title="Variants & inventory">
          <p className="text-xs text-gray-500 -mt-1 mb-3">
            Each variant has its own stock level, SKU, and optional barcode (Architecture Rule: every product must have at least one variant).
          </p>
          <div className="space-y-4">
            {variants.map((v, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Variant {i + 1}</p>
                  {variants.length > 1 && (
                    <button type="button" onClick={() => removeVariant(i)} className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Variant name" value={v.variant_name} onChange={setVariantField(i, 'variant_name')} placeholder="e.g. Large, Blueberry, Red" />
                  <Select label="Variant type" value={v.variant_type ?? ''} onChange={setVariantField(i, 'variant_type')}>
                    <option value="">None</option>
                    {VARIANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Input label="Price ($)" type="number" step="0.01" value={v.price} onChange={setVariantField(i, 'price')} placeholder="Base" />
                  <Input label="Stock qty" type="number" min="0" value={v.stock_quantity} onChange={setVariantField(i, 'stock_quantity')} />
                  <Input label="Low stock at" type="number" min="0" value={v.low_stock_threshold} onChange={setVariantField(i, 'low_stock_threshold')} />
                  <Input label="SKU" value={v.sku} onChange={setVariantField(i, 'sku')} placeholder="Optional" />
                </div>
                <Input label="Barcode" value={v.barcode} onChange={setVariantField(i, 'barcode')} placeholder="UPC, EAN, etc." />
              </div>
            ))}
          </div>
          <button type="button" onClick={addVariant} className="mt-3 text-sm text-brand-600 hover:underline font-medium">
            + Add variant
          </button>
        </Section>

        {/* Additional details */}
        <Section title="Additional details">
          <Textarea label="Ingredients" value={form.ingredients} onChange={setField('ingredients')} rows={2} placeholder="For food products" />
          <Textarea label="Allergen info" value={form.allergen_info} onChange={setField('allergen_info')} rows={2} />
          <Textarea label="Care instructions" value={form.care_instructions} onChange={setField('care_instructions')} rows={2} placeholder="For craft or clothing products" />
        </Section>

        {/* Visibility */}
        <Section title="Visibility">
          <Select label="Status" value={form.visibility} onChange={setField('visibility')}>
            <option value="draft">Draft — not visible to customers</option>
            <option value="published">Published — visible on your storefront</option>
            <option value="hidden">Hidden — removed from storefront but not deleted</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.is_featured} onChange={setField('is_featured')} className="rounded" />
            Feature this product on your storefront
          </label>
        </Section>

        <div className="flex gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/vendor/products')}>Cancel</Button>
          <Button type="submit" loading={saving} className="flex-1" size="lg">
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-gray-900 pb-2 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  )
}
