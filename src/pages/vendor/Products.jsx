import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'

export default function VendorProducts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | published | draft | hidden

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    const { data: vp } = await supabase.from('vendor_profiles').select('id').eq('user_id', user.id).single()
    if (!vp) { setLoading(false); return }

    const { data } = await supabase
      .from('products')
      .select('*, product_variants(stock_quantity, status)')
      .eq('vendor_id', vp.id)
      .order('created_at', { ascending: false })

    setProducts(data ?? [])
    setLoading(false)
  }

  async function toggleVisibility(product) {
    const next = product.visibility === 'published' ? 'hidden' : 'published'
    await supabase.from('products').update({ visibility: next }).eq('id', product.id)
    setProducts(p => p.map(x => x.id === product.id ? { ...x, visibility: next } : x))
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }

  const filtered = filter === 'all' ? products : products.filter(p => p.visibility === filter)
  const totalStock = (p) => (p.product_variants ?? []).reduce((s, v) => s + (v.stock_quantity ?? 0), 0)

  if (loading) return <PageLoader />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button onClick={() => navigate('/vendor/products/new')}>+ New product</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {['all', 'published', 'draft', 'hidden'].map(f => (
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
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500 mb-4">{filter === 'all' ? 'No products yet' : `No ${filter} products`}</p>
          {filter === 'all' && (
            <Button onClick={() => navigate('/vendor/products/new')}>Create your first product</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(product => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              {/* Photo placeholder */}
              <div className="h-14 w-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-300 text-xl">
                📷
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <StatusBadge status={product.visibility} />
                  {product.is_featured && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Featured</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatCents(product.base_price_cents)} · {(product.product_variants ?? []).length} variant{(product.product_variants ?? []).length !== 1 ? 's' : ''} · {totalStock(product)} in stock
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleVisibility(product)}
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
                >
                  {product.visibility === 'published' ? 'Hide' : 'Publish'}
                </button>
                <button
                  onClick={() => navigate(`/vendor/products/${product.id}/edit`)}
                  className="text-xs text-brand-600 hover:text-brand-700 border border-brand-200 px-2 py-1 rounded-lg"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-2 py-1 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
