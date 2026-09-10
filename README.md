# Animo Pickleball Cup 2026 — Admin v27 Live-Only

This release removes the dangerous registration-data fallback to browser localStorage.

## Why
Earlier Admin builds could display a cached registration if the live `admin-list`
request failed. That could make a deleted/nonexistent team appear in Admin even
though it was no longer present in Supabase.

## v27 behavior
- Registration Requests are Supabase-only.
- All legacy `animo-registration-records-*` localStorage caches are deleted on startup.
- If Supabase cannot load registrations, the Admin shows a blocking connection error.
- No stale team can be approved, trashed, restored, exported, or viewed as if live.
- Status changes re-fetch Supabase immediately after the server mutation.
- Success messages distinguish email sent / failed / suppressed / no trigger.
- Existing secure proof viewer, Trash, Gmail notifications, Auth, roles and reports remain.

A registration shown in Admin is now required to exist in the live Supabase database.
