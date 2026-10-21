# Monthly sales and User Guide

Updated 03/09/26. Local-only; no deployment, source-report edits or backup schema changes.

## Date scopes

- `dashboardForMonth` derives a full calendar month from the selected period's end date, then uses the existing gross-sales aggregation with the runtime report dataset and current Capricci Master.
- Sale (Monthly), its categories and discount share this scope. All available reports in that month count, even outside the selected custom range. Cross-month selections use only the endpoint month. Missing days are not filled with zero; a month with no reports shows NO DATA.
- Sales (Daily) now displays the existing selected-range aggregate: `selection.data.monthlySales`, `monthlyCategories` and `monthlyDiscount`. A single date gives that day's sales; multiple dates sum all available reports in the inclusive range, including across months. With no reports anywhere in the range it shows NO DATA. The underlying data model and endpoint-day fields remain unchanged for Guest/Entertain Daily.
- The daily/monthly trend charts, Report Detail and Entertain · Period retain their selected-range scope and are labelled accordingly. Guest · Daily remains S117-based.
- Import updates the in-memory batch list, invalidating the Monthly calculation immediately. reportDataset replaces seeded/imported same-brand/day records; a repeated import never adds the day twice. A corrected report may increase or decrease revenue. Other months and restaurants remain separate.

## Sales-card guest metrics

- Both sales cards display Guests followed by Total / Person immediately after Beverage - Alcohol. Restaurants without this category keep their own categories and show these metrics after the last category. The existing lower Guest cards remain.
- Guests and Total / Person use the existing small color-marker row format without a separate shaded/bordered group. The unmapped category keeps a name-bound purple marker and pie segment plus darker purple label/amount, regardless of row insertion or order. No records are reclassified or recreated by this presentation change; restoring imported data after reload still requires the user's Backup.
- `salesGuestsForPeriod` uses S117 only, deduplicating restaurant/business-date records with the latest record winning. Monthly uses the full endpoint calendar month; Sales (Daily) uses the inclusive selected Period. Import/Restore and brand/date changes recalculate both values.
- Guests sums recorded guest counts. One available report preserves its printed Total / Person. Multiple reports use the sum of original S117 Total Sale divided by total guests, rounded to two decimals; daily ratios are neither added nor averaged equally. This is the S117 after-discount, service/tax-inclusive basis, not the card's Gross sales. Missing required values yield NO DATA, as does a ratio with zero guests; missing days are not fabricated.
- The new rows are presentation-only operational metrics, outside the category array, pie input and revenue totals. Source reports, category mappings, existing lower Guest formulas and backup schemas are unchanged.

## Guide navigation

- The existing single-file-compatible page state supports Dashboard, Sale, Master Data and User Guide through the left sidebar. Duplicate header page buttons were removed; restaurant/date/Import/Refresh controls remain. The guide's three accessible brand tabs follow the shared selected brand.
- Page state survives refresh through the existing URL fragment, with ISO dates preserved. Master Data now shows report reconciliation for every brand; its ItemCode/category editor remains Capricci-only. Sale shows S117 operations, payment and item-group details. Switching pages/tabs preserves in-memory imports and the Master draft; refreshing still requires backup/restore.
- The Capricci finance/master calculation component is rendered only in the Capricci guide tab, with the Monthly finance summary and current Master. The detailed rows now include DD/MM/YY source dates. Other brands get their own S117 instructions, not Capricci mappings.
- Guide content covers the actual five-report Import/Verify/Save Backup/Confirm workflow, DD/MM/YY input, same-day replacement, NO DATA and local backup limitations.
- The live Monthly/range coverage explanation was moved from Dashboard to User Guide, with current brand, month, selected range and counts. It explains the updated Sales (Daily) range scope and Capricci's existing unmapped S104 → ItemCode → subgroup → Output handling; no mappings are changed automatically.
- Entertain is now a full-width card above the guest row, with its title shortened to Entertain. Guest Check-In (Monthly) is on the left of Guest · Daily at desktop widths. Both guest formulas are unchanged.

## Validation

Tests cover all three brands, several imported days, same-day replacement including a corrected amount, reconstructed restored batches, month/year/leap boundaries, empty daily/monthly scopes, Master reclassification, matching Monthly/guide totals, page-fragment round trips and exactly three functional guide tabs. Existing date/input/import/master/report tests are retained. No browser interaction or visual QA was requested.
