# Maison Dunand (local only)

Maison Dunand is the fifth isolated restaurant workspace. It uses the FoodStory two-CSV import flow and does not fabricate Easy Restaurant A103/S102/S104/S114/S117 documents.

## Reference and classification

`Alpea_Daily_Sales_Report_260822-For Codex.xlsx` supplies the Finance structure and historical menu catalogue only. `Sale Alpea` rows 10–11 define the Type/Sub Type presentation, `Code!A:C` maps FoodStory product category to report subgroup, and `Data Sale` supplies menu/group/category identities plus observed selling prices. Historical workbook sales are not loaded as 01/09/26 sales.

The permanent Master outputs are Food, Beverage - Non-Alcohol, Beverage - Alcohol and Other. `Pop Up - Chef Philipp` is a transaction output selected by an `A02` invoice, matching the workbook formula, so users cannot permanently assign a subgroup to Pop Up.

## 01/09/26 reconciliation

The supplied bill summary has 239,680.00 merchandise net before service/tax: 208,780.00 normal sales and 30,900.00 paid as Entertain. Entertain is excluded from Sales and Sale by Category. The supplied item-detail file allocates only 17,580.00 of normal sales. The 191,200.00 difference is retained as `ยังไม่จัดหมวด`, shown in purple, and listed by bill in Reconciliation. It is never discarded or guessed as Other.

Guests and bills come from the bill-summary CSV. Total / Person is bill-summary gross divided by guests, following `Guest Alpea`. Occupancy remains NO DATA because the reference workbook's seat/session denominator and operating-day count cannot be assumed for the imported September date.

## Verification and backup

Verify requires exactly one FoodStory bill-detail CSV and one bill-summary CSV for branch `Maison Dunand and Alpea` and the selected Business Date. It validates required columns, internal totals, invoice references, non-negative amounts, and blocks refunds, vouchers, delivery and tips until their allocation rules are specified. A summary/detail shortfall is accepted only with an explicit warning and preserved reconciliation gap.

Maison has its own `Export MAISON Data` / `Restore MAISON Backup`. It contains applied Master Data and imported source CSV text, re-verifies files on restore, and does not change any other restaurant. This implementation does not synchronize GitHub, Google Drive or a central database.
