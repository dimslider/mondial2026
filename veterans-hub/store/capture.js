// צילומי מסך גולמיים של האפליקציה לחנות (412px, כמו טלפון אנדרואיד), בעברית ובאנגלית.
// אחר כך: node store/make_graphics.js shots  →  מסגרת עם כותרת, 1080×1920
const { chromium } = require("playwright");
const SHOTS = require("./shots.json");
const OUT = __dirname + "/graphics/raw";
// פרופיל לדוגמה: לוחם במילואים מחיפה, בלי הכרה, עם קושי בשינה ובחרדה
const PROFILE = { statuses: ["reservists", "combat-soldiers", "not-recognized"], difficulties: ["sleep", "anxiety", "loneliness"],
  interests: ["sea", "nature"], regions: ["haifa"], maxCost: null, era: "iron-swords", age: "30-45", town: "חיפה", goal: "talk" };

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  for (const lang of ["he", "en"]) {
    for (const s of SHOTS) {
      const ctx = await b.newContext({ viewport: { width: 412, height: 760 }, deviceScaleFactor: 2, colorScheme: "light", locale: lang === "en" ? "en-US" : "he-IL" });
      await ctx.addInitScript(([lang, prof]) => {
        localStorage.setItem("vh-tour-v1", "1");
        localStorage.setItem("vh-lang", lang);
        localStorage.setItem("vh-theme", "light");
        if (prof) localStorage.setItem("vh-profile-v1", JSON.stringify(prof));
      }, [lang, s.profile ? PROFILE : null]);
      const pg = await ctx.newPage();
      await pg.goto("http://localhost:8768/index.html" + s.route, { waitUntil: "networkidle" });
      await pg.evaluate(() => document.fonts.ready);
      await pg.waitForTimeout(400);
      if (s.open) { await pg.locator(".stations [data-open]").first().click(); await pg.waitForTimeout(500); }
      await pg.screenshot({ path: `${OUT}/${lang}-${s.id}.png` });
      await ctx.close();
      console.log(lang, s.id);
    }
  }
  await b.close();
})();
