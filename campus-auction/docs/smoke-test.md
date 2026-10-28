# Deployed Smoke Test Record

## Instructions

Run against the deployed demo environment with at least two test accounts.
Record each result as ✅ Pass / ❌ Fail / ⚠️ Partial.

---

## Smoke Test Results

**Date:** _________  
**Environment:** _________  
**Tester:** _________

### Authentication
- [ ] Sign in as seller account — redirects to browse
- [ ] Sign in as bidder account — redirects to browse
- [ ] Unauthenticated access to `/auctions/new` redirects to sign-in
- [ ] Unauthenticated access to `/notifications` redirects to sign-in

### Listings
- [ ] Seller can create a new listing with title, description, category, condition, price, increment, times
- [ ] Created listing appears in browse with correct price and status
- [ ] Seller can edit listing title/description before first bid
- [ ] Edit is denied after a bid is placed (DB enforced)

### Bidding
- [ ] Bidder can place a valid bid above the minimum
- [ ] Current price and bid history update correctly
- [ ] Seller cannot bid on their own listing (error message shown)
- [ ] Bid below minimum is rejected with clear error

### Photo Upload
- [ ] Upload a JPEG/PNG/WebP image (≤5 MB) — succeeds
- [ ] Photo is displayed via signed URL on auction detail page
- [ ] Upload attempt outside seller's folder is rejected

### Scheduler / Reconciliation
- [ ] `expiry_runs` table has at least one entry with `status = 'ok'`
- [ ] An auction that has passed its closing time is closed (status changed from active)
- [ ] Manual reconciliation via reconcile-manual.ts works as fallback

**Scheduler verification status:**  
☐ Verified via scheduled run in `expiry_runs`  
☐ Manual fallback used (document reason: _________)

### Authorization
- [ ] Buyer cannot see seller's email address
- [ ] Buyer cannot read other users' profile rows
- [ ] service-role key not visible in browser network tab responses
- [ ] `/api/reconcile` returns 401 without correct secret

### Demo Configuration
- [ ] Demo mode shows short deadlines (3 min seller response, 5 min pickup)
- [ ] Deadlines on test transactions match configured demo durations
- [ ] Demo and production projects use separate credentials (verified by env check)

---

## Known Issues / Notes

_Record any issues found here._

---

## Final Status

☐ All critical checks pass — ready for release  
☐ Non-critical failures noted above — release approved with documented limitations  
☐ Critical failures — release blocked
