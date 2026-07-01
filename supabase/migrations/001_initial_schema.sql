-- ============================================================
-- Farmers Market Platform — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- All monetary amounts stored as INTEGER CENTS (never decimal dollars)
-- Financial records are IMMUTABLE once created
-- IDEMPOTENT: safe to run on a database that already has some objects
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── ADMIN HELPER FUNCTION ───────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS when checking the caller's role, preventing
-- infinite recursion when admin policies on `users` reference `users` itself.

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from users where id = auth.uid() and account_type = 'admin'
  );
$$;

-- ─── ENUM TYPES ──────────────────────────────────────────────────────────────
-- DO block pattern used because Supabase does not support CREATE TYPE IF NOT EXISTS

DO $$ BEGIN CREATE TYPE account_type AS ENUM ('customer', 'vendor', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE vendor_status AS ENUM ('pending', 'active', 'suspended'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE product_visibility AS ENUM ('published', 'draft', 'hidden'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'ready', 'fulfilled', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'partially_refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE fulfillment_method AS ENUM ('market_pickup', 'standalone_pickup', 'local_delivery', 'shipping'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE fulfillment_status AS ENUM ('pending', 'confirmed', 'ready', 'fulfilled', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE appearance_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled', 'postponed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE recurrence_pattern AS ENUM ('weekly', 'biweekly', 'monthly'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_type AS ENUM ('charge', 'vendor_payout', 'refund', 'partial_refund'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('order_update', 'vendor_appearance', 'new_follower', 'promotional', 'system', 'review_request'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('push', 'email', 'sms'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE review_status AS ENUM ('pending', 'published', 'flagged', 'removed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ticket_type AS ENUM ('help_request', 'bug_report', 'dispute', 'billing', 'account', 'feature_request'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE flag_type AS ENUM ('fake_review', 'inappropriate_content', 'vendor_dispute', 'order_problem', 'product_misrepresentation', 'payment_issue'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE flag_status AS ENUM ('open', 'under_review', 'resolved', 'dismissed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ad_campaign_type AS ENUM ('promoted_product', 'promoted_storefront', 'featured_placement', 'category_spotlight'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ad_status AS ENUM ('draft', 'active', 'paused', 'completed', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE pricing_model AS ENUM ('cpc', 'cpm'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE promotion_type AS ENUM ('percentage', 'fixed_amount', 'free_delivery', 'bogo', 'first_order'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE category_type AS ENUM ('product', 'vendor_type'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE shipping_fee_method AS ENUM ('flat', 'weight_based', 'free_over_amount'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE shipping_regions AS ENUM ('local', 'national', 'international'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE variant_type AS ENUM ('flavor', 'size', 'color', 'material'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE chargeback_status AS ENUM ('none', 'disputed', 'resolved'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE reconciliation_status AS ENUM ('open', 'reconciled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE resolution_type AS ENUM ('content_removed', 'refund_issued', 'vendor_warned', 'no_action'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ai_content_type AS ENUM ('storefront_bio', 'product_description', 'suggested_tags', 'inventory_prediction', 'market_recommendation'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ai_user_rating AS ENUM ('accepted', 'edited', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE prediction_type AS ENUM ('inventory_shortage', 'demand_spike', 'seasonal_trend', 'restock_date', 'pricing_suggestion'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE recommendation_type AS ENUM ('vendor', 'product', 'market', 'category'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE resolution_status AS ENUM ('resolved_by_ai', 'escalated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE document_type AS ENUM ('terms', 'privacy_policy', 'refund_policy'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE article_type AS ENUM ('faq', 'how_to', 'policy', 'troubleshooting'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE article_audience AS ENUM ('customer', 'vendor', 'both'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE save_type AS ENUM ('saved_search', 'wishlisted_product'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE search_type AS ENUM ('product', 'vendor', 'category', 'location', 'market'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE funded_by AS ENUM ('platform', 'vendor'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE eligible_customer_type AS ENUM ('all', 'new_customers', 'followers', 'specific_ids'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE fulfillment_type AS ENUM ('market_pickup', 'standalone_pickup', 'local_delivery', 'shipping'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── CATEGORIES ──────────────────────────────────────────────────────────────
-- Created before other tables because many tables reference it

create table if not exists categories (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  category_type      category_type not null,
  parent_category_id uuid references categories(id) on delete set null,
  description        text,
  icon_url           text,
  display_order      integer default 0,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  created_at         timestamptz not null default now()
);

-- Seed core categories only if the table is empty
do $$
begin
  if not exists (select 1 from categories limit 1) then
    insert into categories (name, category_type, display_order) values
      ('Produce',           'product',     1),
      ('Meats',             'product',     2),
      ('Dairy',             'product',     3),
      ('Baked Goods',       'product',     4),
      ('Candies & Sweets',  'product',     5),
      ('Snacks',            'product',     6),
      ('Beverages',         'product',     7),
      ('Crafts',            'product',     8),
      ('Clothing',          'product',     9),
      ('Health & Wellness', 'product',    10),
      ('Produce Farmer',    'vendor_type', 1),
      ('Bakery',            'vendor_type', 2),
      ('Meat & Poultry',    'vendor_type', 3),
      ('Dairy & Cheese',    'vendor_type', 4),
      ('Craft Maker',       'vendor_type', 5),
      ('Clothing Designer', 'vendor_type', 6),
      ('Herbalist',         'vendor_type', 7);
  end if;
end $$;

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Mirrors Supabase auth.users — extra profile data lives here

create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  account_type    account_type not null,
  first_name      text,
  last_name       text,
  phone           text,
  profile_photo_url text,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz,
  status          user_status not null default 'active'
);

-- Row Level Security
alter table users enable row level security;
drop policy if exists "Users can insert own record" on users;
create policy "Users can insert own record" on users
  for insert with check (auth.uid() = id);
drop policy if exists "Users can read own record" on users;
create policy "Users can read own record" on users
  for select using (auth.uid() = id);
drop policy if exists "Users can update own record" on users;
create policy "Users can update own record" on users
  for update using (auth.uid() = id);
drop policy if exists "Admins can read all users" on users;
create policy "Admins can read all users" on users
  for select using (is_admin());

-- ─── CUSTOMER PROFILES ───────────────────────────────────────────────────────

create table if not exists customer_profiles (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references users(id) on delete cascade,
  zip_code                  text,
  location_lat              numeric(10, 7),
  location_lng              numeric(10, 7),
  product_preferences       uuid[] default '{}',
  fulfillment_preferences   text[] default '{}',
  survey_completed_at       timestamptz,
  survey_skipped            boolean default false,
  saved_addresses           jsonb default '[]',
  notification_preferences  jsonb default '{}',
  created_at                timestamptz not null default now()
);

alter table customer_profiles enable row level security;
drop policy if exists "Customers can read/write own profile" on customer_profiles;
create policy "Customers can read/write own profile" on customer_profiles
  for all using (auth.uid() = user_id);

-- ─── VENDOR PROFILES ─────────────────────────────────────────────────────────

create table if not exists vendor_profiles (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references users(id) on delete cascade,
  business_name             text not null,
  business_description      text,
  ai_survey_text            text,
  business_type             uuid references categories(id),
  logo_url                  text,
  banner_url                text,
  contact_email             text,
  contact_phone             text,
  physical_address          text,
  years_in_business         integer,
  fulfillment_methods       text[] default '{}',
  storefront_template_id    text,
  storefront_settings       jsonb default '{}',
  stripe_connect_account_id text,
  payout_schedule           text default 'weekly',
  status                    vendor_status not null default 'pending',
  badges                    text[] default '{}',
  average_rating            numeric(3, 2) default 0,
  follower_count            integer default 0,
  onboarding_completed      boolean default false,
  created_at                timestamptz not null default now()
);

alter table vendor_profiles enable row level security;
drop policy if exists "Vendors can read/write own profile" on vendor_profiles;
create policy "Vendors can read/write own profile" on vendor_profiles
  for all using (auth.uid() = user_id);
drop policy if exists "Active vendor profiles are publicly readable" on vendor_profiles;
create policy "Active vendor profiles are publicly readable" on vendor_profiles
  for select using (status = 'active');
drop policy if exists "Admins can read all vendor profiles" on vendor_profiles;
create policy "Admins can read all vendor profiles" on vendor_profiles
  for select using (is_admin());
drop policy if exists "Admins can update all vendor profiles" on vendor_profiles;
create policy "Admins can update all vendor profiles" on vendor_profiles
  for update using (is_admin());

-- ─── MARKETS ─────────────────────────────────────────────────────────────────

create table if not exists markets (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  address           text,
  city              text,
  state             text,
  zip_code          text,
  lat               numeric(10, 7),
  lng               numeric(10, 7),
  description       text,
  typical_days      text[] default '{}',
  typical_hours     jsonb default '{}',
  category          text default 'general',
  organizer_name    text,
  organizer_contact text,
  website_url       text,
  photos            text[] default '{}',
  status            text not null default 'active' check (status in ('active', 'inactive')),
  created_at        timestamptz not null default now()
);

alter table markets enable row level security;
drop policy if exists "Markets are publicly readable" on markets;
create policy "Markets are publicly readable" on markets
  for select using (true);
drop policy if exists "Admins can manage markets" on markets;
create policy "Admins can manage markets" on markets
  for all using (is_admin());

-- ─── MARKET APPEARANCES ──────────────────────────────────────────────────────

create table if not exists market_appearances (
  id                   uuid primary key default gen_random_uuid(),
  vendor_id            uuid not null references vendor_profiles(id) on delete cascade,
  market_id            uuid not null references markets(id) on delete restrict,
  appearance_date      date not null,
  setup_time           time,
  open_time            time,
  close_time           time,
  booth_number         text,
  customer_notes       text,
  pre_orders_accepted  boolean default false,
  pre_order_cutoff_at  timestamptz,
  online_during_market boolean default false,
  status               appearance_status not null default 'scheduled',
  cancellation_reason  text,
  notifications_sent   boolean default false,
  is_recurring         boolean default false,
  recurrence_pattern   recurrence_pattern,
  parent_appearance_id uuid references market_appearances(id) on delete set null,
  post_market_notes    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table market_appearances enable row level security;
drop policy if exists "Appearances are publicly readable" on market_appearances;
create policy "Appearances are publicly readable" on market_appearances
  for select using (true);
drop policy if exists "Vendors manage own appearances" on market_appearances;
create policy "Vendors manage own appearances" on market_appearances
  for all using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── VENDOR FULFILLMENT OPTIONS ──────────────────────────────────────────────

create table if not exists vendor_fulfillment_options (
  id                           uuid primary key default gen_random_uuid(),
  vendor_id                    uuid not null references vendor_profiles(id) on delete cascade,
  fulfillment_type             fulfillment_type not null,
  pickup_address               text,
  pickup_days                  text[] default '{}',
  pickup_hours                 jsonb default '{}',
  pickup_advance_notice_hours  integer,
  pickup_instructions          text,
  delivery_radius_miles        numeric(6, 2),
  delivery_zip_codes           text[] default '{}',
  delivery_days                text[] default '{}',
  delivery_hours               jsonb default '{}',
  delivery_minimum_order_cents integer default 0,
  delivery_fee_cents           integer default 0,
  shipping_carriers            text[] default '{}',
  shipping_regions             shipping_regions,
  shipping_processing_days     integer,
  shipping_fee_method          shipping_fee_method,
  shipping_flat_fee_cents      integer default 0,
  shipping_free_over_cents     integer,
  status                       text not null default 'active' check (status in ('active', 'inactive')),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

alter table vendor_fulfillment_options enable row level security;
drop policy if exists "Fulfillment options are publicly readable" on vendor_fulfillment_options;
create policy "Fulfillment options are publicly readable" on vendor_fulfillment_options
  for select using (true);
drop policy if exists "Vendors manage own fulfillment options" on vendor_fulfillment_options;
create policy "Vendors manage own fulfillment options" on vendor_fulfillment_options
  for all using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────

create table if not exists products (
  id                    uuid primary key default gen_random_uuid(),
  vendor_id             uuid not null references vendor_profiles(id) on delete cascade,
  name                  text not null,
  description           text,
  bullet_points         text[] default '{}',
  category_id           uuid references categories(id),
  subcategory_id        uuid references categories(id),
  tags                  text[] default '{}',
  base_price_cents      integer not null default 0,
  cost_per_item_cents   integer default 0,
  compare_at_price_cents integer,
  ingredients           text,
  materials             text,
  allergen_info         text,
  care_instructions     text,
  weight_grams          integer,
  dimensions            jsonb,
  fulfillment_method_ids uuid[] default '{}',
  visibility            product_visibility not null default 'draft',
  scheduled_publish_at  timestamptz,
  is_featured           boolean default false,
  total_units_sold      integer not null default 0,
  total_views           integer not null default 0,
  average_rating        numeric(3, 2) default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table products enable row level security;
drop policy if exists "Published products are publicly readable" on products;
create policy "Published products are publicly readable" on products
  for select using (
    visibility = 'published'
    and exists (
      select 1 from vendor_profiles where id = vendor_id and status = 'active'
    )
  );
drop policy if exists "Vendors manage own products" on products;
create policy "Vendors manage own products" on products
  for all using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── PRODUCT VARIANTS ────────────────────────────────────────────────────────
-- Every product must have at least a default variant (Architecture Rule #3)

create table if not exists product_variants (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references products(id) on delete cascade,
  variant_name         text not null,
  variant_type         variant_type,
  price_cents          integer not null,
  compare_at_price_cents integer,
  sku                  text,
  barcode              text,
  stock_quantity       integer not null default 0,
  reserved_quantity    integer not null default 0,
  low_stock_threshold  integer default 5,
  status               text not null default 'active' check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table product_variants enable row level security;
drop policy if exists "Variants of published products are readable" on product_variants;
create policy "Variants of published products are readable" on product_variants
  for select using (
    exists (
      select 1 from products p
      join vendor_profiles v on v.id = p.vendor_id
      where p.id = product_id
        and p.visibility = 'published'
        and v.status = 'active'
    )
  );
drop policy if exists "Vendors manage own variants" on product_variants;
create policy "Vendors manage own variants" on product_variants
  for all using (
    exists (
      select 1 from products p
      join vendor_profiles v on v.id = p.vendor_id
      where p.id = product_id and v.user_id = auth.uid()
    )
  );

-- ─── APPEARANCE PRODUCTS ─────────────────────────────────────────────────────

create table if not exists appearance_products (
  id                   uuid primary key default gen_random_uuid(),
  appearance_id        uuid not null references market_appearances(id) on delete cascade,
  product_id           uuid not null references products(id) on delete cascade,
  variant_id           uuid references product_variants(id) on delete cascade,
  is_market_exclusive  boolean default false,
  pre_order_max_qty    integer,
  onsite_qty           integer,
  created_at           timestamptz not null default now(),
  unique (appearance_id, variant_id)
);

-- ─── ORDERS ──────────────────────────────────────────────────────────────────

create table if not exists orders (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references users(id),
  status                   order_status not null default 'pending',
  fulfillment_method       fulfillment_method not null,
  market_appearance_id     uuid references market_appearances(id),
  pickup_or_delivery_at    timestamptz,
  delivery_address         jsonb,
  customer_notes           text,
  subtotal_cents           integer not null default 0,
  platform_fee_cents       integer not null default 0,
  delivery_fee_cents       integer not null default 0,
  discount_cents           integer not null default 0,
  total_cents              integer not null default 0,
  payment_status           payment_status not null default 'pending',
  stripe_payment_intent_id text,
  notification_preferences jsonb default '{}',
  cancellation_reason      text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table orders enable row level security;
drop policy if exists "Customers can read own orders" on orders;
create policy "Customers can read own orders" on orders
  for select using (auth.uid() = customer_id);
drop policy if exists "Customers can create orders" on orders;
create policy "Customers can create orders" on orders
  for insert with check (auth.uid() = customer_id);
drop policy if exists "Admins can read all orders" on orders;
create policy "Admins can read all orders" on orders
  for select using (is_admin());

-- ─── ORDER ITEMS ─────────────────────────────────────────────────────────────

create table if not exists order_items (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references orders(id) on delete cascade,
  vendor_id              uuid not null references vendor_profiles(id),
  product_id             uuid not null references products(id),
  variant_id             uuid not null references product_variants(id),
  -- Snapshots saved at purchase time (Architecture Rule #10)
  product_name_snapshot  text not null,
  variant_snapshot       jsonb not null,
  price_cents_snapshot   integer not null,
  quantity               integer not null check (quantity > 0),
  subtotal_cents         integer not null,
  platform_fee_cents     integer not null default 0,
  vendor_payout_cents    integer not null default 0,
  fulfillment_status     fulfillment_status not null default 'pending',
  cancellation_reason    text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table order_items enable row level security;
drop policy if exists "Customers can read own order items" on order_items;
create policy "Customers can read own order items" on order_items
  for select using (
    exists (select 1 from orders where id = order_id and customer_id = auth.uid())
  );
drop policy if exists "Vendors can read items for their orders" on order_items;
create policy "Vendors can read items for their orders" on order_items
  for select using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── STOCK DECREMENT FUNCTION (atomic — Architecture Rule #4) ────────────────

create or replace function decrement_stock(
  p_variant_id uuid,
  p_quantity    integer
) returns void
language plpgsql
security definer
as $$
declare
  v_available integer;
begin
  select (stock_quantity - reserved_quantity)
  into v_available
  from product_variants
  where id = p_variant_id
  for update;

  if v_available < p_quantity then
    raise exception 'Insufficient stock for variant %', p_variant_id;
  end if;

  update product_variants
  set reserved_quantity = reserved_quantity + p_quantity,
      updated_at        = now()
  where id = p_variant_id;
end;
$$;

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
-- IMMUTABLE once created (Architecture Rule #8)

create table if not exists payments (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders(id),
  customer_id               uuid not null references users(id),
  payment_type              payment_type not null,
  amount_cents              integer not null,
  currency                  text not null default 'USD',
  status                    text not null default 'pending',
  stripe_payment_intent_id  text,
  stripe_connect_transfer_id text,
  payment_method_type       text,
  card_last_four            text,
  billing_address           jsonb,
  platform_fee_cents        integer not null default 0,
  vendor_payout_cents       integer not null default 0,
  refund_amount_cents       integer default 0,
  refund_reason             text,
  ip_address                text,
  device_type               text,
  chargeback_status         chargeback_status not null default 'none',
  chargeback_reason         text,
  tax_amount_cents          integer default 0,
  tax_rate                  numeric(6, 4),
  created_at                timestamptz not null default now()
  -- NO updated_at — immutable by design
);

-- Prevent updates/deletes to payments (immutability)
drop rule if exists payments_no_update on payments;
create rule payments_no_update as on update to payments do instead nothing;
drop rule if exists payments_no_delete on payments;
create rule payments_no_delete as on delete to payments do instead nothing;

alter table payments enable row level security;
drop policy if exists "Customers can read own payments" on payments;
create policy "Customers can read own payments" on payments
  for select using (auth.uid() = customer_id);

-- ─── VENDOR PAYOUTS ──────────────────────────────────────────────────────────

create table if not exists vendor_payouts (
  id                        uuid primary key default gen_random_uuid(),
  vendor_id                 uuid not null references vendor_profiles(id),
  period_start              date not null,
  period_end                date not null,
  order_item_ids            uuid[] default '{}',
  gross_sales_cents         integer not null default 0,
  platform_fee_deducted_cents integer not null default 0,
  refunds_deducted_cents    integer not null default 0,
  net_payout_cents          integer not null default 0,
  stripe_transfer_id        text,
  status                    payout_status not null default 'pending',
  failure_reason            text,
  bank_last_four            text,
  tax_form_reference        text,
  initiated_at              timestamptz,
  completed_at              timestamptz
);

alter table vendor_payouts enable row level security;
drop policy if exists "Vendors can read own payouts" on vendor_payouts;
create policy "Vendors can read own payouts" on vendor_payouts
  for select using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── PLATFORM FINANCIALS ─────────────────────────────────────────────────────

create table if not exists platform_financials (
  id                           uuid primary key default gen_random_uuid(),
  period_start                 date not null,
  period_end                   date not null,
  gross_merchandise_value_cents integer not null default 0,
  total_platform_fees_cents    integer not null default 0,
  total_vendor_payouts_cents   integer not null default 0,
  total_refunds_cents          integer not null default 0,
  total_chargebacks_cents      integer not null default 0,
  net_platform_revenue_cents   integer not null default 0,
  outstanding_payouts_cents    integer not null default 0,
  rolling_reserve_cents        integer not null default 0,
  reconciliation_status        reconciliation_status not null default 'open',
  created_at                   timestamptz not null default now()
);

alter table platform_financials enable row level security;
drop policy if exists "Admins can manage platform financials" on platform_financials;
create policy "Admins can manage platform financials" on platform_financials
  for all using (is_admin());

-- ─── TAX RECORDS ─────────────────────────────────────────────────────────────

create table if not exists tax_records (
  id                         uuid primary key default gen_random_uuid(),
  order_id                   uuid not null references orders(id),
  customer_location_at_purchase jsonb,
  tax_jurisdiction           text,
  tax_rate                   numeric(6, 4),
  tax_amount_cents           integer not null default 0,
  remitted                   boolean default false,
  remitted_at                timestamptz,
  filing_period              text,
  notes                      text
);

-- ─── COMPLIANCE DOCUMENTS ────────────────────────────────────────────────────

create table if not exists compliance_documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  document_type    document_type not null,
  document_version text not null,
  accepted_at      timestamptz not null default now(),
  ip_address       text
);

alter table compliance_documents enable row level security;
drop policy if exists "Users can read own compliance docs" on compliance_documents;
create policy "Users can read own compliance docs" on compliance_documents
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own compliance docs" on compliance_documents;
create policy "Users can insert own compliance docs" on compliance_documents
  for insert with check (auth.uid() = user_id);

-- ─── REVIEWS ─────────────────────────────────────────────────────────────────
-- Must be linked to a confirmed order (Architecture Rule #11)

create table if not exists reviews (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references users(id),
  vendor_id          uuid not null references vendor_profiles(id),
  product_id         uuid references products(id),
  order_id           uuid not null references orders(id),
  rating             integer not null check (rating between 1 and 5),
  title              text,
  body               text,
  photos             text[] default '{}',
  vendor_response    text,
  vendor_responded_at timestamptz,
  status             review_status not null default 'pending',
  flag_reason        text,
  helpful_votes      integer default 0,
  created_at         timestamptz not null default now(),
  published_at       timestamptz
);

alter table reviews enable row level security;
drop policy if exists "Customers can create reviews for own confirmed orders" on reviews;
create policy "Customers can create reviews for own confirmed orders" on reviews
  for insert with check (
    auth.uid() = customer_id
    and exists (
      select 1 from orders
      where id = order_id
        and customer_id = auth.uid()
        and status = 'fulfilled'
    )
  );
drop policy if exists "Published reviews are publicly readable" on reviews;
create policy "Published reviews are publicly readable" on reviews
  for select using (status = 'published');

-- ─── FOLLOWS ─────────────────────────────────────────────────────────────────

create table if not exists follows (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references users(id),
  vendor_id                uuid not null references vendor_profiles(id),
  notification_preferences jsonb default '{}',
  status                   text not null default 'active' check (status in ('active', 'inactive')),
  created_at               timestamptz not null default now(),
  unique (customer_id, vendor_id)
);

alter table follows enable row level security;
drop policy if exists "Customers manage own follows" on follows;
create policy "Customers manage own follows" on follows
  for all using (auth.uid() = customer_id);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

create table if not exists notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_user_id   uuid not null references users(id),
  sender_vendor_id    uuid references vendor_profiles(id),
  notification_type   notification_type not null,
  title               text not null,
  body                text,
  deep_link           text,
  channel             notification_channel not null,
  delivery_status     delivery_status not null default 'pending',
  read_status         text not null default 'unread' check (read_status in ('unread', 'read')),
  related_entity_type text,
  related_entity_id   uuid,
  sent_at             timestamptz,
  read_at             timestamptz
);

alter table notifications enable row level security;
drop policy if exists "Users can read own notifications" on notifications;
create policy "Users can read own notifications" on notifications
  for select using (auth.uid() = recipient_user_id);
drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications" on notifications
  for update using (auth.uid() = recipient_user_id);

-- ─── USER BEHAVIOR ───────────────────────────────────────────────────────────
-- Event-driven: new event types added by logging new event_type string (Architecture Rule #15)

create table if not exists user_behavior (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references users(id),
  event_type          text not null,
  entity_type         text,
  entity_id           uuid,
  session_id          uuid,
  device_type         text,
  location_approximate jsonb,
  search_term         text,
  filters_used        jsonb,
  time_on_page_seconds integer,
  referral_source     text,
  converted           boolean default false,
  funnel_stage        text,
  ab_test_group       text,
  platform_version    text,
  created_at          timestamptz not null default now()
);

alter table user_behavior enable row level security;
drop policy if exists "Users can insert own behavior" on user_behavior;
create policy "Users can insert own behavior" on user_behavior
  for insert with check (auth.uid() = customer_id);
drop policy if exists "Admins can read all behavior" on user_behavior;
create policy "Admins can read all behavior" on user_behavior
  for select using (is_admin());

-- ─── SEARCH HISTORY ──────────────────────────────────────────────────────────

create table if not exists search_history (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references users(id),
  search_term        text not null,
  search_type        search_type not null,
  filters_applied    jsonb,
  results_count      integer,
  clicked_result_id  uuid,
  led_to_purchase    boolean default false,
  location_at_search jsonb,
  created_at         timestamptz not null default now()
);

alter table search_history enable row level security;
drop policy if exists "Users can manage own search history" on search_history;
create policy "Users can manage own search history" on search_history
  for all using (auth.uid() = customer_id);

-- ─── SAVED SEARCHES AND WISHLISTS ────────────────────────────────────────────

create table if not exists saved_searches_wishlists (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references users(id),
  save_type            save_type not null,
  product_id           uuid references products(id),
  search_term          text,
  search_filters       jsonb,
  notify_new_matches   boolean default false,
  notify_back_in_stock boolean default false,
  status               text not null default 'active' check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now()
);

alter table saved_searches_wishlists enable row level security;
drop policy if exists "Users manage own saved searches" on saved_searches_wishlists;
create policy "Users manage own saved searches" on saved_searches_wishlists
  for all using (auth.uid() = customer_id);

-- ─── ADVERTISING ─────────────────────────────────────────────────────────────

create table if not exists advertising (
  id                     uuid primary key default gen_random_uuid(),
  vendor_id              uuid not null references vendor_profiles(id),
  campaign_type          ad_campaign_type not null,
  product_id             uuid references products(id),
  target_category_ids    uuid[] default '{}',
  target_zip_codes       text[] default '{}',
  target_market_ids      uuid[] default '{}',
  status                 ad_status not null default 'draft',
  budget_cents           integer not null default 0,
  daily_spend_limit_cents integer default 0,
  pricing_model          pricing_model,
  total_spent_cents      integer not null default 0,
  total_impressions      integer not null default 0,
  total_clicks           integer not null default 0,
  total_conversions      integer not null default 0,
  start_at               timestamptz,
  end_at                 timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ─── DISCOUNTS AND PROMOTIONS ─────────────────────────────────────────────────

create table if not exists discounts_promotions (
  id                       uuid primary key default gen_random_uuid(),
  created_by_type          text not null check (created_by_type in ('vendor', 'admin')),
  created_by_id            uuid not null,
  promotion_type           promotion_type not null,
  promo_code               text unique,
  is_automatic             boolean default false,
  discount_amount_cents    integer default 0,
  discount_percentage      numeric(5, 2),
  minimum_order_cents      integer default 0,
  maximum_discount_cents   integer,
  applicable_product_ids   uuid[] default '{}',
  applicable_vendor_id     uuid references vendor_profiles(id),
  applicable_category_ids  uuid[] default '{}',
  eligible_customer_type   eligible_customer_type not null default 'all',
  total_usage_limit        integer,
  per_customer_usage_limit integer,
  total_times_used         integer not null default 0,
  total_discount_value_cents integer not null default 0,
  funded_by                funded_by not null,
  start_at                 timestamptz,
  expires_at               timestamptz,
  status                   text not null default 'active' check (status in ('active', 'inactive')),
  created_at               timestamptz not null default now()
);

-- ─── ADMIN ACTIONS ───────────────────────────────────────────────────────────

create table if not exists admin_actions (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references users(id),
  action_type    text not null,
  entity_type    text not null,
  entity_id      uuid,
  reason         text,
  previous_state jsonb,
  new_state      jsonb,
  created_at     timestamptz not null default now()
);

alter table admin_actions enable row level security;
drop policy if exists "Admins can manage admin actions" on admin_actions;
create policy "Admins can manage admin actions" on admin_actions
  for all using (is_admin());

-- ─── FLAGS AND REPORTS ────────────────────────────────────────────────────────

create table if not exists flags_reports (
  id                    uuid primary key default gen_random_uuid(),
  reported_by_user_id   uuid not null references users(id),
  flag_type             flag_type not null,
  entity_type           text not null,
  entity_id             uuid not null,
  description           text,
  evidence_urls         text[] default '{}',
  status                flag_status not null default 'open',
  assigned_to_admin_id  uuid references users(id),
  resolution_notes      text,
  resolution_type       resolution_type,
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz
);

-- ─── HELP ARTICLES ───────────────────────────────────────────────────────────

create table if not exists help_articles (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  content             text not null,
  article_type        article_type not null,
  audience            article_audience not null,
  category            text,
  related_article_ids uuid[] default '{}',
  helpful_votes       integer not null default 0,
  view_count          integer not null default 0,
  search_terms        text[] default '{}',
  status              text not null default 'active' check (status in ('active', 'inactive')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────

create table if not exists support_tickets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id),
  user_type             text not null check (user_type in ('customer', 'vendor')),
  ticket_type           ticket_type not null,
  subject               text not null,
  description           text,
  attachment_urls       text[] default '{}',
  related_order_id      uuid references orders(id),
  related_product_id    uuid references products(id),
  priority              ticket_priority not null default 'normal',
  status                ticket_status not null default 'open',
  assigned_to_admin_id  uuid references users(id),
  ai_handled            boolean default false,
  escalated_to_human    boolean default false,
  resolution_notes      text,
  satisfaction_rating   integer check (satisfaction_rating between 1 and 5),
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz
);

alter table support_tickets enable row level security;
drop policy if exists "Users can manage own tickets" on support_tickets;
create policy "Users can manage own tickets" on support_tickets
  for all using (auth.uid() = user_id);

-- ─── AI SUPPORT CONVERSATIONS ────────────────────────────────────────────────
-- Every interaction logged (Architecture Rule #13)

create table if not exists ai_support_conversations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id),
  ticket_id            uuid references support_tickets(id),
  conversation_history jsonb not null default '[]',
  resolution_status    resolution_status,
  escalation_reason    text,
  topics_covered       text[] default '{}',
  helpful_rating       boolean,
  started_at           timestamptz not null default now(),
  ended_at             timestamptz
);

alter table ai_support_conversations enable row level security;
drop policy if exists "Users can read own AI conversations" on ai_support_conversations;
create policy "Users can read own AI conversations" on ai_support_conversations
  for select using (auth.uid() = user_id);

-- ─── AI GENERATED CONTENT ────────────────────────────────────────────────────

create table if not exists ai_generated_content (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid not null references vendor_profiles(id),
  product_id       uuid references products(id),
  content_type     ai_content_type not null,
  original_content text not null,
  edited_content   text,
  model_version    text,
  generation_prompt text,
  user_rating      ai_user_rating,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table ai_generated_content enable row level security;
drop policy if exists "Vendors can manage own AI content" on ai_generated_content;
create policy "Vendors can manage own AI content" on ai_generated_content
  for all using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── RECOMMENDATIONS ─────────────────────────────────────────────────────────
-- Pre-calculated, never computed on page load (Architecture Rule #14)

create table if not exists recommendations (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references users(id),
  recommendation_type      recommendation_type not null,
  recommended_entity_ids   uuid[] not null default '{}',
  algorithm_version        text,
  signals_used             text[] default '{}',
  confidence_score         numeric(4, 3),
  clicked                  boolean default false,
  converted                boolean default false,
  expires_at               timestamptz,
  generated_at             timestamptz not null default now()
);

alter table recommendations enable row level security;
drop policy if exists "Users can read own recommendations" on recommendations;
create policy "Users can read own recommendations" on recommendations
  for select using (auth.uid() = customer_id);

-- ─── AI PREDICTIONS ──────────────────────────────────────────────────────────

create table if not exists ai_predictions (
  id                      uuid primary key default gen_random_uuid(),
  vendor_id               uuid not null references vendor_profiles(id),
  product_id              uuid references products(id),
  variant_id              uuid references product_variants(id),
  prediction_type         prediction_type not null,
  prediction_details      text,
  confidence_level        confidence_level not null default 'low',
  data_points_used        integer,
  prediction_window_start timestamptz,
  prediction_window_end   timestamptz,
  actual_outcome          text,
  vendor_acted_on         boolean default false,
  generated_at            timestamptz not null default now()
);

alter table ai_predictions enable row level security;
drop policy if exists "Vendors can read own predictions" on ai_predictions;
create policy "Vendors can read own predictions" on ai_predictions
  for select using (
    exists (select 1 from vendor_profiles where id = vendor_id and user_id = auth.uid())
  );

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

-- Orders
create index if not exists idx_orders_customer_id    on orders(customer_id);
create index if not exists idx_orders_status         on orders(status);
create index if not exists idx_orders_created_at     on orders(created_at desc);

-- Order items
create index if not exists idx_order_items_order_id  on order_items(order_id);
create index if not exists idx_order_items_vendor_id on order_items(vendor_id);

-- Products
create index if not exists idx_products_vendor_id    on products(vendor_id);
create index if not exists idx_products_category_id  on products(category_id);
create index if not exists idx_products_visibility   on products(visibility);

-- Product variants
create index if not exists idx_variants_product_id   on product_variants(product_id);

-- Market appearances
create index if not exists idx_appearances_vendor_id on market_appearances(vendor_id);
create index if not exists idx_appearances_market_id on market_appearances(market_id);
create index if not exists idx_appearances_date      on market_appearances(appearance_date);

-- User behavior
create index if not exists idx_behavior_customer_id  on user_behavior(customer_id);
create index if not exists idx_behavior_event_type   on user_behavior(event_type);
create index if not exists idx_behavior_created_at   on user_behavior(created_at desc);

-- Follows
create index if not exists idx_follows_vendor_id     on follows(vendor_id);

-- Payments
create index if not exists idx_payments_order_id     on payments(order_id);

-- Search history
create index if not exists idx_search_customer_id    on search_history(customer_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger set_updated_at_market_appearances
  before update on market_appearances
  for each row execute function set_updated_at();

create or replace trigger set_updated_at_vendor_fulfillment_options
  before update on vendor_fulfillment_options
  for each row execute function set_updated_at();

create or replace trigger set_updated_at_products
  before update on products
  for each row execute function set_updated_at();

create or replace trigger set_updated_at_product_variants
  before update on product_variants
  for each row execute function set_updated_at();

create or replace trigger set_updated_at_orders
  before update on orders
  for each row execute function set_updated_at();

create or replace trigger set_updated_at_order_items
  before update on order_items
  for each row execute function set_updated_at();

create or replace trigger set_updated_at_ai_generated_content
  before update on ai_generated_content
  for each row execute function set_updated_at();
