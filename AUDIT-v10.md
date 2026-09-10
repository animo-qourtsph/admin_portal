# Admin Production Baseline v10 — Reports & Insights Fix

Root cause:
The workflow update renamed the report KPI from `confirmed` to `approved`, but
`reportInsights()` still referenced `kpis.confirmed`. Clicking Reports & Insights
therefore threw a runtime TypeError and made the navigation button appear dead.

Fix:
- Replaced Confirmation Progress with Approval Progress.
- Uses `kpis.approved` consistently.
- Added a visible Reports error boundary and Retry Reports button.
- Retains all v9 workflow/mobile changes, Excel/CSV export, shirt size,
  Card/List views, search, payment verification, and level verification.

No SQL, API, or Player change required.
API contract remains 2026.09.10.4.
