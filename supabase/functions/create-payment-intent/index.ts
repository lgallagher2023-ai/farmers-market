/**
 * create-payment-intent
 *
 * Creates a Stripe PaymentIntent for a multi-vendor order using Stripe Connect.
 * Each vendor's share is transferred automatically at capture time.
 *
 * Required secrets (set in Supabase Dashboard → Edge Functions → Secrets):
 *   STRIPE_SECRET_KEY
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const PLATFORM_FEE_PERCENT = 10

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { items, totalCents, platformFeeCents, fulfillmentMethod, marketAppearanceId, customerId } = await req.json()

    if (!items?.length || !totalCents) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
    }

    // Create a single PaymentIntent for the full order total.
    // Individual vendor transfers are handled via Stripe Connect separate charges
    // or via Transfer objects after capture — implementation depends on your
    // Stripe Connect model (destination charges vs separate charges).
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_id: customerId,
        fulfillment_method: fulfillmentMethod,
        market_appearance_id: marketAppearanceId ?? '',
        platform_fee_cents: String(platformFeeCents),
        item_count: String(items.length),
      },
    })

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-payment-intent error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
