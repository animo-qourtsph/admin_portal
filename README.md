# Animo Pickleball Cup 2026 — Registration Admin v26

## DUPR and payment proof viewer

Uploaded DUPR screenshots and payment proofs are now directly viewable from each registration record.

- Click/tap DUPR proof under Player 1 or Player 2.
- Click/tap Proof of payment under Payment.
- Images open directly in a new browser tab.
- PDF payment proofs open in the browser's PDF viewer.
- The Storage bucket stays private.
- `registration-api` returns only a 5-minute signed URL.
- DUPR proof viewing requires `eligibility.verify`.
- Payment proof viewing requires `payments.view`.
- Every proof view is logged in Supabase audit logs.
