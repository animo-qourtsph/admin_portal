# Animo Registration Admin — Production 1.0

API contract: 2026.09.11.1
Required schema version: 2026.09.11.1

Operational data and publishable configuration are server-authoritative.
Activity is paginated at 50 records per request.
Proof files are fetched only when explicitly opened.
Registration data is not automatically polled.
Configuration backup does not overwrite participant registrations.

Access & Roles:
The policy blueprint is centrally saved, but actual organizer authentication and
enforced permissions remain controlled by Supabase Auth and get_my_admin_access().
