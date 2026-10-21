# Local sales-report Import — 03/09/26

## Scope

User-approved local files only. No deployment, Drive upload, browser database, central storage or shared-user claims. The original reports and read-only project sources are not edited. The HTML contains the existing source snapshots, and imports are session data restored from a user-held JSON backup.

Import is available from the global Import button, the bottom of both pages, and Capricci Master Data → Report Data → Import รายงานยอดขาย.

1. Explicitly choose restaurant, branch, business date. Business Date supports DD/MM/YY entry and a single-day calendar with month/year navigation, Apply/Cancel and no data-availability restriction.
2. Choose File: select A103/S102/S104/S114/S117, exactly one of each for one day. This version commits a complete five-report bundle, not partial updates. Verify remains clickable for an incorrect file count so the user sees a warning rather than an inert button.
3. Verify actual file contents, structure, identity/date, numbers and totals. Filename only proposes a type; conflicting filename/content fails.
4. Review source counts/totals and all warnings. A103/S117 preview shows net/Total Sale, other previews show report totals; never add these overlapping amounts together.
5. Download the candidate Backup. The browser cannot prove a download reached disk, so the UI explicitly asks the user to confirm the file exists.
6. Confirm destination/warnings/backup and Import. Until this final action, active reports and Master are unchanged. Same restaurant/branch/date replaces the bundle, not appends revenue. Existing days of other restaurants remain unchanged.

Existing data always remain in the delivered HTML. Refresh restores these defaults; open Backup again to restore the imported days and active Master. Current session data are never silently persisted in localStorage/IndexedDB. Download a new backup after applying Master edits.

## Formats and limits

