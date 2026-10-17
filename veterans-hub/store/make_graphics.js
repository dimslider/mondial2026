// מרנדר את הגרפיקה לחנות מתוך graphics.html. צריך שרת מקומי: python3 -m http.server 8768 (בתיקייה veterans-hub)
// node store/make_graphics.js [basic|shots]
const { chromium } = require("playwright");
const BASE = "http://localhost:8768";
const OUT = __dirname + "/graphics";
const SHOTS = require("./shots.json");

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const what = process.argv[2] || "basic";
  async function render(q, w, h, file) {
    const pg = await b.newPage({ viewport: { width: w, height: h } });
    await pg.goto(`${BASE}/store/graphics.html?${q}`, { waitUntil: "networkidle" });
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `${OUT}/${file}` });
    await pg.close();
    console.log(file);
  }
  if (what === "basic") {
    await render("k=icon", 512, 512, "icon-512.png");
    await render("k=feature&l=he", 1024, 500, "feature-he.png");
    await render("k=feature&l=en", 1024, 500, "feature-en.png");
  }
  if (what === "shots") {
    for (const l of ["he", "en"]) {
      for (const [i, s] of SHOTS.entries()) {
        const q = new URLSearchParams({ k: "shot", l, img: `/store/graphics/raw/${l}-${s.id}.png`, cap: s[l].cap, sub: s[l].sub });
        await render(q.toString(), 1080, 1920, `${l}/${i + 1}-${s.id}.png`);
      }
    }
  }
  await b.close();
})();
