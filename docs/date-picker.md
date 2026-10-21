# Date picker and date display

Updated 03/09/26. Local-only UI change; no data migration, deployment or shared storage.

- Header popover follows the supplied reference: two adjacent Thai calendars (Gregorian years), start/end text fields, right-hand presets, blue selected range and green Apply.
- A calendar click starts a fresh one-day draft. A second click extends it in either direction. Apply commits; Cancel, Escape and outside dismissal discard. Reopening uses the active period. Previous/next period arrows remain outside the popover.
- Today/yesterday/last 7/last 30/full current month/full previous month use Asia/Bangkok today. Last 7/30 include today. Calendar navigation never depends on report availability.
- Display/input dates: DD/MM/YY. Monthly-only chart labels: MM/YY. Calendar captions retain the full Gregorian year for century selection. Timestamp history uses Bangkok DD/MM/YY HH:mm:ss.
- DateInput validates real civil dates before emitting ISO; incomplete/invalid text emits an empty value immediately, blocking Apply/Import verification. Invalid text stays editable. Four-digit pasted years are accepted and normalized on blur. Two-digit years follow the current field century, defaulting to 2000–2099. Supported bounds remain 1900–2100.
- SaleDate from named-month CSV, Buddhist Era strings, slash dates and Excel ISO text is formatted only for display. Source civil times do not receive an extra timezone shift. Unknown/invalid source strings remain visible verbatim for review.
- ISO business dates remain unchanged in canonical data, URLs, report snapshots and backup contracts. Source filenames remain verbatim. No changes to revenue or category calculation rules.

Validation: report/master/import regression tests, pure date boundary/preset tests, component event unit tests (draft/apply/cancel, reversed clicks, NO DATA, invalid typing and external date updates), type check and production build. No browser visual QA requested or performed.
