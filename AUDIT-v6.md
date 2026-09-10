# Admin Production Baseline v6 — Registration Record Modal Fix

Root cause from browser console:
`ReferenceError: paymentLabel is not defined`

Affected paths:
- registration record modal
- registration search text
- payment-method report labels
- full registration detail report

Fix:
- added a shared `paymentLabel()` helper;
- it first resolves the label from live Supabase Payment Methods;
- it falls back to configured payment methods;
- if no label is found, it safely displays the stored payment key.

No API or Player change is required.
Compatible with API contract 2026.09.10.2.
