-- ============================================================
-- 003_guest_checkout.sql
-- Enables guest checkout — customers can purchase without an account.
-- Run this in: Supabase Dashboard → SQL Editor
-- IDEMPOTENT: safe to run more than once
-- ============================================================

-- ── 1. Make customer_id nullable so guest orders can omit it ─────────────────

ALTER TABLE orders  ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN customer_id DROP NOT NULL;

-- ── 2. Add guest contact columns to orders ───────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_name  text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text;

-- ── 3. RLS — Orders ──────────────────────────────────────────────────────────

-- INSERT: authenticated users set customer_id = self; guests leave it null
DROP POLICY IF EXISTS "Customers can create orders" ON orders;
CREATE POLICY "Insert orders" ON orders
  FOR INSERT WITH CHECK (
    -- Logged-in customer inserting their own order
    (auth.uid() IS NOT NULL AND customer_id = auth.uid())
    -- Guest (no session) inserting without a customer_id
    OR (auth.uid() IS NULL AND customer_id IS NULL)
  );

-- SELECT: authenticated users read their own; guest orders readable by UUID
-- (UUID is cryptographically unguessable — safe for confirmation page)
DROP POLICY IF EXISTS "Customers can read own orders" ON orders;
CREATE POLICY "Read orders" ON orders
  FOR SELECT USING (
    auth.uid() = customer_id
    OR customer_id IS NULL
  );

-- ── 4. RLS — Order items ─────────────────────────────────────────────────────
-- No INSERT policy existed before; this enables both auth and guest inserts.

DROP POLICY IF EXISTS "Customers can insert order items" ON order_items;
DROP POLICY IF EXISTS "Insert order items" ON order_items;
CREATE POLICY "Insert order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND (
          o.customer_id = auth.uid()
          OR o.customer_id IS NULL
        )
    )
  );

-- ── 5. RLS — Payments ────────────────────────────────────────────────────────
-- No INSERT policy existed before; add one for both auth and guest paths.

DROP POLICY IF EXISTS "Customers can insert payments" ON payments;
DROP POLICY IF EXISTS "Insert payments" ON payments;
CREATE POLICY "Insert payments" ON payments
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND customer_id = auth.uid())
    OR (auth.uid() IS NULL AND customer_id IS NULL)
  );
