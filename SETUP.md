# Farmers Market Platform — Setup Guide

Follow these steps in order before running Phase 2.

---

## 1. Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon public** key (Settings → API)
3. Open **SQL Editor** and run the full contents of `supabase/migrations/001_initial_schema.sql`
4. Go to **Authentication → Providers** → confirm Email is enabled
5. Go to **Edge Functions** and add these secrets (Settings → Edge Functions → Secrets):
   - `STRIPE_SECRET_KEY` — your Stripe secret key
   - `ANTHROPIC_API_KEY` — your Anthropic API key

---

## 2. Stripe

1. Go to [stripe.com](https://stripe.com) → create account
2. Enable **Connect** (Dashboard → Connect → Get started)
3. Note your **Publishable key** and **Secret key** (Developers → API Keys)
4. Use test mode keys (`pk_test_...` / `sk_test_...`) until ready for production
5. Set up a **webhook endpoint** pointing to your Supabase Edge Function URL for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated` (for Connect onboarding)

---

## 3. Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your Supabase URL, anon key, and Stripe publishable key.

**Never commit `.env.local`** — it's in `.gitignore`.

---

## 4. Install Dependencies

```bash
cd farmers-market
npm install
```

---

## 5. Run Locally

```bash
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173)

---

## 6. Vercel Deployment

1. Push to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import project → select your repo
3. Add environment variables in Vercel Dashboard → Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
   - `VITE_APP_URL` (your Vercel deployment URL)
4. Deploy

The `vercel.json` already handles SPA routing rewrites.

---

## Project Structure

```
farmers-market/
├── src/
│   ├── App.jsx                  # Routes for all screens
│   ├── main.jsx
│   ├── context/
│   │   ├── AuthContext.jsx      # Auth state + user profile
│   │   └── CartContext.jsx      # Multi-vendor cart state
│   ├── lib/
│   │   ├── supabase.js          # Supabase client
│   │   ├── stripe.js            # Stripe loader + cent helpers
│   │   └── anthropic.js        # Claude API via Edge Functions
│   ├── pages/
│   │   ├── customer/            # Customer-facing screens
│   │   ├── vendor/              # Vendor dashboard screens
│   │   └── admin/               # Admin screens
│   ├── components/
│   │   ├── ui/                  # Shared UI primitives
│   │   ├── layout/              # Nav, headers, shells
│   │   ├── customer/            # Customer-specific components
│   │   ├── vendor/              # Vendor-specific components
│   │   └── admin/               # Admin-specific components
│   ├── hooks/                   # Custom React hooks
│   ├── utils/                   # Pure utility functions
│   └── styles/
│       └── index.css            # Tailwind + global styles
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
├── vercel.json
├── vite.config.js
├── tailwind.config.js
└── package.json
```
