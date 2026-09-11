# Animo Admin Production 1.0.1 — Egress-safe live registration sync

Behavior:
- Initial sign-in loads the full active registration snapshot once.
- API returns a change cursor with that snapshot.
- While the Admin tab is visible, the browser performs a tiny delta check every 6 seconds.
- Only registrations changed since the previous cursor are returned.
- New registrations are inserted into the current Admin list automatically.
- Updated registrations replace only their matching browser record.
- Trashed/deleted registrations are removed from the active list automatically.
- Sync pauses while the browser tab is hidden or offline.
- Returning to the tab triggers an immediate catch-up.
- Configuration/editor pages are not rerendered by incoming registration changes, preventing unsaved input loss.
- Payment verification, player verification, status changes, payment resolution and restore now update only the affected record instead of re-downloading the whole registration list.

No payment proof or DUPR proof image is preloaded.
API contract remains 2026.09.11.1.
Database schema version remains 2026.09.11.1.
