# Guest Check-In reference audit

Read-only source: Capricci_Daily_Sales_Report_20260901-for Codex.xlsx.
SHA-256: 8611530923AD2C57A33D4E1937F96AF18946061051DB754FE65F9707F0DFCAAC.
Business date: 01/09/26 (Excel serial 46266). No source workbook changes.

| Output | Reference | Value / precedent |
| --- | --- | --- |
| Table check-in | DashBord!B25 → 'Guest Capricci '!C36 → C5 → S107!U7 | 11; source column U6 is **Trans**, not physical tables |
| Customer check-in | DashBord!B27 → 'Guest Capricci '!D36; D5 → S107!W7 | 40; source W6 is Pax |
| Occupancy | DashBord!B29 → 'Guest Capricci '!O36 | D36 / ((60 × 1) + 60 × 0) = 40 / 60 = 66.6667% |
| Daily occupancy | 'Guest Capricci '!O5 | D5 / 60; other template days differ (e.g. O6 divides by 2) |
| S117 operations | Capricci report dated 01/09/26 | Guests 41; Bills 12; Total / Person 2,629.45 |
| S104 cross-check | Unique SaleId by TranTypeName | Sales 11; Entertain 1; total 12 |

The workbook's table label is a transaction proxy. S117 Bills must not be relabelled as physical tables. Neither the capacity 60 nor the session count may be copied to the other restaurants or future days without a supplied basis. Template rows for unreported future days contain zeros; they are not observed guest records. Historical summary rows are not imported as daily reports. S107 remains a read-only reference, not a re-enabled import type.

The user explicitly selected **Report S117** as the basis after reviewing the discrepancy. Therefore the restored Monthly card sums S117 Guests and Bills for the month of the selected endpoint. Capricci on 01/09/26 is 41 guests / 12 bills. Table check-in and Occupancy show NO DATA; neither the template Trans value nor its capacity assumptions are reused as actual table/capacity data. KAPPO is 6 guests / 2 bills; LAWOI is 19 guests / 5 bills for the same day. Source reports and the five-report importer remain unchanged; S107 is not re-enabled.

The card retains the reference's monthly guest block, counts and compact bar comparison, with an explicit Bills field/legend instead of claiming Bills are tables. A repeated day replaces its previous report, other brands/months stay separate, missing days are not inserted as zero, and a month with no reports shows NO DATA. If an included report lacks a metric, that metric's total stays NO DATA with coverage shown, rather than silently undercounting.
