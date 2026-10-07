#!/bin/sh
# בונה את התיקייה dist שמתפרסמת ב-Cloudflare Pages: רק קבצי האתר, בלי קבצי מחקר, כלים או אנדרואיד.
set -e
rm -rf dist && mkdir -p dist
cp index.html app.js styles.css store.js config.js _headers dist/
cp -r data admin dist/
echo "dist ready: $(find dist -type f | wc -l) files"
