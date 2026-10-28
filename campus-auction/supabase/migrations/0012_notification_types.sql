-- Migration 0012: Expand notification types for Phase-2 features
-- Supports question_asked, question_answered, saved_search_match, auction_extended, proxy_outbid

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'auction_won', 'auction_unsold', 'seller_approval_needed',
  'seller_approved', 'seller_rejected', 'seller_unresponsive',
  'pickup_deadline', 'failed_pickup', 'handover_completed',
  'auction_cancelled', 'outbid', 'closing_soon',
  'listing_created', 'listing_updated', 'bid_placed', 'bid_received',
  'question_asked', 'question_answered', 'saved_search_match',
  'auction_extended', 'proxy_outbid'
));
