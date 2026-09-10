# Admin Production Baseline v9 — Director Workflow + Mobile UX

Workflow:
- Under Review: Decline Registration / Approve Registration.
- Approved: Withdraw Registration.
- Declined or Withdrawn: Reopen Review.
- Confirm removed.
- Mark Pending removed.
- Generic status dropdown removed from Card/List views.
- Move to Trash moved under More.
- Decline and Withdraw require a reason.
- Approve stays disabled until player verification, same-level rule, division, payment proof and payment verification are complete.

Mobile:
- 14-item sidebar becomes a sticky section selector.
- Card View is compact and touch-friendly.
- List View becomes stacked mobile records instead of a crushed table.
- Registration record is a full-screen mobile review sheet with sticky header and action footer.
- Reports/filters/buttons reflow for smaller screens.

Requires API contract 2026.09.10.4 and workflow migration SQL.
