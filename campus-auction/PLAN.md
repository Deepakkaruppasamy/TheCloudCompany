# Campus Auction — Implementation Plan

The full implementation plan is documented in the design specification.

## Implementation Status

| Milestone | Scope | Status | Notes |
|---|---|---|---|
| **M1 Bootstrap** | Next.js App Router, Tailwind, TypeScript, CI workflow | ✅ Complete | Scaffolded, lint, typecheck, clean client setup |
| **M2 Schema & Auth** | Migrations 0001-0006, Auth pages, session refresh | ✅ Complete | Profiles, auctions, bids, txns, notifs, RLS, column grants |
| **M3 Listings** | Create, edit, photo upload, browse filters, detail view | ✅ Complete | Server-enforced no-bid edit locks, signed photo URLs |
| **M4 Atomic Bidding** | `place_bid` function (0007), bid form, idempotency | ✅ Complete | PostgreSQL row lock, clock reading after lock, replay safe |
| **M5 Closure & Expiry** | `close_auction` (0008), `process_expired` (0011), `/api/reconcile` | ✅ Complete | Unsold/winner transitions, rate limiter, timing-safe secrets |
| **M6 Decisions & Handover** | `approve/reject` (0009), `confirm_handover`, `cancel_auction` (0010) | ✅ Complete | Both parties confirm handover, zero-bid cancellation |
| **M7 Notifications & UX** | In-app notifications inbox, unread counts, status badges | ✅ Complete | Real-time countdowns, responsive UI |
| **M8 Security & Tests** | Unit tests, PostgreSQL DB tests, RLS verification | ✅ Complete | vitest suite for money, auctions, and auth |
| **M9 Demo & Docs** | `seed-demo.ts`, `sync-config.ts`, `reconcile-manual.ts`, README | ✅ Complete | Complete instructions and scripts |

## Invariants Checklist
- [x] Bid acceptance is atomic and enforced by PostgreSQL.
- [x] Every bid and closure function locks the auction row first and reads `clock_timestamp()` only after acquiring the lock.
- [x] A new bid is rejected at or after `closes_at`, including when the scheduled processor is late.
- [x] Closure locks the same auction row, considers only bids with `placed_at < closes_at`, selects at most one winner, and creates the transaction in the same database transaction.
- [x] Authorization is enforced by PostgreSQL privileges, RLS, and function checks. Clients cannot insert accepted bids, change winners, or alter transaction or auction state directly.
- [x] At most one transaction exists per auction.
- [x] Money uses integer paise, never floating-point values.
- [x] Stored absolute deadlines do not change when environment variables change.
- [x] Scheduled expiry processing is idempotent. Lazy enforcement on every user action keeps correctness if scheduling is delayed.
