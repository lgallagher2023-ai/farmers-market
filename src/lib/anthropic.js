/**
 * Anthropic Claude API calls are made server-side via Supabase Edge Functions
 * to keep the API key secret. This file contains the client-side helpers that
 * call those functions.
 *
 * Edge functions to create in Supabase:
 *   - generate-storefront   (vendor onboarding AI assistant)
 *   - support-chat          (AI customer/vendor support)
 *   - inventory-predict     (inventory forecasting — Phase 2)
 *   - recommend             (personalization — Phase 2)
 */

import { supabase } from './supabase'

/**
 * Call a Supabase Edge Function and return the parsed JSON response.
 */
async function callEdgeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(`Edge function '${name}' failed: ${error.message}`)
  return data
}

/**
 * Generate AI-assisted storefront content from the vendor's survey text.
 * Returns: { bio, suggestedBadges, suggestedCategories, templateRecommendation }
 */
export async function generateStorefront(surveyText, vendorType) {
  return callEdgeFunction('generate-storefront', { surveyText, vendorType })
}

/**
 * Send a support chat message and get a Claude response.
 * conversationHistory: array of { role: 'user'|'assistant', content: string }
 */
export async function sendSupportMessage(conversationHistory, userType, contextData = {}) {
  return callEdgeFunction('support-chat', { conversationHistory, userType, contextData })
}
