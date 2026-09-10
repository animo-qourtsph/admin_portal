# Admin Production Baseline v5 — List Record Fix

Changes:
- Player 1 and Player 2 use identical typography in Registration List View.
- Both player names are clickable and open the registration.
- The entire list row can open the registration, except when interacting with controls such as Status.
- Keyboard Enter/Space can open a focused row.
- Record lookup normalizes reference values before matching.
- Record modal rendering is wrapped with explicit error handling instead of failing silently.
- All modal actions use the canonical reference stored on the live record.
- Existing View button remains available.
- Search, Card/List views, Verify Payment, level verification, Deny, Trash, Reports, and all 14 navigation items are retained.

No API or Player change is required.
Compatible with API contract 2026.09.10.2.
