# Restaurant Master Data pages and reference prices

Updated 03/09/26. Local-only; no deployment or database changes.

- Master Data has separate Capricci / KAPPO TAKASHI / LAWOI destinations using the existing `brand` + `page=master-data` fragment. Restaurant navigation and the header selector share the same selected brand. The Capricci editor stays mounted while hidden, preserving its unsaved draft. Report reconciliation remains scoped to the selected restaurant and period.
- Capricci, KAPPO and LAWOI now have separate active editors. Each uses only its own template, product catalog and report snapshots; no restaurant inherits Type / Sub Type / Category from another restaurant.
- The first Capricci management card is named `Data Management (Capricci)`. The unique-code count remains dynamic (775 seeded codes plus any imported/new items).
- Columns: Type, Sub Type, Category, Menu, Selling Price, Output, edit action. Selling Price is a read-only THB reference from the supplied `Capricci_Daily_Sales_Report_20260901-for Codex.xlsx`, sheet Category, code F, menu G, Selling Price I (`I3` header). Per-row source coordinates are retained and available on hover.
- The current workbook package hash differs from the earlier Finance snapshot. Extraction validates all 877 code/menu row coordinates against the existing mapping without overwriting it, and records both hashes. There are 775 unique source codes: 240 numeric prices and 535 missing prices; no conflicting duplicate prices or formula-driven prices were found. Duplicate codes use the same first-row rule as existing Master data.
- Blank/invalid source prices and newly imported codes absent from the reference show NO DATA, never a guessed transaction unit price. Zero prices remain zero. Prices do not depend on the selected sales period and are not asserted to be current POS prices. They do not enter sales/category calculations, editable Master JSON, or backup contracts.
- The subgroup → four Output categories box is unchanged. Its controls still stage a group-level classification change; preview affects all linked products and loaded historical dates without changing original transactions or gross revenue. Saving centrally remains unavailable until Final.

Validation includes source-row identity and price evidence checks, reference coverage, page switching and fragment restoration, draft mounting, restaurant isolation, existing Master/import/report tests, and a guard that the protected Capricci Output box is byte-for-byte unchanged (trimmed line).
