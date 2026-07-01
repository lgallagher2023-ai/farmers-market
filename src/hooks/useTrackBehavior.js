import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Architecture Rule #6 — User behavior must be tracked from day one.
 * Architecture Rule #15 — Event-driven: new event types added by logging new string, never by altering schema.
 *
 * Usage:
 *   const track = useTrackBehavior()
 *   track('product_view', 'product', productId, { referral_source: 'search' })
 */
export function useTrackBehavior() {
  const { user } = useAuth()

  return useCallback(async (eventType, entityType, entityId, extra = {}) => {
    if (!user) return
    try {
      await supabase.from('user_behavior').insert({
        customer_id: user.id,
        event_type: eventType,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        session_id: getOrCreateSession(),
        device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
        ...extra,
      })
    } catch {
      // Tracking errors should never break the UI
    }
  }, [user])
}

let _sessionId = null
function getOrCreateSession() {
  if (!_sessionId) {
    _sessionId = crypto.randomUUID()
  }
  return _sessionId
}
