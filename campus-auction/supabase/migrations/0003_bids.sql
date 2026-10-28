CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  bidder_id UUID NOT NULL REFERENCES profiles(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  idempotency_key UUID NOT NULL,
  UNIQUE (auction_id, bidder_id, idempotency_key)
);

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount_paise DESC, placed_at ASC);
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
