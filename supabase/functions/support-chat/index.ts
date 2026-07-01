/**
 * support-chat
 *
 * AI-powered support chat for customers and vendors.
 * Logs every interaction to ai_support_conversations (Architecture Rule #13).
 *
 * Required secrets:
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const SYSTEM_PROMPT = {
  customer: `You are a helpful support agent for a farmers market platform. You help customers with orders, pickups, payments, and finding local vendors. Be warm, friendly, and concise. If you cannot resolve an issue (refunds over $50, account bans, disputes), say you'll escalate to a human agent.`,
  vendor: `You are a helpful support agent for a farmers market platform. You help vendors with product listings, market scheduling, inventory, orders, and payouts. Be professional and solution-focused. For payment disputes or account issues, escalate to a human agent.`,
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')

  try {
    const { conversationHistory, userType, contextData, userId, conversationId } = await req.json()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT[userType] ?? SYSTEM_PROMPT.customer,
      messages: conversationHistory,
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I apologize, I could not generate a response. Please try again.'

    const shouldEscalate = assistantMessage.toLowerCase().includes('escalate') ||
      assistantMessage.toLowerCase().includes('human agent')

    // Log conversation (Architecture Rule #13)
    if (userId) {
      const fullHistory = [
        ...conversationHistory,
        { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() },
      ]

      if (conversationId) {
        await supabase.from('ai_support_conversations')
          .update({
            conversation_history: fullHistory,
            resolution_status: shouldEscalate ? 'escalated' : null,
            escalation_reason: shouldEscalate ? 'AI recommended human escalation' : null,
          })
          .eq('id', conversationId)
      } else {
        await supabase.from('ai_support_conversations').insert({
          user_id: userId,
          conversation_history: fullHistory,
          resolution_status: shouldEscalate ? 'escalated' : null,
          escalation_reason: shouldEscalate ? 'AI recommended human escalation' : null,
          started_at: new Date().toISOString(),
        })
      }
    }

    return new Response(
      JSON.stringify({ message: assistantMessage, shouldEscalate }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('support-chat error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
