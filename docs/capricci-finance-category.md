# Capricci Finance category basis — 01/09/26

Scope: only Capricci sales cards, category charts, daily/month charts, and a calculation detail panel. KAPPO / LAWOI, Guest panels, report templates, raw POS snapshots, reconciliation, and Import behavior remain unchanged. The original XLSX is read-only. Historical monthly summaries and zero-filled future template rows are not imported as daily transactions.

## Source and reproducibility

- Reference: `Capricci_Daily_Sales_Report_20260901-for Codex.xlsx`
- SHA-256: `bbd6f27742b69f2c90b84bbddcab2f5bccd87b6d12c1b93a91358adb48cb750a`
- `scripts/extract-capricci-finance.py <reference.xlsx>` extracts typed inputs, source row numbers, formulas, and cached verification values into `app/data/capricci-finance-20260901.json`. Requires Python with openpyxl for read-only extraction; never saves the workbook.
- `calculateFinanceCategories` computes the displayed result from those inputs, not from hardcoded dashboard totals or cached formulas. Changing the source XLSX does not automatically update the HTML; extract, verify, and rebuild it.

## Calculation and mapping

1. Use only dated transaction rows `S104!A2:U134` for 01/09/26 (133 rows). Ignore formatted/formula-only rows beyond the transactions.
2. Match `CustomerName` (D) to `ลูกค้าทั่วไป เงินสด`, exactly the group used by Finance SUMIFS. This is a customer-group label, **not a filter on the payment method**.
3. Exclude `SERVICECHARGE` rows separately. Entertain rows are excluded by the customer filter, including their service charge.
4. Amount per row: `Q = L (ExtendedPrice) + P (Column1)`. P contains adjustment amounts in the reference that restore discounts for this day. Do not multiply again by Qty or add VAT. Normal-customer merchandise: 91,666 + 3,624 = 95,290 baht; service charge excluded: 9,088.60 baht; excluded-customer total including its service charge: 1,815 baht.
5. `S104!H` ItemCode → first match in `Category!F` → subgroup in K → subgroup/index table `Category!O4:Q21` → final category Q. Wine is combined into Beverage - Alcohol, not shown as a fifth category.
6. Lookup keys ignore case and normalize surrounding/repeated whitespace (the reference has inconsistent spaces). Preserve source text and row numbers for audit. Do not infer category from the item name, POS CategoryName or code prefix. An unknown merchandise code is flagged as Unmapped, never silently included in Other.
7. Period sums only the available date if included. The Daily block uses only the period's final day; absent dates remain NO DATA. Neither overlapping report types nor source workbooks are added together as revenue.

## Verified outputs

| Category | 01/09/26 baht | Reference cells |
| --- | ---: | --- |
| Food | 71,660.00 | DashBord!E3 / J3 |
| Beverage - Non-Alcohol | 5,380.00 | DashBord!E4 / J4 |
| Beverage - Alcohol | 18,250.00 | DashBord!E5 / J5 |
| Other | 0.00 | DashBord!E6 / J6 |
| Total | 95,290.00 | DashBord!B3 / G3; Sale Capricci !Z12 / Z43 |

117 included merchandise rows, 11 normal-customer service-charge rows, 5 Entertain rows. All included rows mapped; computed row totals and final categories match the reference's cached Q / U values. S104 monetary inputs match all 133 original CSV transactions (SaleId type normalized for comparison only).

The category presentation intentionally differs from raw S117 (Food 71,260 / Beverage 24,030). Raw S117 and the original reconciliation differences of 0.01 baht remain visible. Discount on the existing card remains S117 3,624; it is not deducted a second time from gross sales.

## Source issues retained, not silently corrected

- Category has 877 item mapping rows and repeated codes. VLOOKUP's first row wins.
- Three codes have conflicting subgroup assignments: WIN-SNC0006 (rows 172 / 757), WIN-SNC0008 (174 / 857), FOD-SPC0033 (550 / 551). None appears in this day's transactions. The UI discloses the issue; future use should review these mappings with Finance.
- Service Charge has #N/A in source main-group lookups because it is not a sales category. It is explicitly excluded rather than treated as an unknown merchandise category.
- `Category!P4` is an external link with cached value Food; `Category!Q4` independently labels Food. No external linked workbook is opened or refreshed.
- `DashBord!J2` is TODAY()-1; its saved value is 01/09/26. This dashboard uses transaction Business date, not the current machine date, to keep the snapshot stable.
- The workbook renderer could not recalculate some full-column/external/trailing-space sheet references; its preview showed renderer-only errors. Source formulas/cached values were read independently, and all displayed sales totals were recomputed from transactions. The Excel file was not altered.
- The workbook also contains Guest/S107 and historical monthly summaries; these remain read-only references and are not used in Dashboard calculations. As of 03/09/26, S107 is retired from the application, Guest Check-in Period is removed, and Guest Daily uses S117. Entertain is shown separately from gross sales; see `dashboard-s117.md`.

## Verification

Run `node --test tests/report-data.test.mjs`. Tests cover every included row, four Finance category totals, original transaction identity, service/Entertain exclusions, duplicate first-match policy, unknown code flags, empty dates, partial periods, and unchanged brands/reconciliation.
