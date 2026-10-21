# Refresh correction — 03/09/26

The previous button depended on multiple native `window.confirm` prompts, then an additional unsaved-data `beforeunload` prompt. A suppressed confirmation returned without visible feedback. A reload that returned without navigation left `refreshing` true indefinitely. These are confirmed code paths, not a reproduced host-browser failure; no user-tab reload or browser interaction was performed.

- The button now opens the existing UI alert-dialog primitive. All confirmations use page UI, never native confirm.
- Imports, queue entries, Master preview and dirty Master drafts require acknowledgement. Cancel/Escape and backup/master navigation do not reload or clear data.
- The dialog explains that Export Current Data does not contain an unapplied Master draft. Users can save the draft or apply it before exporting current data.
- After explicit Reload Page, the current brand, date range, page and report are saved in the fragment. A short-lived approval flag suppresses only our duplicate beforeunload prompt for that authorised reload. The ordinary unsaved-data guard is otherwise preserved.
- If reload throws or the old document is still active after four seconds, the spinner resets, the unsaved-data guard is restored, and every page can display recovery instructions. No automatic second reload, data reset or fallback navigation occurs.
- Existing report snapshots, schemas, Master mappings, imports, Backup/Restore and aggregation formulas are unchanged. The offline HTML and source archive are regenerated locally; no deployment or new storage is introduced.

Verification covers pending-data acknowledgement, Cancel, backup/master navigation, save-before-reload, duplicate submissions, blocked/throwing reload, save failure, guard restoration, cleanup and all prior regression tests. Opening the updated HTML for the first time still requires backing up any unsaved data in the old tab, then reopening/reloading that file.
