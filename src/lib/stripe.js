import { loadStripe } from '@stripe/stripe-js'

// Stripe.js is loaded once and cached — do not call loadStripe() more than once
let stripePromise = null

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) throw new Error('Missing VITE_STRIPE_PUBLISHABLE_KEY environment variable.')
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format cents as a display string (e.g. 1999 → "$19.99")
 * All financial amounts in this app are stored as integer cents.
 */
export function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/**
 * Convert a dollar display string or float to cents.
 * Use ONLY for user-facing price inputs — never for internal calculations.
 */
export function dollarsToCents(dollars) {
  return Math.round(parseFloat(dollars) * 100)
}
