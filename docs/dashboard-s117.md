# Dashboard source rules — 03/09/26

Applies to KAPPO TAKASHI, Capricci and LAWOI. No original report files or extracted snapshots are modified.

- Active reports: A103, S102, S104, S114, S117. S107 is removed from the active type/template list; legacy URL fragments fall back to S117. Filenames with the exact S107 code are rejected by the preparation-only Import queue. This is not content validation of renamed files.
- Guest Check-In (Monthly) is restored using the user's confirmed S117 basis. Guests/Bills accumulate for the month of the selected endpoint. The reference template's table-count/occupancy fields show NO DATA; there are no invented table, capacity or sales-per-table estimates. See `guest-checkin-reference.md`.
- Guest Daily displays S117's printed Guests, Bills and Total / Person for the selected period end date. Bills are not tables. Total / Person uses the printed value (not a recomputation from gross sales); its basis is Total Sale after discount, including service charge and tax. Missing fields display NO DATA. Zero guests produces no per-person value, not a divide-by-zero result. No guest split between Sales and Entertain is inferred.
- Entertain is read explicitly from the S117 Entertain row, separately for Period and Daily. A reported 0 is shown as 0; an absent row or report is NO DATA. For a range containing the source day but ending on a day without data, Period retains the available amount while Daily and Guest Daily remain NO DATA.
- Entertain retains the report's monetary basis. Capricci's 1,815 includes the source Entertain service charge; do not treat it as a gross-merchandise amount. The original S117 Grand Total still includes Entertain in Report Detail for traceability.
- Gross sales, Sale by Category and revenue charts already exclude Entertain. Do not subtract it twice or use S117 Grand Total as gross sales. Capricci keeps the Finance S104/Master calculation and customer/service exclusions; other brands keep Food + Beverage + Other from S117. Changing Capricci's Master does not change Guest or Entertain.

Verified source day: 01/09/26.

| Brand | Gross sales | Entertain | Guests | Bills | Printed Total / Person |
| --- | ---: | ---: | ---: | ---: | ---: |
| Capricci | 95,290 | 1,815 | 41 | 12 | 2,629.45 |
| KAPPO TAKASHI | 32,100 | 0 | 6 | 2 | 5,943.85 |
| LAWOI | 33,350 | 0 | 19 | 5 | 2,065.94 |

The current bundle has one source day per brand. Period totals only represent imported dates, not a full month. Tests cover brand isolation, partial and empty periods, missing/zero values, unchanged sales, retired report routing/import and original snapshot preservation.
