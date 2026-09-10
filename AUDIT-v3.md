# Admin Production Baseline v3 — Registration Dual View

Added two views inside Registration Requests:

1. Card View
   - Existing registration card layout.
   - Preserved as the default view.

2. List View
   - Compact operational table.
   - Columns: Reference, Players, Division, Level/Verification, Payment, Status, Submitted, Action.
   - Reference and View button open the existing registration record modal.
   - Status dropdown remains available according to role permissions.
   - Horizontally scrollable on smaller screens instead of crushing columns.

The selected view is remembered only as a UI preference in localStorage.
No registration, payment, status, verification, or other operational data is stored there.

Re-audit correction:
- Fixed malformed Trash lazy-loading code found while modifying the Registration tab.

No API or Player changes are required. This package remains compatible with API contract 2026.09.10.2.
