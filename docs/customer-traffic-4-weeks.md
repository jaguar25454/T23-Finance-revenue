# Customer traffic and calendar-month weekly ranking

The Dashboard uses the month of the selected period end date. It creates one tab for every real calendar week that intersects that month. Weeks run Monday–Sunday; the first and last tab are clipped at the month boundary, so September 2026 has Week 1 (01–06), Week 2 (07–13), Week 3 (14–20), Week 4 (21–27), and Week 5 (28–30).

Weekday Ranking is scoped to the active restaurant. The first Summary tab identifies the week with the highest total Guests and the individual date with the highest Guests in the selected month. Each weekly tab identifies that week's busiest date and shows every in-month date in calendar order.

A date with no report stays NO DATA and is not treated as zero. A report containing zero guests is valid zero data. Same-brand/same-date input is replaced rather than counted twice.

Easy Restaurant brands use S117 Guests. SUSHI SARYU and Maison Dunand use `จำนวนลูกค้า` from the verified FoodStory bill-summary CSV. The analysis does not use Bills as Guests, does not infer missing dates, and does not alter sales calculations.
