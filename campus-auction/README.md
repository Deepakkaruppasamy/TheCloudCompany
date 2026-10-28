# Campus Auction

A secure, deployable campus marketplace for students to list and bid on items with atomic bidding, authoritative server-side PostgreSQL deadline enforcement, and dual-party handover confirmation.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL 15, Supabase Auth, Storage)
- **Database Functions & Concurrency:** PostgreSQL row-level locks (`SELECT FOR UPDATE`), RLS policies, column grants, `SECURITY DEFINER` procedures
- **Testing:** Vitest (Unit & DB integration tests), Playwright (E2E browser tests)

---

## Key Invariants

1. **Atomic Bidding:** `place_bid` serializes concurrent bids by row-locking the auction (`SELECT ... FOR UPDATE`) and reading `clock_timestamp()` only after acquiring the lock.
2. **Strict Deadlines:** Bids placed at or after `closes_at` are rejected immediately, even if background expiration is delayed.
3. **Paise Accuracy:** All currency is tracked as positive integer paise (1 INR = 100 paise) to eliminate floating-point drift.
4. **Idempotent Operations:** Idempotency keys generated per bid form render prevent double-bidding during network retries.
5. **Dual-Party Handover:** Completed status requires explicit confirmation by both the seller and the winner before the pickup deadline.

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- npm or pnpm
- Supabase CLI (for local development)

### 2. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env.local
```
Fill in your Supabase connection strings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RECONCILE_SECRET` (at least 32 random bytes)

Choose mode:
- **Demo Mode (`DEMO_MODE=true`):** Uses fast demo durations (`SELLER_RESPONSE_MINUTES=3`, `PICKUP_MINUTES=5`).
- **Production Mode (`DEMO_MODE=false`):** Uses standard durations (`SELLER_RESPONSE_HOURS=24`, `PICKUP_HOURS=48`).

### 3. Database Migrations & Config Sync
Apply migrations with the Supabase CLI:
```bash
supabase db reset
```
Sync deadline configuration to the database's `system_config` table:
```bash
npm run sync:config
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Demo Accounts & Seeding

To populate demo listings and accounts:
```bash
npm run seed:demo
```
This provisions:
- **Alex Seller** (`seller1@demo.campus`)
- **Sam Seller** (`seller2@demo.campus`)
- **Jordan Bidder** (`bidder1@demo.campus`)
- **Riley Bidder** (`bidder2@demo.campus`)

---

## Testing

Run unit tests (pure money conversions, auction lifecycle, environment validation):
```bash
npm run test:unit
```

Run database integration tests against local PostgreSQL:
```bash
npm run test:db
```

Typecheck:
```bash
npm run typecheck
```

---

## Scheduler & Reconcile Route

- Expiration of active auctions, overdue seller responses, and missed pickups are processed via `process_expired`.
- Background scheduler triggers `POST /api/reconcile` with `Authorization: Bearer <RECONCILE_SECRET>` protected by constant-time comparison and durable rate limiting.
- Operators can trigger manual reconciliation:
```bash
npm run reconcile:manual
```

---

## License
MIT
