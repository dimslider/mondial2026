// סריקת ממשק שבועית: נגישות (axe), שטחי לחיצה, גופן קטן, גלילה הצידה, שגיאות קוד ומשקל טעינה.
// בכל המסכים, בעברית ובאנגלית, בהיר וכהה, ברוחב 360px. צריך: python3 -m http.server 8768 בתיקייה veterans-hub,
// ו-axe-core (npm i axe-core). הרצה: node tools/ui_scan/scan.js <תיקיית פלט>  →  report.json וצילומי מסך
const { chromium } = require('playwright');
const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const OUT = process.argv[2] || __dirname + '/out'; fs.mkdirSync(OUT, { recursive: true });
const routes = ['#/', '#/match', '#/results', '#/need?n=talk', '#/soon', '#/browse', '#/browse?q=' + encodeURIComponent('גלישה'), '#/rights', '#/help', '#/add', '#/privacy', '#/pilot', '#/about', '#/settings', '#/explore', 'CARD'];
const PROF = { statuses: ['reservists', 'combat-soldiers', 'not-recognized'], difficulties: ['sleep', 'anxiety'], interests: ['sea', 'nature'], regions: ['haifa'], maxCost: null, town: 'חיפה', goal: 'talk' };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const report = { axe: {}, small: {}, tiny: {}, overflow: [], errors: [], perf: {} };
  for (const lang of ['he', 'en']) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, colorScheme: scheme, deviceScaleFactor: 2 });
    await ctx.addInitScript(([l, p]) => { localStorage.setItem('vh-tour-v1', '1'); localStorage.setItem('vh-lang', l); localStorage.setItem('vh-profile-v1', JSON.stringify(p)); }, [lang, PROF]);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => report.errors.push(`${lang}/${scheme} PAGEERR ${e.message}`));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|turnstile|fonts/i.test(m.text())) report.errors.push(`${lang}/${scheme} ${m.text()}`); });
    for (const r of routes) {
      if (r === 'CARD') { await pg.goto('http://localhost:8768/index.html#/results'); await pg.waitForTimeout(500); await pg.locator('.stations [data-open]').first().click(); }
      else await pg.goto('http://localhost:8768/index.html' + r, { waitUntil: 'networkidle' });
      await pg.waitForTimeout(600);
      const key = `${r}`;
      await pg.addScriptTag({ content: AXE });
      const ax = await pg.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) })); });
      for (const v of ax) { const k = v.id; report.axe[k] = report.axe[k] || { impact: v.impact, where: {}, ex: v.ex }; report.axe[k].where[`${lang}/${scheme} ${key}`] = v.n; }
      const m = await pg.evaluate(() => {
        const vis = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const small = [...document.querySelectorAll('a,button,input,select,textarea,[role=button],summary,label.chip,.chip')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return (r.height < 40 || r.width < 40) && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline'); }).map(e => { const r = e.getBoundingClientRect(); return `${e.tagName}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)}"`; });
        const tiny = [...document.querySelectorAll('body *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2)).filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 14).map(e => `${e.tagName}.${(e.className || '').toString().split(' ')[0]} ${getComputedStyle(e).fontSize} "${e.textContent.trim().slice(0, 20)}"`);
        return { small, tiny, ov: document.documentElement.scrollWidth > document.documentElement.clientWidth, h: document.documentElement.scrollHeight };
      });
      report.small[key] = [...new Set([...(report.small[key] || []), ...m.small])];
      report.tiny[key] = [...new Set([...(report.tiny[key] || []), ...m.tiny])];
      if (m.ov) report.overflow.push(`${lang}/${scheme} ${key}`);
      if (lang === 'he' && scheme === 'light') { report.perf[key] = m.h; await pg.screenshot({ path: `${OUT}/${routes.indexOf(r)}.png`, fullPage: false }); }
    }
    await ctx.close();
  }
  // load weight on cold start
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 } }); const pg = await ctx.newPage(); let bytes = 0; const files = [];
  pg.on('response', async res => { try { const l = (await res.body()).length; bytes += l; files.push([res.url().replace('http://localhost:8768/', ''), l]); } catch (e) {} });
  const t0 = Date.now(); await pg.goto('http://localhost:8768/index.html', { waitUntil: 'load' }); report.loadMs = Date.now() - t0;
  report.bytes = bytes; report.files = files.sort((a, b) => b[1] - a[1]).slice(0, 6);
  fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
  await b.close();
})();
