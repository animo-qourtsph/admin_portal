# Animo Registration Admin — Production 1.4.2

## Interactive Report Drill-down

This release adds interactive report investigation across Executive Summary, Detailed Report, and chart-based dashboard views.

### New behavior
- KPI tiles can be clicked to inspect the registrations behind the number.
- Bar and horizontal-bar elements open the matching breakdown.
- Doughnut / pie segments and legends open the matching breakdown.
- Line/scatter points can be opened for date/player detail where applicable.
- Financial drill-downs reconcile each row back to the selected chart value.
- Each registration row includes **View Registration** so the Director can move directly from report insight to operational action.
- **Uncollected / no amount submitted** is now shown in red.
- Breakdown tables can be exported to CSV.

### Backend compatibility
No API or SQL changes are required beyond the already-deployed registration system schema `2026.09.14.1` and Registration API Production 1.3.
