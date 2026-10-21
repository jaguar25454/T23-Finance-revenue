# Capricci Master Data

## Current scope (03/09/26)

The user chose a shared central database, then specified GitHub hosting and Google Drive storage **after the system is final**. This release implements the Master Data editing page and calculation preview only. No deployment, Google authorization, external writes, database connection, browser-storage persistence, actual authentication, audit logging, or concurrent-write protection is enabled. Disabled central-save/reload controls are deliberate, not successful save stubs.

Update: verified local sales-report Import and user-held Backup files are now implemented. See `local-sales-import.md` for supported formats, complete five-report bundles, validation, restore and runtime calculations. Imported new codes merge into Capricci Master as “ยังไม่จัดหมวด”; their revenue stays visible. Backup contains active Master plus imported original report files. Shared persistence remains deferred.

Open Capricci → Master Data in the header or sidebar. The standalone HTML uses `page=master-data` in the URL fragment so it works without a server route.

### Working features

- Seed 775 unique ItemCodes from the 877 Category rows, first occurrence wins as in the reference. Keep the 3 conflicting source-code indicators visible.
- ItemCode columns: Type, Sub Type, Category, Menu (with ItemCode beneath), Output, edit button. Search all displayed fields; paginate 20 rows.
- Sub Type options depend on the selected Type. Type “ทั้งหมด” exposes all subtypes; an incompatible existing Sub Type resets to “ทั้งหมด” when Type or draft data changes. A still-compatible subtype is preserved. Category/search/status do not narrow the Sub Type choices. These filters combine using AND; changes reset to page 1 and clear filters restores all 775 codes. Empty matches show NO DATA. These are table-only filters, not sales filters.
- Category options depend on both Type and the effective Sub Type. Sub Type “ทั้งหมด” shows all Categories within the selected Type; both parents “ทั้งหมด” shows all Categories. Invalid child selections reset to “ทั้งหมด” after parent/draft changes; compatible values remain selected. Search and sales/conflict filters do not shrink these options. Source blanks remain “ไม่ระบุ” only where matching rows actually contain them. No source mappings are changed by this cascade.
- Type resolves Category!P (Main.) via the item's current subgroup and Category!O (Sub.). Wine remains a separate Type even when its Output is Beverage - Alcohol. Changing a subgroup's Output does not rewrite Main.
- Category resolves Category!D by the first matching ItemCode row, expanding only actual merged cells. 240 unique items have source Category; 535 have no value and show “ไม่ระบุ”. Never fill down beyond merged ranges or infer from product prefixes. New codes also have no source Category. It is read-only source metadata, independent of editable subgroup/Output.
- Edit an item's display name and subgroup; add a unique code; preserve old ItemCodes and lock Service Charge's exclusion. New codes alone never create sales transactions.
- Map the 18 subgroups to four fixed Output categories. Changing a subgroup's Output affects all its items.
- Compare active vs draft category totals for the chosen Period before applying.
- “ทดลองใช้กับ Dashboard” applies a validated draft to this page session only. A visible banner distinguishes it from the original Finance mapping. Unsaved edits / active preview trigger a close/refresh warning.
- Export a JSON draft and import it later. Neither operation writes to Google Drive. Central saving remains disabled.
- Existing v1 draft JSON remains compatible. The re-saved reference hash `503da87cff13c22d61f2469f72b4c9dab863d752dbcecad22da22bbda8b2d08d` and earlier `bbd6f27742b69f2c90b84bbddcab2f5bccd87b6d12c1b93a91358adb48cb750a` were compared: all pre-existing mapping fields, groups, 133 transactions and reference checks are identical. Only this verified earlier hash is accepted as an alias; imported drafts normalize to the current hash. Display-only metadata is not added to the editable JSON schema.
- Restore the original mapping to the draft, then preview it to undo a trial. No original report or Excel file is edited.

## Logic

1. Active Master (initially the Finance seed, or the explicitly applied draft) defines ItemCode → Subgroup → Output category.
2. Select Capricci's S104 transactions for the chosen Period from the seeded day and verified imported daily bundles; missing days are not invented.
3. Keep CustomerName `ลูกค้าทั่วไป เงินสด` — a customer-group label, not a payment-method filter. Exclude Entertain and Service Charge. Do not modify this rule through Master Data.
4. Seeded amount = ExtendedPrice + Column1 adjustment, matching Finance. Imported amount = S104 ExtendedPrice + S114 Sales discount verified by ItemCode; not a bill-level allocation. No additional Qty multiplication, VAT/service charge addition, or second discount subtraction.
5. Match ItemCode case-insensitively after whitespace normalization; resolve the subgroup's Output and sum amounts. Unknown codes are flagged, never guessed as Other.
6. Feed the same result to Sale by Category, the sales cards and charts. Period includes available dates; Daily only includes the period's end date.
7. Reclassification changes category allocation, not total revenue. Original POS reports and reconciliation are independent. KAPPO and LAWOI ignore Capricci's Master.

Example: move BAR-BO0027 from Hard Liquor to A La Carte. Its 4,480 baht moves from Alcohol to Food: Food 76,140; Non-Alcohol 5,380; Alcohol 13,770; Other 0. Total remains 95,290. This example is tested, not pre-applied.

## Proposed post-final architecture — not implemented

GitHub-hosted frontend → authenticated application API → private Google Drive data files.

If GitHub Pages is selected, it serves static HTML/CSS/JS; it does not host the API runtime. A separate backend is needed. Google Drive can store Master JSON or a Google Sheet, but it is not a transactional database. Choose the exact Drive format and backend after final approval.

- Keep sales data, Master files, service credentials and refresh tokens out of a public repository and frontend bundle. **The current offline HTML contains real business data and must not be published directly.** Split the final frontend from protected data before deployment; repository privacy alone is not a website authorization mechanism.
- Server-side authentication and an explicit editor allowlist control access. Never rely on the prototype's “Administrator” label.
- API validates Capricci brand, schema/source version, unique codes, valid mappings and transaction coverage before accepting a save.
- A save must compare the client's expected revision with the authoritative latest revision, serialize writers using a backend-owned lock/atomic mechanism, retain an audit record and the previous version, and return the authoritative saved revision. A plain “read Drive file then overwrite” is insufficient to prevent lost updates.
- Immutable version files + a current-version reference are one candidate, but their update/recovery behavior must be designed and tested before treating Drive as a shared source of truth.
- Refresh/load latest must retrieve the shared version. Failures must show an error; never claim that local fallback values were read from Drive or that a failed save succeeded.
- Define business-date effective versions before production. Current preview deliberately applies one Master to all displayed dates, including historical dates.

`lib/master-api-contract.ts` describes a future load/save boundary but has no provider implementation. The UI is not yet production-ready for multi-user operation.

Primary documentation:
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Google Drive uploads: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Google OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server

## Verification

Run `node --test tests/*.test.mjs`. Master tests verify seed totals, item/subgroup moves, conservation of revenue, brand isolation, empty and partial periods, JSON validation/round trips and explicit non-persistence. Original report-data tests remain intact. No browser interaction QA was requested.
