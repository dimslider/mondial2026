// Captures the real app screens the promo video shows, plus where the tapped buttons are.
// Run from this folder: node capture.js   (needs Playwright, as in ui-tests)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { appPage, scenes, TMP } = require('../tools/make-screenshots.js');

const OUT = path.join(__dirname, 'public/screens');
const NAMES = ['main', 'call', 'lock', 'simple', 'voice', 'macro', 'sleep', 'tvs'];

(async () => {
  const b = await chromium.launch();
  const shots = await scenes(b, 'en');
  shots.forEach((f, i) => fs.copyFileSync(f, path.join(OUT, NAMES[i] + '.png')));
  fs.rmSync(TMP, { recursive: true, force: true });

  // Button centres on the main screen, as fractions of the screen, for the tap animations.
  const p = await appPage(b, 'en');
  const spots = await p.evaluate(() => {
    const at = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
    };
    return { volup: at('[data-key="KEY_VOLUP"]'), right: at('.dpad .right'), ok: at('.dpad .ok'), power: at('[data-action="power"]') };
  });
  fs.writeFileSync(path.join(__dirname, 'src/spots.json'), JSON.stringify(spots, null, 2) + '\n');
  await b.close();
  console.log(spots);
})();
