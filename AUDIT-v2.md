# Admin Production Baseline v2 — Audit fixes

Verified in source/package:
- Player 1 and Player 2 Jersey Back Name included in Full Registration Detail report.
- CSV export labels explicitly identify both Jersey Back Name fields.
- Live Verify Payment button and Supabase API action integrated.
- Verify Payment disappears into a persistent Verified state after server refresh.
- All 14 Admin navigation sections restored.
- Save Changes and Backup file import controls restored for the existing configuration sections.
- Registration record modal redesigned to 1180px desktop workspace with:
  - summary strip,
  - side-by-side player cards,
  - dedicated payment review panel,
  - sticky action footer,
  - responsive tablet/mobile layout.
- Existing DUPR/no-DUPR verification, Deny, proof viewer, Trash, Reports, Payment Methods retained.
