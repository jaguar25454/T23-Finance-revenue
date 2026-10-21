# KAPPO TAKASHI · FoodStory local dataset

KAPPO TAKASHI now uses an independent FoodStory pipeline. The active Dashboard, Master Data, Report Center, Import queue and JSON backup do not read or combine the previous Easy Restaurant KAPPO dataset. The legacy adapter remains only for compatibility with old backups and is not selectable as an active KAPPO import destination.

The local seed is the supplied FoodStory pair dated 18/10/2026: bill detail and bill summary. The verified result is 7 item rows, 1 bill, 4 guests, item net sales 25,040.00 THB, service charge 2,504.00 THB, VAT 1,928.08 THB and final total 29,472.08 THB.

Revenue follows the SUSHI SARYU FoodStory basis: item net sales feed Sale by Category; service charge, VAT and rounding are reported separately; Guests and Bills come from the bill summary; Total / Person is bill gross divided by Guests. The report pair must pass branch, date, receipt, invoice, structure and total checks before import. A date replaces the same KAPPO FoodStory date rather than adding it twice.

`Fruit Liqueurs` is an invalid staff-created category for this project. The parser normalizes it to `Sake` before creating the item identity or master mapping. Therefore the label is absent from active KAPPO data and the Komasa No Umeshu net amount of 250.00 THB is included in Beverage - Alcohol through Sake. Total sales remain unchanged.

All persistence is local and explicit. Export and restore use the `kappo-foodstory-local` backup format and cannot be restored through SUSHI SARYU, Maison Dunand or Easy Restaurant backup routes. No database, Google Drive or GitHub sync is performed.

The KAPPO Master Data page does not show a separate Reconciliation card. Its Data Management table shows Unit Sold and Total Amount from item-detail rows in the selected period. Unit Price remains the observed selling price from the FoodStory reports. When the selected period has no report, Unit Sold and Total Amount show `NO DATA`; when reports exist but a menu was not sold, both values show zero. Total Amount uses item net sales after item discount, matching the KAPPO Dashboard sales basis.
