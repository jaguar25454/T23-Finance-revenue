# KAPPO TAKASHI · FoodStory automation readiness

## Scope

Automate the two KAPPO FoodStory revenue reports without mixing them with the legacy Easy Restaurant pipeline:

- `/th/salebybill`: bill summary
- `/th/salebybilldetail`: bill item detail

The current static/offline Dashboard cannot safely sign in to FoodStory or run a scheduled task by itself. Collection must run in a separate authenticated worker, then pass the same two CSV payloads through `verifyKappoFoodstory` before the data is accepted.

## Information the owner must prepare

1. A dedicated FoodStory account for automation, restricted to KAPPO TAKASHI and read/export permissions only.
2. Confirmation of the login flow: email/username, password, OTP/MFA method, session timeout and whether CAPTCHA or device approval appears.
3. One manual export from each page for at least two different business dates, including a no-sales day if FoodStory allows it. This is used to prove file names, columns, encodings and date filters.
4. The exact automation schedule in Asia/Bangkok, including when the prior business day is considered final and whether a rerun/replacement is allowed.
5. The required date range and branch filters on each FoodStory page, plus the export format (CSV only for the current parser).
6. The destination for verified files and normalized JSON after the system is final. Keep credentials and session cookies in a secret store; never commit them to GitHub, embed them in HTML or place them in Google Drive.
7. An owner contact and failure rule: notification destination, retry count, and what to do when totals disagree, a report is empty, login expires, MFA is requested or the page layout changes.

## Recommended architecture

`Scheduled runner → authenticated FoodStory session → download two CSV files → verify branch/date/receipt/invoice/totals → normalize Fruit Liqueurs to Sake → save verified daily snapshot → Dashboard reads snapshot`

Use a dedicated service account and a server-side secret store. If FoodStory offers an official API/export integration, prefer it over browser automation. If no API is available, use a controlled browser runner with an approved persistent session; do not put credentials in the static Dashboard.

## Acceptance conditions

- Exactly two supported CSV reports for the same KAPPO business date.
- Branch is `Kappo Takashi`.
- Every detail bill exists in the bill summary and the verified totals reconcile.
- Same-day reruns replace the prior snapshot instead of adding it twice.
- `Fruit Liqueurs` never enters active Master/Dashboard data; it is normalized to `Sake` while raw source files remain unchanged for audit.
- Any login, structure, refund/voucher/tip/delivery or reconciliation exception blocks publication and alerts the owner.
