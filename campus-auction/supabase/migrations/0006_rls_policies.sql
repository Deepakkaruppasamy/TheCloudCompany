-- ── Profiles RLS ─────────────────────────────────────────────────────────────
-- Own row read
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Allow display_name and role update
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant update on display_name and role to authenticated
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, role) ON profiles TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- ── Auctions RLS ─────────────────────────────────────────────────────────────
CREATE POLICY "auctions_select_authenticated" ON auctions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- No INSERT, UPDATE, or DELETE grants to clients — all via functions

-- ── Bids RLS ─────────────────────────────────────────────────────────────────
-- No direct grants; read only through bid_history view

-- ── Transactions RLS ─────────────────────────────────────────────────────────
CREATE POLICY "transactions_select_winner_or_seller" ON transactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = winner_id
    OR auth.uid() = (SELECT seller_id FROM auctions WHERE auctions.id = transactions.auction_id)
  );

-- ── Notifications RLS ─────────────────────────────────────────────────────────
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "notifications_update_read_at" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Column-level: only read_at can be updated
REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (read_at) ON notifications TO authenticated;
GRANT SELECT ON notifications TO authenticated;

-- Grant SELECT on auctions and transactions to authenticated
GRANT SELECT ON auctions TO authenticated;
GRANT SELECT ON transactions TO authenticated;

-- ── public_profiles view ──────────────────────────────────────────────────────
CREATE VIEW public_profiles WITH (security_barrier = true) AS
  SELECT id, display_name FROM profiles;

GRANT SELECT ON public_profiles TO authenticated;

-- ── bid_history view ──────────────────────────────────────────────────────────
CREATE VIEW bid_history WITH (security_barrier = true) AS
  SELECT
    b.auction_id,
    p.display_name,
    b.amount_paise,
    b.placed_at
  FROM bids b
  JOIN public_profiles p ON p.id = b.bidder_id;

GRANT SELECT ON bid_history TO authenticated;

-- ── public_stats function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public_stats()
RETURNS JSON LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT json_build_object(
    'active_auctions', COUNT(*)
  )
  FROM auctions
  WHERE status = 'active';
$$;

REVOKE ALL ON FUNCTION public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public_stats() TO authenticated;

-- ── Storage bucket (documented; actual creation via Supabase dashboard or CLI) ─
-- Bucket: listing-photos (private)
-- Policy: authenticated users insert only into <user_id>/... folder
-- Policy: authenticated users delete only their own objects  
-- Reads via short-lived signed URLs from server
