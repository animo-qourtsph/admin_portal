# Animo Pickleball Cup 2026 — Registration Admin v24

## v24 — Live Supabase registration status control

This release fixes the disconnect between the Admin portal and the Player registration tracker.

### Live behavior
- Registration Requests load from Supabase after organizer login.
- Admin status changes are sent to the authenticated `registration-api`.
- The Edge Function validates the organizer's role permission server-side.
- The registration status is updated in Supabase.
- The Player tracker reads the same Supabase record, so Approved/Confirmed/etc. stay synchronized.
- Approved / Confirmed / Rejected / Cancelled and other configured status triggers can send real Gmail SMTP notifications to both players.
- Status history and audit logs are written in Supabase.

### Security
The browser never receives the Gmail App Password or a Supabase secret/service key. Organizer mutations require a valid Supabase Auth user session and the relevant Animo permission.
