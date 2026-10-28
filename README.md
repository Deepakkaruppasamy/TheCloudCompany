# 🏛️ Campus Auction — Peer-to-Peer Campus Marketplace

A secure, high-concurrency campus auction marketplace built for university students to buy, sell, and bid transparently. Engineered with strict PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), authoritative server-side deadline enforcement, anti-sniping extensions, private proxy bidding, dual-party in-person handover verification, and an intelligent AI marketplace assistant.

---

## 🌟 Releases & Capabilities

| Version | Release Name | Core Features Included |
|---|---|---|
| **v1.0.0** | **Core Marketplace** | Row-locked bidding, integer paise arithmetic, atomic closures, dual-party handover, reconciliation cron. |
| **v1.1.0** | **Buyer Trust & Alerts** | Public Q&A on listings with asker privacy protection, saved searches, automated fan-out match notifications. |
| **v1.2.0** | **Fair Auction Dynamics** | Anti-sniping automatic 60-second extensions for bids in the final 30 seconds (capped at 20 extensions). |
| **v2.0.0** | **Automatic Proxy Bidding** | Confidential ceiling bids (`auto_bids`) with private maximums, deterministic proxy resolution, and outbid alerts. |
| **v2.1.0** | **Campus AI Assistant** | Plain-English conversational search and human-confirmed assisted bidding proposals. |

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** Next.js 15 (App Router, Server Actions, React 18, Tailwind CSS, TypeScript).
- **Backend & Database:** Supabase (PostgreSQL 15, Row-Level Security, Supabase Auth, Storage Buckets).
- **Realtime & Alerts:** Supabase Realtime channel subscriptions (`postgres_changes`) coupled with native Browser Web Notifications.
- **Concurrency & Concurrency Control:** Row-level locks (`SELECT FOR UPDATE`), post-lock `clock_timestamp()` evaluation, idempotent UUID keys.
- **Testing Suite:** Vitest (58 unit tests, 24 database integration tests against real PostgreSQL), Playwright (E2E browser tests).

---

## 🛡️ Core System Invariants

1. **Atomic Bidding Concurrency:** Every manual bid, proxy bid, and auction closure acquires a row-lock (`SELECT * FROM auctions WHERE id = ... FOR UPDATE`) before reading `clock_timestamp()` to eliminate race conditions and double-spending.
2. **Deterministic Anti-Sniping (v1.2):** Valid bids arriving in the final 30 seconds (`closes_at - now <= 30s`) extend the closing time by 60 seconds (`closes_at = now + 60s`), capped at at most 20 extensions.
3. **Private Proxy Maximums (v2.0):** Maximum willingness-to-pay amounts are stored in a private `auto_bids` table guarded by PostgreSQL Row-Level Security (RLS). No bidder or public query can view another student's ceiling price.
4. **Exact Integer Paise Math:** All financial values are tracked as integer paise (`100 paise = ₹1.00`) across database columns, domain rules, and validation layers to prevent floating-point inaccuracies.
5. **Human-in-the-Loop AI Assistant (v2.1):** The assistant never acts autonomously or places bids without explicit student click-confirmation on a structured proposal card. It never exceeds user limits and never leaks account data.
6. **Dual-Party Physical Handover:** Completed transactions require explicit confirmation by both the seller and the winner before the scheduled pickup deadline.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js:** v20.x or v22.x
- **Package Manager:** npm or pnpm
- **Supabase Cloud Account:** PostgreSQL database with Supabase Auth & Storage

### 2. Environment Variables Configuration
Copy `.env.example` to `.env.local` inside the `campus-auction` directory:
```bash
cp .env.example .env.local
```

Fill in your configuration:
```env
# ── Supabase Credentials ──────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# ── Application Mode ───────────────────────────────────────────────────────
# "true" uses accelerated minutes for demo; "false" uses standard 24/48 hours
DEMO_MODE=true
SELLER_RESPONSE_MINUTES=3
PICKUP_MINUTES=5

# ── Reconciliation Secret ──────────────────────────────────────────────────
# 32+ character random secret for cron webhook authentication
RECONCILE_SECRET=c2VjdXJlLWNhbXB1cy1hdWN0aW9uLXJlY29uY2lsZS1zZWNyZXQtMjAyNg==

# ── Demo Seed Accounts (Optional) ──────────────────────────────────────────
DEMO_SELLER_1_EMAIL=seller1@demo.campus
DEMO_SELLER_1_PASSWORD=CampusSeller123!
DEMO_BIDDER_1_EMAIL=bidder1@demo.campus
DEMO_BIDDER_1_PASSWORD=CampusBidder123!
```

---

## 🗄️ Database Migrations

All migrations are located in `campus-auction/supabase/migrations/`:

| Migration File | Description |
|---|---|
| `0001_profiles.sql` | Profiles schema, student roles, verification status, updated_at triggers. |
| `0002_auctions.sql` | Auctions table, constraints, RPC `create_auction`, RPC `edit_auction`. |
| `0003_bids.sql` | Bids ledger, unique idempotency keys, foreign key relations. |
| `0004_transactions.sql` | Transaction state machine (escrow, response deadlines, pickup windows). |
| `0005_notifications.sql` | Notifications table, unique dedup indexes, type constraints. |
| `0006_rls_policies.sql` | Row-Level Security policies across all domain tables. |
| `0007_bid_function.sql` | `place_bid` RPC function with row locking and clock synchronization. |
| `0008_closure_function.sql` | `close_auction` RPC for atomic resolution of winners or unsold state. |
| `0009_seller_decision_functions.sql` | `approve_auction` and `reject_auction` RPC procedures. |
| `0010_handover_and_cancel_functions.sql` | `confirm_handover` and `cancel_auction` RPC procedures. |
| `0011_process_expired.sql` | Batch background reconciler for timed-out states. |
| `0012_notification_types.sql` | Extends notification type constraint for Phase-2 events. |
| `0013_auction_questions.sql` | `auction_questions` table, rate limits, seller Q&A, and public view. |
| `0014_saved_searches.sql` | `saved_searches` table, user limits (max 10 active alerts), RLS. |
| `0015_saved_search_matching.sql` | Auto-matching trigger on listing publication with 500 fan-out cap. |
| `0016_auction_extensions.sql` | Anti-sniping dynamic +60s extension trigger logic in `place_bid`. |
| `0017_auto_bids.sql` | `auto_bids` table with private maximums, `resolve_auto_bids`, `set_auto_bid`. |

