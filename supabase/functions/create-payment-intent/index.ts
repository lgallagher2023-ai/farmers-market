/**
 * create-payment-intent
 *
 * Creates a Stripe PaymentIntent for a multi-vendor order using Stripe Connect.
 *
 * Required secret (Supabase Dashboard → Edge Functions → Secrets):
 *   STRIPE_SECRET_KEY   — your Stripe secret key (sk_live_... or sk_test_...)
 *
 * CORS: allows all origins so this works from any Vercel preview/production URL.
 * Restrict ALLOWED_ORIGINS to your domain if you want to tighten it later.
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno'

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow any origin so Vercel preview deploys (random subdomain URLs) all work.
// Swap '*' for your exact Vercel URL if you want to lock it down, e.g.:
//   'https://your-app.vercel.app'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function corsResponse(body: string | null, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extra },
  })
}

// ── Stripe ────────────────────────────────────────────────────────────────────
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

if (!stripeKey) {
  // Log once at cold-start so the problem is visible in Edge Function logs
  console.error('[create-payment-intent] STRIPE_SECRET_KEY is not set!')
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Respond to CORS preflight — browser sends this before every real request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405)
  }

  // Fail fast if the secret is missing — gives a clear error in the UI
  if (!stripeKey) {
    return corsResponse(
      JSON.stringify({ error: 'Server configuration error: STRIPE_SECRET_KEY is not set' }),
      500,
    )
  }

  try {
    const {
      items,
      totalCents,
      platformFeeCents,
      fulfillmentMethod,
      marketAppearanceId,
      customerId,
    } = await req.json()

    if (!items?.length || !totalCents) {
      return corsResponse(JSON.stringify({ error: 'Invalid request body' }), 400)
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_id:          customerId ?? 'guest',
        fulfillment_method:   fulfillmentMethod,
        market_appearance_id: marketAppearanceId ?? '',
        platform_fee_cents:   String(platformFeeCents),
        item_count:           String(items.length),
      },
    })

    return corsResponse(JSON.stringify({ clientSecret: paymentIntent.client_secret }))

  } catch (err) {
    console.error('[create-payment-intent] Stripe error:', err)
    return corsResponse(JSON.stringify({ error: err.message }), 500)
  }
})
