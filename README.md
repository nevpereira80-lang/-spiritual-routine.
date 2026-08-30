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