> **Single-Click Database Setup:**
> You can run the entire migration sequence at once by pasting [`supabase/all_migrations.sql`](file:///c:/Hackathon/campus-auction/supabase/all_migrations.sql) into your Supabase Dashboard SQL Editor.

---

## 💻 Development & Test Commands

Run all commands from the `campus-auction/` folder:

```bash
# Install dependencies
npm install

# Start development server on http://localhost:3000
npm run dev

# Run TypeScript typecheck (0 errors required)
npm run typecheck

# Run Next.js and ESLint code standards (0 warnings required)
npm run lint

# Run Unit Test suite (58 tests)
npm run test:unit

# Run Real Database Integration Test suite against PostgreSQL (24 tests)
npm run test:db

# Compile production build
npm run build

# Provision demo accounts & active listings
npm run seed:demo

# Sync timeout configurations to database
npm run sync:config

# Trigger manual expiration reconciliation
npm run reconcile:manual
```

---

## 📱 Application Routes & Pages

| Route | Role | Description |
|---|---|---|
| `/` | Public | Live marketplace feed with quick category pills, search bar, and filters. |
| `/auctions/[id]` | Public / Authenticated | Listing detail page, photo gallery, live countdown, Q&A, bid form, and history. |
| `/auctions/new` | Verified Students | Listing creation form with image upload (up to 5 MB JPEG/PNG/WebP). |
| `/auctions/[id]/edit` | Seller | Edit listing title, category, description, and photo (only before any bids are placed). |
| `/saved-searches` | Buyer | Manage search alerts, keywords, max budgets, and toggle alert notifications. |
| `/assistant` | Student | Campus AI Assistant for natural language search and confirmed assisted bidding. |
| `/notifications` | Student | In-app notification center with real-time websocket updates and browser push support. |
| `/my-listings` | Seller | View active, pending approval, and completed listings with quick action controls. |
| `/dashboard/seller` | Seller | Seller approval hub to accept or reject winning bids. |
| `/dashboard/winner` | Buyer | Winning bidder hub to track seller responses and confirm in-person pickups. |
| `/profile` | Student | Student profile management, campus verification badge, and display name settings. |
| `/api/reconcile` | Cron Job / System | Protected webhook endpoint executing background expiry and deadline closures. |

---


---

## 🐳 Docker & Render Deployment

This repository includes a multi-stage production `Dockerfile` (using Next.js standalone mode on Alpine Linux) and an Infrastructure-as-Code Blueprint (`render.yaml`).

### Option 1: One-Click Render Blueprint Deployment
1. Connect your GitHub repository to [Render.com](https://render.com).
2. Go to **Blueprints** -> **New Blueprint Instance**.
3. Select this repository. Render automatically reads `render.yaml` and provisions:
   - Web Service with Docker runtime.
   - Default port `10000`.
   - Auto-generated `RECONCILE_SECRET`.
4. Fill in your Supabase variables when prompted:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Option 2: Manual Render Web Service Creation
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Set the following settings:
   - **Language / Runtime:** `Docker`
   - **Region:** Any (e.g. Oregon / Singapore / Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** Leave blank (or set to `campus-auction`)
   - **Dockerfile Path:** `./Dockerfile` (or `./campus-auction/Dockerfile` if root is `campus-auction`)
4. Add the following **Environment Variables**:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `DEMO_MODE`: `false`
   - `SELLER_RESPONSE_HOURS`: `24`
   - `PICKUP_HOURS`: `48`
   - `NEXT_PUBLIC_SUPABASE_URL`: `<your-supabase-project-url>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `<your-supabase-anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-service-role-key>`
   - `RECONCILE_SECRET`: `<your-32-char-random-secret>`
5. Click **Create Web Service**. Render builds and runs the container.

### Option 3: Local Docker Build & Run
```bash
# Build the production image
docker build -t campus-auction .

# Run container mapping port 10000
docker run -p 10000:10000 \
  --env-file campus-auction/.env.local \
  campus-auction
```
Access the application at `http://localhost:10000`.

## 🔒 Security & Privacy Guarantees

- **PostgreSQL Row-Level Security (RLS):** Every table is locked down. Students can only update their own listings, read their own notifications, and view their own private maximum proxy bids.
- **Anti-Sniping Guarantee:** Zero opportunity for bot-sniping at $0.1\text{s}$ before closing. Any bid inside 30 seconds triggers a 60-second extension visible to all spectators in real time.
- **Masked Identity in Q&A:** Public Q&A views expose only the asker's student display name. Private email addresses and phone numbers are never leaked.
- **Idempotent Bidding:** Every bid request transmits a unique UUID idempotency key preventing duplicate bids during network latency or multiple rapid button taps.
- **Constant-Time Reconcile Auth:** The `/api/reconcile` cron endpoint verifies credentials using `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

---

## 📄 License

Licensed under the MIT License. Developed for university campus student communities.
