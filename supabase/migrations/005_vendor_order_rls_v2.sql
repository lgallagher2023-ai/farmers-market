-- ============================================================
-- 005_vendor_order_rls_v2.sql
-- Fix: circular RLS dependency in the vendor orders policy.
--
-- The policy from 004 queried order_items inside the orders RLS
-- check. order_items has its own RLS policy that queries back to
-- orders — creating a recursive loop that PostgreSQL breaks by
-- silently returning no rows.
--
-- Solution: wrap the check in a SECURITY DEFINER function so it
-- runs as the DB owner (bypassing order_items RLS), eliminating
-- the cycle. auth.uid() still returns the CURRENT user's ID —
-- Supabase injects it as a session variable, not via the definer.
-- This is the same pattern used by is_admin().
--
-- Run this in: Supabase Dashboard → SQL Editor
-- IDEMPOTENT: safe to run more than once
-- ============================================================

-- ── SECURITY DEFINER helper ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION vendor_has_order_item(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   order_items  oi
    JOIN   vendor_profiles vp ON vp.id = oi.vendor_id
    WHERE  oi.order_id  = p_order_id
      AND  vp.user_id   = auth.uid()
  );
$$;

-- ── Recreate the orders vendor policy using the function ─────────────────────
-- Drop both the 004 version and any stale copy before recreating.

DROP POLICY IF EXISTS "Vendors can read orders containing their items" ON orders;
CREATE POLICY "Vendors can read orders containing their items" ON orders
  FOR SELECT USING (vendor_has_order_item(id));
