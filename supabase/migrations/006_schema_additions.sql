-- ============================================================
-- 006_schema_additions.sql
-- Two new nullable fields:
--   1. customer_profiles.date_of_birth  — for future birthday loyalty offers
--   2. market_appearances.livestream_url — TikTok/Instagram live link for vendor
--
-- Run this in: Supabase Dashboard → SQL Editor
-- IDEMPOTENT: safe to run more than once
-- ============================================================

-- ── 1. Date of birth on customer profiles ────────────────────────────────────
-- Nullable — existing rows stay untouched.
-- Stored as a date (no time component needed).

ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

-- ── 2. Livestream URL on market appearances ──────────────────────────────────
-- Vendors can paste a TikTok or Instagram live URL so customers see a
-- live link directly on the market appearance card.

ALTER TABLE market_appearances
  ADD COLUMN IF NOT EXISTS livestream_url text;
