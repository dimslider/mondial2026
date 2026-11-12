# Promo video (Remotion)

36-second 1920×1080 promo for the Google Play listing, built from the real app screens.

- `node capture.js` – re-captures the app screens into `public/screens/` (needs Playwright, as in `ui-tests`).
- `npm install && npm run render` – renders `out/promo.mp4`; copy it to `../promo-video.mp4`.
- `npm run studio` – live preview while editing `src/Promo.tsx`.

The video has no soundtrack: add music from YouTube Studio's free Audio Library after uploading.
Remotion is free for individuals and companies of up to 3 people (remotion.dev/license).
