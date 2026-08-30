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
