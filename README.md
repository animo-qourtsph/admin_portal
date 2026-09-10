# Animo Pickleball Cup 2026 — Registration Admin v23

## v23 — Global Activity Log

The Admin portal now includes a dedicated **Activity Log** for organizer accountability and operational oversight.

### Logged activity
- Organizer sign in / sign out
- Registration status changes
- DUPR verification
- DUPR proof replacement requests
- Player level / classification changes
- Doubles category assignment
- Registration moved to Trash
- Tournament configuration saves
- Registration CSV downloads
- Backup downloads and restores
- Email notification configuration changes

The page also merges:
- Access & Roles history
- Automatic Email Activity events

### Activity interface
- Total activity KPI
- Today's activity
- Registration / eligibility count
- Access / authentication count
- Email-workflow count
- Search
- Category filter
- Organizer/source filter
- Date-range filter
- Download Activity Log CSV

### Current Supabase status
Supabase Auth remains live and determines the signed-in organizer identity.

Registration mutations are still using the local interface-preview records, so the general activity log is currently browser-backed. The Supabase foundation already includes `public.audit_logs`; after registration actions are moved to Supabase, this interface should read permanent server-side audit entries instead.

### Visibility
Activity Log is currently Director-only through the existing real `access.manage` authority.
