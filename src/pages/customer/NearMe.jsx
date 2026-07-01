import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { value: 5,  label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 25, label: '25 mi' },
  { value: 50, label: '50 mi' },
]

const FULFILLMENT_LABELS = {
  market_pickup:      'Market Pickup',
  standalone_pickup:  'Farm Pickup',
  local_delivery:     'Local Delivery',
  shipping:           'Shipping',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine distance in miles between two lat/lng pairs */
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function formatDist(miles) {
  return miles < 0.1
    ? '< 0.1 mi'
    : miles < 10
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(miles)} mi`
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function daysFromToday(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((d - today) / 86400000)
}

/** Geocode an address/zip/city via Nominatim (free, no key needed) */
async function geocode(query) {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
  const res  = await fetch(url, {
    headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'FarmersMarketApp/1.0 (contact@farmersmarket.app)' },
  })
  if (!res.ok) throw new Error('Geocoding service unavailable')
  const data = await res.json()
  if (!data.length) return null
  return {
    lat:  parseFloat(data[0].lat),
    lng:  parseFloat(data[0].lon),
    city: data[0].address?.city || data[0].address?.town || data[0].address?.village || data[0].address?.county || query,
    state: data[0].address?.state || '',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NearMe() {
  const navigate = useNavigate()

  const [inputVal,      setInputVal]      = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [coords,        setCoords]        = useState(null)   // { lat, lng }
  const [radius,        setRadius]        = useState(25)

  // Results
  const [markets,  setMarkets]  = useState([])   // market rows + distance
  const [vendors,  setVendors]  = useState([])   // vendor summary + nearest dist + upcoming apps

  // Filters
  const [categoryFilter,    setCategoryFilter]    = useState('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all')
  const [allCategories,     setAllCategories]     = useState([])  // unique category names in results
  const [allFulfillments,   setAllFulfillments]   = useState([])  // unique fulfillment types in results

  // UI state
  const [searching,   setSearching]   = useState(false)
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error,       setError]       = useState('')

  const inputRef = useRef(null)

  // ── Core data fetch (runs after we have coords) ────────────────────────────
  const fetchNearby = useCallback(async ({ lat, lng }, radiusOverride) => {
    const searchRadius = radiusOverride ?? radius
    setSearching(true)
    setError('')
    setHasSearched(true)
    // Reset filters when running a new search
    setCategoryFilter('all')
    setFulfillmentFilter('all')

    // 1. Fetch all active markets that have coordinates
    const { data: allMarkets, error: mErr } = await supabase
      .from('markets')
      .select('id, name, address, city, state, lat, lng, typical_days, typical_hours, website_url, status, description')
      .eq('status', 'active')
      .not('lat', 'is', null)

    if (mErr) { setError('Could not load market data.'); setSearching(false); return }

    // 2. Client-side distance filter
    const nearbyMarkets = (allMarkets ?? [])
      .map(m => ({ ...m, distance: haversine(lat, lng, parseFloat(m.lat), parseFloat(m.lng)) }))
      .filter(m => m.distance <= searchRadius)
      .sort((a, b) => a.distance - b.distance)

    setMarkets(nearbyMarkets)

    // 3. If there are nearby markets, fetch upcoming vendor appearances at those markets
    if (nearbyMarkets.length > 0) {
      const marketIds = nearbyMarkets.map(m => m.id)
      const today     = new Date().toISOString().split('T')[0]

      const { data: apps, error: aErr } = await supabase
        .from('market_appearances')
        .select(`
          id,
          market_id,
          appearance_date,
          open_time,
          close_time,
          booth_number,
          pre_orders_accepted,
          vendor_profiles (
            id,
            business_name,
            business_description,
            logo_url,
            average_rating,
            follower_count,
            fulfillment_methods,
            business_type,
            categories ( name )
          )
        `)
        .in('market_id', marketIds)
        .eq('status', 'scheduled')
        .gte('appearance_date', today)
        .order('appearance_date', { ascending: true })
        .limit(200)

      if (!aErr && apps) {
        // Group by vendor_id — collect all appearances and find nearest market distance
        const vendorMap = new Map()

        for (const app of apps) {
          const vp = app.vendor_profiles
          if (!vp) continue
          const market   = nearbyMarkets.find(m => m.id === app.market_id)
          if (!market) continue

          if (!vendorMap.has(vp.id)) {
            vendorMap.set(vp.id, {
              ...vp,
              distance:    market.distance,
              nearestMarket: market,
              appearances: [],
            })
          }

          const entry = vendorMap.get(vp.id)
          // Keep nearest market distance
          if (market.distance < entry.distance) {
            entry.distance     = market.distance
            entry.nearestMarket = market
          }
          entry.appearances.push({
            id:               app.id,
            appearance_date:  app.appearance_date,
            open_time:        app.open_time,
            close_time:       app.close_time,
            booth_number:     app.booth_number,
            pre_orders_accepted: app.pre_orders_accepted,
            market_name:      market.name,
            market_city:      market.city,
            market_state:     market.state,
            market_distance:  market.distance,
          })
        }

        const vendorList = Array.from(vendorMap.values()).sort((a, b) => a.distance - b.distance)
        setVendors(vendorList)

        // Collect unique filter options from actual results
        const cats = [...new Set(vendorList.map(v => v.categories?.name).filter(Boolean))]
        const fuls = [...new Set(vendorList.flatMap(v => v.fulfillment_methods ?? []))]
        setAllCategories(cats)
        setAllFulfillments(fuls)
      } else {
        setVendors([])
      }
    } else {
      setVendors([])
      setAllCategories([])
      setAllFulfillments([])
    }

    setSearching(false)
  }, [radius])

  // ── Geocode search ─────────────────────────────────────────────────────────
  async function handleSearch(e) {
    e?.preventDefault()
    if (!inputVal.trim()) return
    setError('')
    setSearching(true)

    let geo
    try {
      geo = await geocode(inputVal.trim())
    } catch {
      setError('Location search is unavailable right now. Try "Use my location" instead.')
      setSearching(false)
      return
    }

    if (!geo) {
      setError(`Couldn't find "${inputVal}". Try a city name, zip code, or full address.`)
      setSearching(false)
      return
    }

    setCoords({ lat: geo.lat, lng: geo.lng })
    setLocationLabel(`${geo.city}${geo.state ? `, ${geo.state}` : ''}`)
    await fetchNearby({ lat: geo.lat, lng: geo.lng })
  }

  // ── GPS location ───────────────────────────────────────────────────────────
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        setInputVal('')
        setLocationLabel('Your location')
        setGeoLoading(false)
        await fetchNearby({ lat, lng })
      },
      err => {
        setGeoLoading(false)
        setError(
          err.code === 1
            ? 'Location access was denied. Enter an address to search manually.'
            : 'Could not determine your location. Enter an address instead.',
        )
      },
      { timeout: 10000, maximumAge: 300000 },
    )
  }

  // ── Radius change with immediate re-filter ─────────────────────────────────
  async function handleRadiusChange(newRadius) {
    setRadius(newRadius)
    if (coords) {
      await fetchNearby(coords, newRadius)
    }
  }

  // ── Derived filtered results ───────────────────────────────────────────────
  const filteredVendors = vendors.filter(v => {
    const catOk = categoryFilter === 'all' || v.categories?.name === categoryFilter
    const fulOk = fulfillmentFilter === 'all' || (v.fulfillment_methods ?? []).includes(fulfillmentFilter)
    return catOk && fulOk
  })

  const filteredMarkets = markets  // markets don't have category / fulfillment filters

  const noResults = hasSearched && !searching && filteredMarkets.length === 0 && filteredVendors.length === 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pb-28 min-h-screen bg-gray-50">

      {/* ── Location search bar ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 space-y-2">
        <h1 className="text-lg font-bold text-gray-900">Near Me</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 flex items-center bg-gray-100 rounded-xl px-3 gap-2 focus-within:ring-2 focus-within:ring-brand-400">
            {/* Pin icon */}
            <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="City, zip code, or address…"
              className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none"
            />
            {inputVal && (
              <button type="button" onClick={() => setInputVal('')} className="text-gray-400 hover:text-gray-600">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={searching || !inputVal.trim()}
            className="bg-brand-600 text-white text-sm font-medium px-4 rounded-xl disabled:opacity-50 hover:bg-brand-700 transition-colors flex-shrink-0"
          >
            Search
          </button>

          {/* GPS button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={geoLoading || searching}
            title="Use my current location"
            className="bg-white border border-gray-200 text-gray-600 rounded-xl px-3 hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {geoLoading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zM2 13h2M12 2v2M22 13h-2M12 22v-2" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </form>

        {/* Active location label */}
        {locationLabel && !searching && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-brand-500">📍</span>
            Showing results near <strong className="text-gray-700">{locationLabel}</strong>
          </p>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Searching spinner ── */}
      {searching && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <svg className="h-8 w-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Finding vendors and markets…</p>
        </div>
      )}

      {/* ── Pre-search prompt ── */}
      {!hasSearched && !searching && !error && (
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <span className="text-6xl mb-5">🗺</span>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Find markets near you</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-5">
            Enter your city, zip code, or address to discover farmers markets and vendors in your area.
          </p>
          <button
            onClick={handleUseMyLocation}
            disabled={geoLoading}
            className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {geoLoading ? 'Locating you…' : 'Use my current location'}
          </button>
        </div>
      )}

      {/* ── Results area ── */}
      {hasSearched && !searching && (
        <>
          {/* Filter bar */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
            {/* Radius chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="text-xs text-gray-500 flex-shrink-0">Within:</span>
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleRadiusChange(opt.value)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors
                    ${radius === opt.value
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Category chips */}
            {allCategories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <span className="text-xs text-gray-500 flex-shrink-0">Type:</span>
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors
                    ${categoryFilter === 'all'
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}
                >
                  All
                </button>
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? 'all' : cat)}
                    className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors
                      ${categoryFilter === cat
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Fulfillment chips */}
            {allFulfillments.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <span className="text-xs text-gray-500 flex-shrink-0">Pickup:</span>
                <button
                  onClick={() => setFulfillmentFilter('all')}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors
                    ${fulfillmentFilter === 'all'
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}
                >
                  All
                </button>
                {allFulfillments.map(ful => (
                  <button
                    key={ful}
                    onClick={() => setFulfillmentFilter(ful === fulfillmentFilter ? 'all' : ful)}
                    className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors
                      ${fulfillmentFilter === ful
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}
                  >
                    {FULFILLMENT_LABELS[ful] ?? ful}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary line */}
          {!noResults && (
            <p className="px-4 pt-4 pb-1 text-xs text-gray-500">
              {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''} ·{' '}
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} within {radius} miles
              {locationLabel ? ` of ${locationLabel}` : ''}
            </p>
          )}

          {/* No results */}
          {noResults && (
            <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
              <span className="text-5xl mb-4">🌾</span>
              <h2 className="text-base font-semibold text-gray-900 mb-2">Nothing found nearby</h2>
              <p className="text-sm text-gray-500 mb-4">
                No markets or vendors found within {radius} miles of {locationLabel || 'that location'}.
              </p>
              <div className="flex gap-2">
                {radius < 50 && (
                  <button
                    onClick={() => handleRadiusChange(radius === 5 ? 10 : radius === 10 ? 25 : 50)}
                    className="text-sm font-medium text-brand-600 border border-brand-200 bg-brand-50 px-4 py-2 rounded-xl hover:bg-brand-100"
                  >
                    Expand to {radius === 5 ? 10 : radius === 10 ? 25 : 50} miles
                  </button>
                )}
                <button
                  onClick={() => { setHasSearched(false); setInputVal(''); inputRef.current?.focus() }}
                  className="text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                >
                  Try a different location
                </button>
              </div>

              {/* Note about data */}
              <p className="mt-6 text-xs text-gray-400 max-w-xs">
                Markets must be added by an admin and need coordinates set before they appear in search results.
              </p>
            </div>
          )}

          {/* ── Markets section ── */}
          {filteredMarkets.length > 0 && (
            <section className="px-4 pt-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Farmers Markets
              </h2>
              <div className="space-y-3">
                {filteredMarkets.map(market => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
            </section>
          )}

          {/* ── Vendors section ── */}
          {filteredVendors.length > 0 && (
            <section className="px-4 pt-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Vendors attending nearby markets
              </h2>
              <div className="space-y-3">
                {filteredVendors.map(vendor => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onNavigate={() => navigate(`/vendors/${vendor.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Filtered-out notice */}
          {hasSearched && !searching && !noResults &&
            (filteredVendors.length === 0 && vendors.length > 0) && (
            <p className="px-4 pt-4 text-xs text-gray-400 text-center">
              {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} found but hidden by filters —{' '}
              <button
                onClick={() => { setCategoryFilter('all'); setFulfillmentFilter('all') }}
                className="text-brand-600 underline"
              >
                clear filters
              </button>
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Market Card ──────────────────────────────────────────────────────────────

function MarketCard({ market }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center text-xl flex-shrink-0">
              🏪
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-snug">{market.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {[market.city, market.state].filter(Boolean).join(', ') || market.address || 'Location on file'}
              </p>
            </div>
          </div>
          <DistBadge miles={market.distance} />
        </div>

        {/* Description */}
        {market.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{market.description}</p>
        )}

        {/* Typical days */}
        {market.typical_days?.length > 0 && (
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">Typical days:</span>{' '}
            {market.typical_days.join(', ')}
          </p>
        )}

        {/* Website */}
        {market.website_url && (
          <a
            href={market.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-brand-600 hover:underline"
          >
            Visit website →
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorCard({ vendor, onNavigate }) {
  const nextThree = vendor.appearances.slice(0, 3)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={onNavigate}
        className="w-full px-4 pt-4 pb-3 text-left focus:outline-none"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
              {vendor.logo_url
                ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-lg">🌿</span>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-snug">{vendor.business_name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {vendor.categories?.name && (
                  <span className="text-xs text-brand-600 font-medium">{vendor.categories.name}</span>
                )}
                {vendor.average_rating > 0 && (
                  <span className="text-xs text-gray-500 flex items-center gap-0.5">
                    <span className="text-yellow-400">★</span>
                    {Number(vendor.average_rating).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DistBadge miles={vendor.distance} label={`Near ${vendor.nearestMarket?.name ?? ''}`} />
        </div>

        {/* Description */}
        {vendor.business_description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
            {vendor.business_description}
          </p>
        )}

        {/* Fulfillment badges */}
        {vendor.fulfillment_methods?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {vendor.fulfillment_methods.map(f => (
              <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {FULFILLMENT_LABELS[f] ?? f}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Upcoming appearances */}
      {nextThree.length > 0 && (
        <div className="border-t border-gray-50 px-4 pb-3 pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 mb-1">Upcoming near you</p>
          {nextThree.map(ap => {
            const days = daysFromToday(ap.appearance_date)
            const badge =
              days === 0 ? 'Today'
              : days === 1 ? 'Tomorrow'
              : `${days}d`
            const badgeCls =
              days === 0 ? 'bg-green-100 text-green-700'
              : days <= 7 ? 'bg-brand-50 text-brand-700'
              : 'bg-gray-100 text-gray-500'

            return (
              <div key={ap.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 font-medium truncate">{ap.market_name}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(ap.appearance_date)}
                    {ap.open_time  ? ` · ${formatTime(ap.open_time)}`  : ''}
                    {ap.close_time ? ` – ${formatTime(ap.close_time)}` : ''}
                    {ap.booth_number ? ` · Booth ${ap.booth_number}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {ap.pre_orders_accepted && (
                    <span className="text-xs text-blue-600 font-medium">Pre-order</span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
                    {badge}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDist(ap.market_distance)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Distance Badge ───────────────────────────────────────────────────────────

function DistBadge({ miles, label }) {
  return (
    <div className="flex flex-col items-end flex-shrink-0">
      <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
        {formatDist(miles)}
      </span>
      {label && (
        <span className="text-xs text-gray-400 mt-0.5 max-w-[80px] text-right truncate">{label}</span>
      )}
    </div>
  )
}
