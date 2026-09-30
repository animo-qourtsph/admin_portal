# Animo Admin Production 1.4.6 — Registration Reclassification

Adds a production-safe registration reclassification workflow to the existing Admin portal.

## New capability
Authorized organizers with `eligibility.reclassify` can open **Reclassify** from a registration record and update:
- DUPR rating for DUPR players
- Tournament level override for either player, including DUPR players
- Doubles category: Men's / Women's / Mixed / automatic from player genders
- Final division: automatic from level + category, or a direct manual division override

## Safeguards
- Reclassification requires a reason.
- Division capacity is checked before saving.
- Disabled divisions cannot be selected by the backend.
- All changes are written to Supabase and recorded in `audit_logs`.
- Player-facing registration-updated emails are triggered when a classification changes.
- Existing higher-level placement remains the automatic default.
- Existing Admin workflow, payment review, reports, trash, settings, and branding are preserved.

## Backend requirement
Deploy Registration API Production 1.7 (`production-1.7-admin-reclassification`) before using the new controls.
No SQL migration is required.
