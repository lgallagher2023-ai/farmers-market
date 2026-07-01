import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader } from '../../components/ui/Spinner'
import { Input } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function VendorInventory() {
  const { user } = useAuth()
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | low | out
  const [editing, setEditing] = useState(null) // variantId
  const [editQty, setEditQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadInventory() }, [])

  async function loadInventory() {
    const { data: vp } = await supabase.from('vendor_profiles').select('id').eq('user_id', user.id).single()
    if (!vp) { setLoading(false); return }

    const { data } = await supabase
      .from('product_variants')
      .select('*, products!inner(id, name, vendor_id, category_id, visibility)')
      .eq('products.vendor_id', vp.id)
      .eq('status', 'active')
      .order('stock_quantity', { ascending: true })

    setVariants(data ?? [])
    setLoading(false)
  }

  async function saveStock(variantId) {
    setSaving(true)
    setError('')
    const qty = parseInt(editQty)
    if (isNaN(qty) || qty < 0) { setError('Invalid quantity'); setSaving(false); return }

    const { error } = await supabase
      .from('product_variants')
      .update({ stock_quantity: qty, updated_at: new Date().toISOString() })
      .eq('id', variantId)

    if (error) {
      setError(error.message)
    } else {
      setVariants(v => v.map(x => x.id === variantId ? { ...x, stock_quantity: qty } : x))
      setEditing(null)
    }
    setSaving(false)
  }

  const filtered = variants.filter(v => {
    const matchSearch = !search || v.products?.name?.toLowerCase().includes(search.toLowerCase()) || v.variant_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'out' && v.stock_quantity === 0) || (filter === 'low' && v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold)
    return matchSearch && matchFilter
  })

  const stats = {
    total: variants.length,
    inStock: variants.filter(v => v.stock_quantity > v.low_stock_threshold).length,
    low: variants.filter(v => v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold).length,
    out: variants.filter(v => v.stock_quantity === 0).length,
  }

  if (loading) return <PageLoader />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventory</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total variants</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.inStock}</p>
          <p className="text-xs text-gray-500">In stock</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.low}</p>
          <p className="text-xs text-gray-500">Low stock</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.out}</p>
          <p className="text-xs text-gray-500">Out of stock</p>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* Search & filter */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          className="max-w-xs"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[['all','All'], ['low','Low stock'], ['out','Out of stock']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product / Variant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Low at</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">No variants found</td>
              </tr>
            )}
            {filtered.map(v => {
              const isOut = v.stock_quantity === 0
              const isLow = !isOut && v.stock_quantity <= v.low_stock_threshold
              return (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{v.products?.name}</p>
                    {v.variant_name !== 'Default' && (
                      <p className="text-xs text-gray-500">{v.variant_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{v.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {editing === v.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          min="0"
                          value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveStock(v.id)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                        />
                        <button onClick={() => saveStock(v.id)} disabled={saving} className="text-xs text-brand-600 font-medium">Save</button>
                        <button onClick={() => setEditing(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {v.stock_quantity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{v.low_stock_threshold}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing !== v.id && (
                      <button
                        onClick={() => { setEditing(v.id); setEditQty(String(v.stock_quantity)) }}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
