/**
 * generate-storefront
 *
 * Uses Claude to generate AI-assisted storefront content from vendor survey data.
 *
 * Required secrets:
 *   ANTHROPIC_API_KEY
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24?target=deno'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { surveyText, vendorType } = await req.json()

    const prompt = `You are a copywriter helping a farmers market vendor set up their online storefront.

Vendor type: ${vendorType || 'General vendor'}

Vendor's own description of their business:
"""
${surveyText || 'No description provided.'}
"""

Generate a JSON response with these fields:
{
  "bio": "A warm, authentic 2-3 sentence storefront bio in the vendor's voice. Highlight what makes them unique. First person.",
  "suggestedBadges": ["array", "of", "3-5", "short", "trust badge strings", "like", "Family Owned", "Pesticide Free", "Third Generation"],
  "suggestedCategories": ["array of relevant product category names"],
  "templateRecommendation": "One sentence recommending a storefront template style and why it suits this vendor."
}

Return ONLY valid JSON. No markdown, no explanation.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(raw)

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('generate-storefront error:', err)
    // Return a safe fallback so onboarding never hard-blocks
    return new Response(
      JSON.stringify({
        bio: 'Welcome to our store! We take pride in offering quality products from our local community.',
        suggestedBadges: ['Local', 'Handmade', 'Quality Guaranteed'],
        suggestedCategories: [],
        templateRecommendation: 'A clean, photo-forward template would showcase your products well.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
