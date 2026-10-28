CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL UNIQUE REFERENCES auctions(id),
  winner_id UUID NOT NULL REFERENCES profiles(id),
  winning_bid_id UUID NOT NULL REFERENCES bids(id),
  final_amount_paise BIGINT NOT NULL CHECK (final_amount_paise > 0),
  status TEXT NOT NULL CHECK (status IN (
    'pending_seller_approval', 'reserved', 'rejected', 
    'seller_unresponsive', 'failed_pickup', 'completed'
  )),
  seller_response_deadline_at TIMESTAMPTZ NOT NULL,
  pickup_deadline_at TIMESTAMPTZ NULL,
  seller_decision TEXT NULL CHECK (seller_decision IN ('approved', 'rejected')),
  seller_decided_at TIMESTAMPTZ NULL,
  seller_confirmed_at TIMESTAMPTZ NULL,
  winner_confirmed_at TIMESTAMPTZ NULL,
  outcome_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
