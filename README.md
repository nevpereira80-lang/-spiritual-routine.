# Spiritual Routine — iPad-friendly Cloudflare project

Upload these four individual files directly to the root of your GitHub repository:

- worker.js
- wrangler.jsonc
- package.json
- README.md

There are no folders in this version.

Then connect the GitHub repository to Cloudflare Workers and deploy with:

npx wrangler deploy

The complete PWA is bundled into worker.js, including:
- HTML/CSS/JavaScript
- icons and manifest
- service worker
- automatic JW.org weekly updater
- Spiritual Gems
- guided Elder Track


## v11 meeting-data fix
JW.org weekly links on the workbook issue page do not include the year in their visible link text.
The Worker now matches the exact Monday-Sunday date range without requiring a year,
and probes adjacent workbook issues for cross-month weeks.
This fixes the "cannot retrieve meeting information" failure and keeps English/Spanish
on the same requested week.


## v12 direct JW.org retrieval fix
- Builds the current weekly JW.org page URL directly from the Monday-Sunday date range.
- Uses workbook index scraping only as a backup.
- Removes the custom User-Agent header.
- Corrects Bible-reading parsing so a date heading such as "August 24-30" is not mistaken for "JEREMIAH 29-30".
- API errors now include requested date/language for easier diagnosis.


## v13 API error-handler fix
- Fixed a Worker runtime bug where the error handler referenced `date` and `lang` outside their JavaScript scope.
- Added `/api/health` for a simple Worker health check.
- `/api/current-material` now always returns readable JSON errors instead of crashing the Worker when JW.org retrieval fails.


## v14 — GitHub scheduled updater
JW.org returns HTTP 403 to Cloudflare Worker requests. This version no longer asks Cloudflare to fetch JW.org.

`meeting-data.js` contains the saved official weekly data.
`update-material.mjs` is run by GitHub Actions and refreshes that file.
The included `update-material-workflow.yml` must be created in GitHub at:
`.github/workflows/update-material.yml`

Because the repository is public, standard GitHub-hosted Actions runners are free.
The workflow runs daily and can also be run manually from the Actions tab.
Each successful data change commits `meeting-data.js`, which then triggers the existing Cloudflare deployment.
