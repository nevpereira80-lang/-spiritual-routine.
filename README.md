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
