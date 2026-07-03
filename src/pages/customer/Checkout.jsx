import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe, formatCents, dollarsToCents } from '../../lib/stripe'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { Input } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

const PLATFORM_FEE_PERCENT = Number(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? 10)

export default function Checkout() {
  const { items, subtotalCents, discountCents } = useCart()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // Guests: user is null; authenticated customers: user is set
  const isGuest = !user

  const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEE_PERCENT / 100)
  const totalCents = subtotalCents + platformFeeCents - discountCents

  const [clientSecret, setClientSecret] = useState(null)
  const [step, setStep] = useState('contact') // contact | payment
  const [contact, setContact] = useState({
    name:              isGuest ? '' : `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    email:             isGuest ? '' : (profile?.email ?? ''),
    phone:             isGuest ? '' : (profile?.phone ?? ''),
    fulfillmentMethod: 'market_pickup',
    marketAppearanceId: '',
    deliveryAddress:   '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField(field) {
    return (e) => setContact(c => ({ ...c, [field]: e.target.value }))
  }

  async function createPaymentIntent() {
    if (!contact.name.trim()) { setError('Please enter your full name'); return }
    if (!contact.email.trim()) { setError('Please enter your email'); return }

    setLoading(true)
    setError('')

    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        items: items.map(i => ({
          variantId:  i.variantId,
          vendorId:   i.vendorId,
          quantity:   i.quantity,
          priceCents: i.priceCents,
        })),
        totalCents,
        platformFeeCents,
        fulfillmentMethod:  contact.fulfillmentMethod,
        marketAppearanceId: contact.marketAppearanceId || null,
        customerId:         user?.id ?? null,  // null for guests
      },
    })

    if (error || !data?.clientSecret) {
      setError(error?.message ?? 'Could not initialize payment. Please try again.')
      setLoading(false)
      return
    }

    setClientSecret(data.clientSecret)
    setStep('payment')
    setLoading(false)
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Your cart is empty.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => step === 'payment' ? setStep('contact') : navigate(-1)}
          className="text-gray-400"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
        <div className="ml-auto flex items-center gap-2">
          {isGuest && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              Guest
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Guest sign-in prompt */}
        {isGuest && step === 'contact' && (
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🌿</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-900">Have an account?</p>
              <p className="text-xs text-brand-700 mt-0.5">
                Sign in to track orders, save favourites, and check out faster.
              </p>
              <button
                onClick={() => navigate('/login', { state: { from: '/checkout' } })}
                className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
              >
                Sign in →
              </button>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex gap-2 items-center">
          {['Contact', 'Payment'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full text-xs flex items-center justify-center font-semibold
                ${(i === 0 && step === 'contact') || (i === 1 && step === 'payment')
                  ? 'bg-brand-600 text-white'
                  : i < ['contact', 'payment'].indexOf(step)
                  ? 'bg-brand-100 text-brand-600'
                  : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}
              </div>
              <span className="text-sm text-gray-600">{s}</span>
              {i < 1 && <span className="text-gray-300">→</span>}
            </div>
          ))}
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Order summary</p>
            <p className="text-sm font-bold text-gray-900">{formatCents(totalCents)}</p>
          </div>
          <div className="p-4 space-y-2 text-sm">
            {items.map(i => (
              <div key={i.variantId} className="flex justify-between text-gray-600">
                <span className="truncate mr-2">
                  {i.quantity}× {i.name}
                  {i.variantSnapshot?.variant_name !== 'Default' ? ` (${i.variantSnapshot?.variant_name})` : ''}
                </span>
                <span className="flex-shrink-0">{formatCents(i.priceCents * i.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Platform fee</span><span>{formatCents(platformFeeCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span>−{formatCents(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 pt-1">
                <span>Total</span><span>{formatCents(totalCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Contact & fulfillment */}
        {step === 'contact' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">
              {isGuest ? 'Your contact details' : 'Contact & delivery'}
            </h2>

            <Input
              label="Full name"
              value={contact.name}
              onChange={setField('name')}
              required
              placeholder={isGuest ? 'Jane Smith' : ''}
            />
            <Input
              label="Email"
              type="email"
              value={contact.email}
              onChange={setField('email')}
              required
              hint={isGuest ? 'Order confirmation will be sent here' : undefined}
              placeholder={isGuest ? 'jane@example.com' : ''}
            />
            <Input
              label="Phone"
              type="tel"
              value={contact.phone}
              onChange={setField('phone')}
              hint={isGuest ? 'For order updates (optional)' : undefined}
              placeholder="(555) 000-0000"
            />

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Fulfillment method</p>
              {[
                { value: 'market_pickup',      label: '🏪 Pick up at market' },
                { value: 'standalone_pickup',  label: '📦 Pickup from vendor' },
                { value: 'local_delivery',     label: '🚚 Local delivery' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 py-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="fulfillment"
                    value={value}
                    checked={contact.fulfillmentMethod === value}
                    onChange={setField('fulfillmentMethod')}
                    className="text-brand-600"
                  />
                  {label}
                </label>
              ))}
            </div>

            {contact.fulfillmentMethod === 'local_delivery' && (
              <Input
                label="Delivery address"
                value={contact.deliveryAddress}
                onChange={setField('deliveryAddress')}
                placeholder="123 Main St, City, State 00000"
                required
              />
            )}

            <Button onClick={createPaymentIntent} loading={loading} className="w-full" size="lg">
              Continue to payment
            </Button>
          </div>
        )}

        {/* Step 2: Payment via Stripe */}
        {step === 'payment' && clientSecret && (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <PaymentStep
              contact={contact}
              totalCents={totalCents}
              platformFeeCents={platformFeeCents}
              discountCents={discountCents}
              clientSecret={clientSecret}
              isGuest={isGuest}
            />
          </Elements>
        )}
      </div>
    </div>
  )
}

// ─── Payment step ─────────────────────────────────────────────────────────────

function PaymentStep({ contact, totalCents, platformFeeCents, discountCents, clientSecret, isGuest }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, subtotalCents, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)

  const PLATFORM_FEE_PERCENT = Number(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? 10)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stripe || !elements || !agreed) return
    setLoading(true)
    setError('')

    // Confirm the payment with Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed.')
      setLoading(false)
      return
    }

    // Build order record — customer_id is null for guests
    const orderPayload = {
      customer_id:              user?.id ?? null,
      status:                   'pending',
      fulfillment_method:       contact.fulfillmentMethod,
      delivery_address:         contact.deliveryAddress ? { address: contact.deliveryAddress } : null,
      subtotal_cents:           subtotalCents,
      platform_fee_cents:       platformFeeCents,
      discount_cents:           discountCents,
      total_cents:              totalCents,
      payment_status:           paymentIntent?.status === 'succeeded' ? 'paid' : 'pending',
      stripe_payment_intent_id: paymentIntent?.id,
      // Guest fields (null for authenticated users)
      guest_name:               isGuest ? contact.name : null,
      guest_email:              isGuest ? contact.email : null,
      guest_phone:              isGuest ? contact.phone : null,
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single()

    if (orderError) {
      setError(orderError.message)
      setLoading(false)
      return
    }

    // Create order items with snapshots (Architecture Rule #10)
    for (const item of items) {
      await supabase.from('order_items').insert({
        order_id:                order.id,
        vendor_id:               item.vendorId,
        product_id:              item.productId,
        variant_id:              item.variantId,
        product_name_snapshot:   item.name,
        variant_snapshot:        item.variantSnapshot,
        price_cents_snapshot:    item.priceCents,
        quantity:                item.quantity,
        subtotal_cents:          item.priceCents * item.quantity,
        platform_fee_cents:      Math.round(item.priceCents * item.quantity * PLATFORM_FEE_PERCENT / 100),
        vendor_payout_cents:     Math.round(item.priceCents * item.quantity * (1 - PLATFORM_FEE_PERCENT / 100)),
      })

      // Atomically decrement stock (Architecture Rule #4)
      await supabase.rpc('decrement_stock', {
        p_variant_id: item.variantId,
        p_quantity:   item.quantity,
      })
    }

    // Log payment record (immutable — Architecture Rule #8)
    await supabase.from('payments').insert({
      order_id:                 order.id,
      customer_id:              user?.id ?? null,
      payment_type:             'charge',
      amount_cents:             totalCents,
      status:                   'completed',
      stripe_payment_intent_id: paymentIntent?.id,
      platform_fee_cents:       platformFeeCents,
    })

    clearCart()

    // Navigate to confirmation, passing a summary in state so the confirmation
    // page can display without a Supabase read (needed for guest users whose
    // RLS may not allow them to select the order they just created).
    navigate(`/orders/${order.id}/confirmation`, {
      replace: true,
      state: {
        isGuest,
        guestEmail:   isGuest ? contact.email : null,
        guestName:    isGuest ? contact.name : null,
        orderSummary: {
          id:                 order.id,
          total_cents:        totalCents,
          subtotal_cents:     subtotalCents,
          platform_fee_cents: platformFeeCents,
          discount_cents:     discountCents,
          items: items.map(i => ({
            product_name_snapshot: i.name,
            variant_snapshot:      i.variantSnapshot,
            quantity:              i.quantity,
            subtotal_cents:        i.priceCents * i.quantity,
          })),
        },
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
        <svg className="h-3.5 w-3.5 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <h2 className="text-sm font-semibold text-gray-700">Secure payment</h2>
        <span className="ml-auto text-xs text-gray-400">Powered by Stripe</span>
      </div>
      <div className="p-5 space-y-4">

      {error && <Alert type="error">{error}</Alert>}

      <PaymentElement />

      <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5 rounded text-brand-600"
          required
        />
        <span>
          I agree to the{' '}
          <a href="#" className="text-brand-600 hover:underline">Terms of Service</a>,{' '}
          <a href="#" className="text-brand-600 hover:underline">Cancellation Policy</a>, and{' '}
          <a href="#" className="text-brand-600 hover:underline">Refund Policy</a>.
        </span>
      </label>

      <Button
        type="submit"
        loading={loading}
        disabled={!stripe || !agreed}
        className="w-full"
        size="lg"
      >
        Confirm & pay {formatCents(totalCents)}
      </Button>
      </div>
    </form>
  )
}
