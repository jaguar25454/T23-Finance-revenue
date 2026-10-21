# LAWOI Master Data reference

Updated 04/09/26. Local-only; no deployment or central database changes.

## Sources read

- `Lawoi_Daily_Sales_Report_20260901-For codex.xlsx`: every populated and formula row in `DashBord`, `Sale Lawoi` and `Guest Lawoi` was inspected. `Sale Lawoi` is the classification structure; this workbook has no `Category` sheet.
- `LAWOI-I106 all menus.pdf`: all 18 pages and all 676 unique ItemCodes were read. The safe catalog fields are ItemCode, Menu, Description 2, POS Category, Selling Price Before Tax, Tax, Selling Price With Tax and source page.
- LAWOI A103/S102/S104/S114/S117 for 01/09/26: used as the sales/output snapshot and reconciliation evidence. The five reports are different views of the same business day and are never added together as separate revenue.

The I106 `ต้นทุนต่อหน่วย` column is deliberately outside the extraction coordinates and outside the JSON, application types, editable Master, UI, calculation, HTML backup and local Backup v3 contract. Unknown fields submitted through a Master backup are discarded by the validation whitelist.

## Classification logic

The same business logic as Capricci is used with LAWOI's own hierarchy:

`S104 sale row → ItemCode → LAWOI Master item → Sub Type → editable Output → Dashboard Sale by Category`

The four Outputs are Food, Beverage - Non-Alcohol, Beverage - Alcohol and Other. Service Charge and non-general-cash-customer rows remain excluded. S104 gives the sold items; S114 provides verified per-item discount restoration. I106 selling prices are display-only current reference values and are not multiplied by quantity to calculate historical sales.

The workbook hierarchy has 15 Sub Types. The I106 POS Category map was verified across all catalog lines: PASTA & RICE/SIDE → PASTA & RICE; BLUE/RED/SNACKS → Appetizer; DESSERT → Dessert; SOFT DRINKS → Soft Drink; HIGHBALL → Hard Liquor; WINE → Wine Bottle; SAKE → Sake; BEER → Beer; TEA POT → Coffee & Tea; PETS/SUSHI SHUNJI/Vegetarian → Other Food; DEPOSIT-SUSHI SHUNJI → Other. No mapping is borrowed from Capricci or KAPPO.

## Reconciliation for 01/09/26

| Output | Amount (THB) |
|---|---:|
| Food | 30,810.00 |
| Beverage - Non-Alcohol | 1,840.00 |
| Beverage - Alcohol | 700.00 |
| Other | 0.00 |
| Gross sales | 33,350.00 |

This matches the LAWOI Finance workbook output. The Master contains 676 I106 products plus the excluded Service Charge code. An imported ItemCode absent from I106 starts as `ยังไม่จัดหมวด`, remains included in gross sales, and appears in purple until a user assigns its Sub Type.

Backup v3 stores the editable Capricci, KAPPO and LAWOI classifications plus verified report originals. Backup v1/v2 remains readable: the missing LAWOI Master starts from this reference and adds report-only codes as Unmapped with a visible warning.
