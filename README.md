# Animo Pickleball Cup 2026 — Registration Admin v25 Fresh

## Fresh production admin
This build removes the old local preview registration cache and expects live registrations from Supabase.

## Trash / Recycle Bin
- Move to Trash is a real server-side soft delete.
- Trashed registrations disappear from active Registration Requests.
- Trashed registrations no longer appear in player lookup.
- Trashed registrations no longer consume division capacity or block duplicate re-registration.
- Trash page shows reference, team, division, deleted time, and organizer.
- Restore returns the registration to the active list.
- Delete Permanently is Director-only and requires typing `DELETE <REFERENCE>`.
- Permanent deletion also removes private DUPR/payment files and registration child records.
- Trash / Restore / Permanent Delete are written to Supabase audit logs.

## Fresh database
Run `animo-clear-all-registration-test-data-v1.sql` once if you want the live Supabase registration database to start at zero teams.
