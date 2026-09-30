# Animo Admin Production 1.4.7 — Division Integrity

Prevents live tournament divisions from being accidentally repurposed into another level/category while keeping their old stable code.

## Changes
- Existing live division level + category identities are locked in the Admin Division editor.
- Existing divisions should be enabled/disabled instead of converted into another category.
- `+ Add Division` creates a new level/category combination with a generated stable code.
- Duplicate level/category combinations are blocked before publishing.
- Stable-code/category mismatches are blocked before publishing.
- Existing live divisions cannot be removed from the editor; disable them instead.
- Fallback Advanced configuration reflects the current structure: Men's enabled, Mixed disabled, Women's enabled.
- Asset query version bumped to 1.4.7 to reduce stale GitHub Pages/browser cache.

## Backend hardening
Registration API Production 1.9 adds the same stable-code integrity validation server-side and recognizes both `advanced-women` and `advanced-womens` as Advanced Women's.

No SQL migration is required.
