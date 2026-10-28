# Design Decisions

## Architecture

### D-001: PostgreSQL as the source of truth
All authoritative business logic (bid validation, closure, deadlines) is enforced in PostgreSQL functions. The application layer validates and normalizes input, but never replaces database authorization.

### D-002: Paise (integer) for all monetary values
All amounts are stored as BIGINT paise (1/100 of a rupee). No floating-point money arithmetic. Conversion happens only at the UI boundary.

### D-003: No proxy bidding
Bidding is explicit only. There is no maximum-bid or automatic outbid system. This simplifies correctness analysis.

### D-004: One photo per listing in MVP
One photo, private bucket, JPEG/PNG/WebP only, 5 MB limit. Multiple photos are a future enhancement.

### D-005: Idempotency keys generated at render time
The bid form generates a UUID once per render (`useMemo`). All retries of the same submission reuse the same key. A new render generates a new key. This prevents duplicate bids on network retry.

### D-006: Durable rate limiting via Postgres
The reconcile endpoint uses a fixed-window counter in Postgres, not in-memory. This is correct across serverless instances.

### D-007: Demo and production separation
Demo and production use entirely separate Supabase projects, environment variables, and secrets. Demo credentials are never in the production project.

### D-008: Committed migrations are immutable
Corrections use a new, higher-numbered migration. Migrations are never edited after they are committed.

## Scheduling

### D-009: pg_cron preferred; Vercel cron as fallback
The scheduler preference is pg_cron every minute. If unavailable, the Vercel cron calls `/api/reconcile`. Manual reconciliation is a documented fallback.

### D-010: process_expired is idempotent
Every transition rechecks its condition after locking. Running the function twice on the same data is safe.

## Security

### D-011: service-role key server-only
The service-role key is only in `src/lib/server/admin.ts`, which imports `server-only`. It is never in client bundles.

### D-012: Public views with security_barrier
`public_profiles` and `bid_history` use `security_barrier` to prevent information leakage through function inlining.

### D-013: No email in bid history or public profiles
`bid_history` exposes only display_name, amount_paise, and placed_at. No bidder email, ID, role, or account status.
