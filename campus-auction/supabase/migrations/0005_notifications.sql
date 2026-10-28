CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'auction_won', 'auction_unsold', 'seller_approval_needed',
    'seller_approved', 'seller_rejected', 'seller_unresponsive',
    'pickup_deadline', 'failed_pickup', 'handover_completed',
    'auction_cancelled', 'outbid', 'closing_soon'
  )),
  auction_id UUID NULL REFERENCES auctions(id) ON DELETE CASCADE,
  transaction_id UUID NULL REFERENCES transactions(id) ON DELETE CASCADE,
  bid_id UUID NULL REFERENCES bids(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  read_at TIMESTAMPTZ NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Deduplication indexes
CREATE UNIQUE INDEX idx_notif_closing_soon_dedup
  ON notifications(recipient_id, auction_id) WHERE type = 'closing_soon';

CREATE UNIQUE INDEX idx_notif_outbid_dedup
  ON notifications(recipient_id, bid_id) WHERE type = 'outbid';

CREATE UNIQUE INDEX idx_notif_txn_type_dedup
  ON notifications(recipient_id, transaction_id, type) WHERE transaction_id IS NOT NULL;

-- Query indexes
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