- A103/S114/S117: text-based Easy Restaurant PDF matching the English/Thai layouts supplied for the three restaurants. PDF extraction preserves wrapped codes, descriptions, tax/net amounts, void invoices and category/transaction sections. Scanned, encrypted, unreadable or changed layouts fail; no OCR or guessed zero data.
- S102/S104: UTF-8 CSV, Excel `.xlsx`, or binary BIFF Excel `.xls` with the same Easy Restaurant column names. Exactly one matching report table in a workbook. Finance/Category workbooks as replacements for sales reports, renamed HTML/CSV masquerading as `.xls`, and arbitrary PDF exports of CSV reports are not supported. XLS formulas/error cells in a report table are blocked; no formulas, macros or external links are executed.
- XLS uses pinned `@e965/xlsx@0.20.3` from the permitted npm registry (a third-party SheetJS republisher), not an external runtime CDN. The lockfile pins its integrity. Direct URL installation was disallowed; no npm policy was disabled. References: [package publisher](https://www.npmjs.com/package/@e965/xlsx), [SheetJS parsing options](https://docs.sheetjs.com/docs/api/parse-options/). Binary fixtures exercise Thai text, source numbers and Excel 1900/1904 date systems. `.xls` is included in the same raw-file Backup/Restore validation as other formats.
- XLS also limits declared table extent to 100,031 rows including header/preamble, 128 columns, 50 sheets and 2 million cells; truncated or ambiguous tables fail instead of importing partial amounts.
- Maximum 12 MB/file, 35 MB/import bundle, 100 PDF pages, 300,000 PDF text items, 100,000 table rows, 80 MB/backup. XLSX ZIP checks limit declared expanded size to 50 MB and 3,000 entries. These are local-prototype resource guards, not a substitute for production upload isolation.
- Dates come from PDF periods and S104 SaleDate, including Thai Buddhist Era conversion, not report filenames. PDF pages must consistently name the selected restaurant and date. S102 may not contain a date or restaurant; explicit confirmation is required alongside the matching PDF bundle.
- A blank PDF Branch remains blank in report detail and triggers a warning. Its destination branch is a user assignment, never inferred from a purchaser's tax branch. Current runtime supports one destination branch per restaurant; use separate backup sets for separate branches until a branch selector is implemented.
- CSV repair is narrowly limited to two adjacent ItemDesc/EngItemDesc cells with an exact duplicated suffix and equal comma-fragment counts, the malformed LAWOI pattern. Other malformed rows fail. The original bytes remain in Backup and a warning identifies repaired rows.

## Verification and calculations

- A103 invoice values/tax/rounding/net sum and printed grand totals; VOID rows retained with zero amounts.
- S114 detail and category sums match printed Qty/Price/Discount/Tax/Net totals.
- S117 gross minus discount plus service/tax matches Total Sale; category/payment detail sums and Guests/Bills/Total per Person checked.
- Cross-report reconciliation compares A103 net and payment to S117 Total Sale; S102/S104/S114 to S117 Total including Entertain. Differences over 0.02 baht block. Nonzero differences up to 0.02 remain explicit warnings and are never corrected automatically.
- Capricci: normal-customer Sales S104 ExtendedPrice is post-discount. S114 Sales price minus discount is matched by ItemCode against eligible S104. Add the corresponding S114 discount back once to reconstruct pre-discount sales. This is an item-level aggregation, **not an invented bill-level discount allocation**. If the normal-customer subset cannot be reconciled by ItemCode, Import fails rather than guessing the adjustment. The existing seeded day still uses the verified Finance Excel adjustments.
- Imported Capricci ItemCodes merge into active Master; existing names/classifications are retained. Unknown codes receive “ยังไม่จัดหมวด”, with their full gross amount shown explicitly on Dashboard. No automatic Food/Other assignment and no disappearing revenue. Service Charge stays excluded.
- Master maps ItemCode → editable Sub Type → Output; Type and source Category remain separate reference metadata. Changes reclassify all loaded dates, not raw reports or total revenue. Pending Master edits block Import until applied to the session.
- KAPPO/LAWOI still use S117 Food+Beverage+Other. Capricci Master does not classify the other restaurants.
- Period combines loaded daily bundles once. Sales (Daily) uses the selected range; Guest · Daily uses the endpoint day. Absent days remain NO DATA. Report Center and all five report details now live in Sale, with their existing day selector, tabs, search and tables. Sidebar Reports opens Sale at the Report Center. Master Data retains reconciliation.
- Unsupported A/S report codes, misleading names, unsupported extensions, wrong counts/sizes, duplicate types, bad structure or mismatched dates/totals block Verify and keep the current dataset unchanged. The UI clears stale verification/backup consent on file or destination changes and shows Import Blocked. Only a fully verified five-report set can be confirmed.

## Backup contract

`format: finance-revenue-local-backup`, `version: 1`, baseline source identity, export timestamp, active Capricci Master, and complete imported batches. Each batch contains destination metadata, timestamp, original file bytes as base64, filename and SHA-256. Parsed reports are **not trusted serialized inputs**: reopening reparses every original and repeats validation and reconciliation, checks SHA-256, then previews before replacing session data. Baseline mismatch is rejected rather than mixing a backup with a different HTML dataset. Keep the compatible HTML alongside the backup.

SHA-256 detects corruption; it does not authenticate who created a report or prevent a knowledgeable person from constructing new reports. No permissions/audit/concurrency guarantees exist yet. Backups contain business data, customer entities and tax identifiers; keep them private. Never publish the current data-embedded HTML or backup files in a public repository or website.

## Validation

- `node --test tests/master-data.test.mjs tests/report-data.test.mjs tests/sales-import.test.mjs`
- `node tests/import-reference-check.mjs "<local source report directory>"` checks all 15 user-supplied files against existing extracted references, including S114 row category, transaction and ItemCode.
- `node tests/import-backup-check.mjs "<local source report directory>"` checks the same bundled reader used by offline HTML, actual PDF/CSV import, full Backup restore, checksum corruption, wrong brand/date, retired report, fake PDF/Excel, and an in-memory XLSX fixture.
- `node --test tests/legacy-excel.test.mjs` checks real in-memory BIFF8 bytes, invalid and ambiguous workbooks, date systems and Verify preflight warnings. Set `REVENUE_TEST_REPORT_FOLDER` to the Capricci PDF folder to also test a complete XLS + PDF import and Backup/Restore, including duplicate-report rejection.
- TypeScript, production build and a local HTTP render check. No browser click/screenshot test was requested; none is claimed.

## Before production / Final

Retain the user's GitHub + protected Google Drive plan; this change does not implement it. The existing server/framework dependency audit on 03/09/26 found 5 high and 1 low advisory in the production dependency tree (vinext/Vite/react-server-dom-webpack and transitive image-size/undici/esbuild), not in the newly added PDF/Excel readers. Framework migration was not bundled into this local Import change. Upgrade and re-test the server stack before deployment, separate sensitive data from static assets, then design authentication, private storage, revision/conflict control and atomic persistence.

Reader documentation: [PDF.js](https://mozilla.github.io/pdf.js/getting_started/), [read-excel-file](https://github.com/catamphetamine/read-excel-file). Readers are bundled locally; no CDN request or report upload is made.
