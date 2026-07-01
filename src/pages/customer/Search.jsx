import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/stripe'
import { useTrackBehavior } from '../../hooks/useTrackBehavior'
import Spinner from '../../components/ui/Spinner'

export default function Search() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const track = useTrackBehavior()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ vendors: [], products: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounce = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    if (!val.trim()) { setResults({ vendors: [], products: [] }); return }
    debounce.current = setTimeout(() => search(val.trim()), 350)
  }

  async function search(q) {
    setLoading(true)

    const [vendorRes, productRes] = await Promise.all([
      supabase
        .from('vendor_profiles')
        .select('id, business_name, business_description, average_rating, follower_count')
        .eq('status', 'active')
        .ilike('business_name', `%${q}%`)
        .limit(5),

      supabase
        .from('products')
        .select('id, name, base_price_cents, vendor_id, vendor_profiles!inner(business_name, status)')
        .eq('visibility', 'published')
        .eq('vendor_profiles.status', 'active')
        .ilike('name', `%${q}%`)
        .limit(10),
    ])

    setResults({
      vendors: vendorRes.data ?? [],
      products: productRes.data ?? [],
    })
    setLoading(false)

    // Log search (Architecture Rule #5)
    if (user) {
      await supabase.from('search_history').insert({
        customer_id: user.id,
        search_term: q,
        search_type: 'product',
        results_count: (vendorRes.data?.length ?? 0) + (productRes.data?.length ?? 0),
      })
      track('search', null, null, { search_term: q })
    }
  }

  const hasResults = results.vendors.length > 0 || results.products.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 flex items-center bg-gray-100 rounded-xl px-3 gap-2">
          <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleChange}
            placeholder="Search vendors, products…"
            className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none"
          />
          {loading && <Spinner size="sm" />}
        </div>
      </div>

      <div className="px-4 py-4">
        {!query && (
          <p className="text-center text-gray-400 text-sm mt-12">Start typing to search</p>
        )}

        {query && !loading && !hasResults && (
          <p className="text-center text-gray-400 text-sm mt-12">No results for "{query}"</p>
        )}

        {results.vendors.length > 0 && (
          <section className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Vendors</p>
            <div className="space-y-2">
              {results.vendors.map(v => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/vendors/${v.id}`)}
                  className="w-full bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 text-left hover:shadow-sm"
                >
                  <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold">
                    {v.business_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.business_name}</p>
                    {v.business_description && (
                      <p className="text-xs text-gray-500 truncate">{v.business_description}</p>
                    )}
                  </div>
                  {v.average_rating > 0 && (
                    <span className="text-xs text-gray-500 flex-shrink-0">⭐ {v.average_rating.toFixed(1)}</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {results.products.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Products</p>
            <div className="space-y-2">
              {results.products.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="w-full bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 text-left hover:shadow-sm"
                >
                  <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-lg flex-shrink-0">
                    📷
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.vendor_profiles?.business_name}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    {formatCents(p.base_price_cents)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
