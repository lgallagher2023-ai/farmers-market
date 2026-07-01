-- ============================================================
-- 004_vendor_order_rls.sql
-- Fix: vendors cannot see orders that contain their products.
--
-- Root cause: the orders table had SELECT policies only for customers
-- and admins. PostgREST enforces RLS on BOTH sides of a join — so
-- the "orders!inner(...)" join in the vendor Orders page and vendor
-- Dashboard silently returned no rows, even though order_items had
-- the correct vendor_id and its own SELECT policy was fine.
--
-- Additional fix: no UPDATE policy existed on order_items for vendors,
-- so fulfillment status changes would silently do nothing.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- IDEMPOTENT: safe to run more than once
-- ============================================================

-- ── 1. Vendors can read orders that contain their items ──────────────────────

DROP POLICY IF EXISTS "Vendors can read orders containing their items" ON orders;
CREATE POLICY "Vendors can read orders containing their items" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   order_items oi
      JOIN   vendor_profiles vp ON vp.id = oi.vendor_id
      WHERE  oi.order_id = orders.id
        AND  vp.user_id  = auth.uid()
    )
  );

-- ── 2. Vendors can update fulfillment_status on their own order items ────────

DROP POLICY IF EXISTS "Vendors can update own order items" ON order_items;
CREATE POLICY "Vendors can update own order items" ON order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendor_profiles
      WHERE id = vendor_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_profiles
      WHERE id = vendor_id AND user_id = auth.uid()
    )
  );
