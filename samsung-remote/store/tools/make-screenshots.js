// Renders the Play Store screenshots and feature graphic from the real app page.
// Run from samsung-remote/ui-tests (which has Playwright): node ../store/tools/make-screenshots.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const PAGE = 'file://' + path.join(ROOT, 'app/src/main/assets/remote.html');
const OUT = path.join(ROOT, 'store/screenshots');
const TMP = path.join(OUT, '.raw');
fs.mkdirSync(TMP, { recursive: true });

const CAPTIONS = {
  en: ['Your TV, right on your phone', 'Phone rings? The TV hushes.', 'Remote right on your lock screen', 'Simple mode: big, clear buttons',
    'Say an app – it opens', 'Many presses, one tap', 'Falls asleep? TV turns off.', 'All your TVs. No account. No tracking.'],
  he: ['הטלוויזיה שלכם, מהטלפון', 'מתקשרים? הטלוויזיה משתתקת', 'השלט כבר על מסך הנעילה', 'מצב פשוט: כפתורים גדולים וברורים',
    'אומרים אפליקציה – והיא נפתחת', 'הרבה לחיצות, נגיעה אחת', 'נרדמתם? הטלוויזיה נכבית', 'כל הטלוויזיות. בלי חשבון, בלי מעקב'],
};
const FEATURE = {
  en: { h: 'The advanced remote for your smart TVs', s: 'Fast · Clean · Mutes the TV when you get a call' },
  he: { h: 'השלט שמשתיק את הטלוויזיה כשמתקשרים', s: 'שליטה ב-Wi-Fi · שלט במסך הנעילה · פרטי' },
};
const TEXT = {
  en: { living: 'Living room', bedroom: 'Bedroom', kids: "Kids' room", call: 'Incoming call', caller: 'Mom', muted: 'TV muted',
    sleep: 'The TV turns off in 29 min', cancel: 'Cancel', heard: 'Netflix', listening: 'Listening…', time: '20:30', date: 'Friday, 16 October',
    macro: 'Kids cartoons', notif: 'TV Remote' },
  he: { living: 'סלון', bedroom: 'חדר שינה', kids: 'חדר ילדים', call: 'שיחה נכנסת', caller: 'אמא', muted: 'הטלוויזיה הושתקה',
    sleep: 'הטלוויזיה תכבה בעוד 29 דק׳', cancel: 'בטל', heard: 'נטפליקס', listening: 'מקשיב…', time: '20:30', date: 'יום שישי, 16 באוקטובר',
    macro: 'ערוץ ילדים', notif: 'שלט לטלוויזיה' },
};

// Icons from the app's notification drawables (same paths).
const ICON = {
  power: 'M13,3h-2v10h2V3zM17.83,5.17l-1.42,1.42C17.99,7.86 19,9.81 19,12c0,3.87 -3.13,7 -7,7s-7,-3.13 -7,-7c0,-2.19 1.01,-4.14 2.58,-5.42L6.17,5.17C4.23,6.82 3,9.26 3,12c0,4.97 4.03,9 9,9s9,-4.03 9,-9c0,-2.74 -1.23,-5.18 -3.17,-6.83z',
  voldown: 'M5,9v6h4l5,5V4L9,9H5z M16,12h5v-1.5h-5z',
  mute: 'M3,9.5h3.5L11,5.5v13l-4.5,-4H3z M15.6,9.1l1.4,-1.4 2,2 2,-2 1.4,1.4 -2,2 2,2 -1.4,1.4 -2,-2 -2,2 -1.4,-1.4 2,-2z',
  volup: 'M5,9v6h4l5,5V4L9,9H5z M16,12h2v2h1.5v-2h2v-1.5h-2v-2H18v2h-2z',
  play: 'M8,5v14l11,-7z',
  close: 'M6.4,5L12,10.6 17.6,5 19,6.4 13.4,12 19,17.6 17.6,19 12,13.4 6.4,19 5,17.6 10.6,12 5,6.4z',
};
const svg = (d, c = '#2EC4A6', s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path fill="${c}" d="${d}"/></svg>`;

async function appPage(b, lang, prefs = {}) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true, locale: lang === 'he' ? 'he-IL' : 'en-US' });
  const p = await ctx.newPage();
  await p.addInitScript(({ prefs }) => {
    window.__prefs = Object.assign({}, prefs);
    window.Android = new Proxy({}, { get: (_, k) => (...a) => {
      if (k === 'getPref') return window.__prefs[a[0]] ?? a[1];
      if (k === 'setPref') window.__prefs[a[0]] = a[1];
      if (k === 'version') return '1.0';
      if (k === 'license') return JSON.stringify({ state: 'family' });
      return '';
    } });
  }, { prefs: Object.assign({ lang }, prefs) });
  await p.goto(PAGE);
  const T = TEXT[lang];
  const tvs = [
    { ip: '192.168.1.20', type: 'samsung', name: 'Samsung', label: T.living, mac: 'aa' },
    { ip: '192.168.1.21', type: 'lg', name: 'LG', label: T.bedroom, mac: '' },
    { ip: '192.168.1.22', type: 'androidtv', name: 'Google TV', label: T.kids, mac: '' },
  ];
  await p.evaluate(({ tvs, T }) => {
    onTv({ type: 'status', state: 'connected', ip: tvs[0].ip, tvType: 'samsung', name: 'Samsung', label: T.living, mac: 'aa', tvs, sleepAt: 0 });
    onTv({ type: 'apps', apps: ['Netflix', 'YouTube', 'Disney+', 'Spotify', 'Prime Video', 'Apple TV', 'Plex', 'YouTube Kids'].map((n, i) => ({ appId: String(i + 1), name: n, app_type: 2 })) });
    document.querySelectorAll('.toast').forEach((e) => e.remove());
  }, { tvs, T });
  await p.waitForTimeout(300);
  return p;
}

// Overlays drawn on top of the app screen (system UI the app triggers: call, speech, notifications).
const overlayCss = `
  .ov { position: fixed; left: 12px; right: 12px; z-index: 9999; font-family: system-ui, sans-serif; color: #e8edf3; }
  .card { background: #1f2630; border-radius: 22px; padding: 14px 16px; box-shadow: 0 10px 30px #0008; }
  .row { display: flex; align-items: center; gap: 12px; }
  .pill { display: inline-flex; align-items: center; gap: 8px; background: #2EC4A6; color: #06231d; font-weight: 700; border-radius: 999px; padding: 8px 14px; font-size: 15px; }
`;
async function overlay(p, html, dir) {
  await p.evaluate(({ html, css, dir }) => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement('div'); d.innerHTML = html; d.setAttribute('dir', dir); document.body.appendChild(d);
  }, { html, css: overlayCss, dir });
}

async function scenes(b, lang) {
  const T = TEXT[lang], dir = lang === 'he' ? 'rtl' : 'ltr';
  const shots = [];
  const snap = async (p, i) => { const f = path.join(TMP, `${lang}-${i}.png`); await p.screenshot({ path: f }); shots[i] = f; await p.context().close(); };

  // 1 main remote
  let p = await appPage(b, lang); await snap(p, 0);

  // 2 call auto-mute: settings with "mute" chosen + incoming call heads-up
  p = await appPage(b, lang, { callAction: 'mute', quickControls: '1' });
  await p.evaluate(() => { openSheet('settings'); });
  await p.waitForTimeout(450);
  await p.evaluate(() => { const s = document.getElementById('callSeg'); s.scrollIntoView({ block: 'center' }); });
  await overlay(p, `<div class="ov" style="top:14px"><div class="card"><div class="row">
      <div style="width:44px;height:44px;border-radius:50%;background:#3d8bff;display:grid;place-items:center;font-weight:700;font-size:18px">${T.caller[0]}</div>
      <div style="flex:1"><div style="font-size:13px;color:#9aa4b2">${T.call}</div><div style="font-size:19px;font-weight:700">${T.caller}</div></div>
      <div style="width:44px;height:44px;border-radius:50%;background:#e04f3f;display:grid;place-items:center">${svg('M12,9c-1.6,0 -3.15,0.25 -4.6,0.72v3.1c0,0.39 -0.23,0.74 -0.56,0.9 -0.98,0.49 -1.87,1.12 -2.66,1.85 -0.18,0.18 -0.43,0.28 -0.7,0.28 -0.28,0 -0.53,-0.11 -0.71,-0.29L0.29,13.08c-0.18,-0.17 -0.29,-0.42 -0.29,-0.7 0,-0.28 0.11,-0.53 0.29,-0.71C3.34,8.78 7.46,7 12,7s8.66,1.78 11.71,4.67c0.18,0.18 0.29,0.43 0.29,0.71 0,0.28 -0.11,0.53 -0.29,0.71l-2.48,2.48c-0.18,0.18 -0.43,0.29 -0.71,0.29 -0.27,0 -0.52,-0.11 -0.7,-0.28 -0.79,-0.74 -1.69,-1.36 -2.67,-1.85 -0.33,-0.16 -0.56,-0.5 -0.56,-0.9v-3.1C15.15,9.25 13.6,9 12,9z', '#fff', 24)}</div>
      <div style="width:44px;height:44px;border-radius:50%;background:#2bb673;display:grid;place-items:center">${svg('M20,15.5c-1.25,0 -2.45,-0.2 -3.57,-0.57 -0.35,-0.11 -0.74,-0.03 -1.02,0.24l-2.2,2.2c-2.83,-1.44 -5.15,-3.75 -6.59,-6.59l2.2,-2.21c0.28,-0.26 0.36,-0.65 0.25,-1C8.7,6.45 8.5,5.25 8.5,4c0,-0.55 -0.45,-1 -1,-1H4c-0.55,0 -1,0.45 -1,1 0,9.39 7.61,17 17,17 0.55,0 1,-0.45 1,-1v-3.5c0,-0.55 -0.45,-1 -1,-1z', '#fff', 24)}</div>
    </div></div>
    <div style="text-align:center;margin-top:12px"><span class="pill">${svg(ICON.mute, '#06231d', 20)} ${T.muted}</span></div></div>`, dir);
  await snap(p, 1);

  // 3 lock screen with the notification remote (drawn like the real notification layout)
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.5 });
    const q = await ctx.newPage();
    const btn = (d) => `<div style="flex:1;height:44px;margin:3px;border-radius:12px;background:#ffffff14;display:grid;place-items:center">${svg(d)}</div>`;
    await q.setContent(`<html dir="${dir}"><body style="margin:0;height:915px;font-family:system-ui,sans-serif;color:#fff;
      background:radial-gradient(120% 80% at 20% 10%,#3b6fd8 0%,#2a3f9a 35%,#5a2a7a 70%,#1a1030 100%)">
      <div style="text-align:center;padding-top:110px">
        <div style="font-size:20px;opacity:.85">${T.date}</div>
        <div style="font-size:96px;font-weight:600;letter-spacing:-2px;line-height:1.1">${T.time}</div></div>
      <div style="margin:40px 14px 0;background:#141a22ee;border-radius:24px;padding:14px 14px 10px">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9aa4b2;margin-bottom:6px">
          <div style="width:20px;height:20px;border-radius:50%;background:#2EC4A6"></div>${T.notif}</div>
        <div style="display:flex;align-items:center"><div style="flex:1;font-size:16px;font-weight:600">${T.living}</div>${svg(ICON.close, '#9AA4B2', 22)}</div>
        <div style="display:flex;direction:ltr;margin-top:6px">${btn(ICON.power)}${btn(ICON.voldown)}${btn(ICON.mute)}${btn(ICON.volup)}${btn(ICON.play)}</div>
      </div></body></html>`);
    const f = path.join(TMP, `${lang}-2.png`); await q.screenshot({ path: f }); shots[2] = f; await ctx.close();
  }

  // 4 simple mode
  p = await appPage(b, lang, { simple: '1' }); await snap(p, 3);

  // 5 voice: apps panel + the phone's speech dialog
  p = await appPage(b, lang);
  await p.evaluate(() => openSheet('apps')); await p.waitForTimeout(450);
  await overlay(p, `<div class="ov" style="top:120px"><div class="card" style="text-align:center;padding:22px">
      <div style="width:64px;height:64px;margin:0 auto 10px;border-radius:50%;background:#2EC4A6;display:grid;place-items:center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#06231d" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></div>
      <div style="font-size:14px;color:#9aa4b2">${T.listening}</div><div style="font-size:30px;font-weight:700;margin-top:4px">"${T.heard}"</div></div></div>`, dir);
  await snap(p, 4);

  // 6 recorded shortcut: naming a recorded sequence; the shortcut row shows a saved one
  p = await appPage(b, lang, { ['slots:192.168.1.20']: JSON.stringify(['netflix', 'youtube', { name: T.macro, macro: ['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER', 'KEY_5'] }]) });
  await p.evaluate(() => { pickSlot = 1; startRecording(); ['KEY_HOME', 'KEY_DOWN', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER', 'KEY_1', 'KEY_2'].forEach((k) => recording.keys.push(k)); finishRecording(); });
  await p.waitForTimeout(450);
  await p.evaluate((n) => { const i = document.getElementById('macroName'); i.value = n; i.blur(); }, T.macro);
  await snap(p, 5);

  // 7 sleep timer + countdown notification
  p = await appPage(b, lang);
  await p.evaluate(() => openSheet('sleep')); await p.waitForTimeout(450);
  await overlay(p, `<div class="ov" style="top:14px"><div class="card"><div class="row">
      <div style="width:36px;height:36px;border-radius:50%;background:#2EC4A6;display:grid;place-items:center;font-size:18px">☾</div>
      <div style="flex:1"><div style="font-size:13px;color:#9aa4b2">${T.notif}</div><div style="font-size:16px;font-weight:600">${T.sleep}</div></div>
      <div style="color:#2EC4A6;font-weight:700">${T.cancel}</div></div></div></div>`, dir);
  await snap(p, 6);

  // 8 TV list
  p = await appPage(b, lang);
  await p.evaluate(() => openSheet('tvs')); await p.waitForTimeout(450);
  await snap(p, 7);
  return shots;
}

async function frame(b, lang, shots) {
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  for (let i = 0; i < shots.length; i++) {
    const img = 'data:image/png;base64,' + fs.readFileSync(shots[i]).toString('base64');
    await p.setContent(`<html dir="${dir}"><body style="margin:0;width:1080px;height:1920px;overflow:hidden;font-family:system-ui,sans-serif;
      background:radial-gradient(90% 60% at 50% 0%,#17324f 0%,#0b1220 55%,#070b12 100%)">
      <div style="height:400px;display:flex;align-items:center;justify-content:center;padding:0 80px;text-align:center">
        <div style="font-size:${CAPTIONS[lang][i].length > 26 ? 74 : 84}px;font-weight:800;line-height:1.12;color:#fff;letter-spacing:-0.5px">${CAPTIONS[lang][i]}</div></div>
      <div style="position:absolute;left:50%;top:430px;transform:translateX(-50%);width:668px;height:1484px;border-radius:72px;background:#05080d;
        box-shadow:0 0 0 3px #2b3644, 0 40px 120px #000c, 0 0 160px #2EC4A633;padding:10px;box-sizing:border-box">
        <img src="${img}" style="width:648px;height:1440px;border-radius:62px;display:block;object-fit:cover;object-position:top"></div>
      </body></html>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(OUT, `${lang}-${i + 1}.png`) });
  }
  // feature graphic 1024x500
  await p.setViewportSize({ width: 1024, height: 500 });
  const img = 'data:image/png;base64,' + fs.readFileSync(shots[0]).toString('base64');
  await p.setContent(`<html dir="${dir}"><body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:system-ui,sans-serif;
    background:radial-gradient(80% 120% at 80% 30%,#17324f 0%,#0b1220 55%,#070b12 100%);display:flex;align-items:center">
    <div style="flex:1;padding-inline-start:70px;padding-inline-end:20px">
      <div style="font-size:50px;font-weight:800;line-height:1.1;color:#fff">${FEATURE[lang].h}</div>
      <div style="font-size:24px;color:#2EC4A6;margin-top:22px;font-weight:600">${FEATURE[lang].s}</div></div>
    <div style="width:330px;height:500px;position:relative;flex:none;margin-inline-end:60px">
      <div style="position:absolute;top:40px;left:40px;width:250px;height:556px;border-radius:34px;background:#05080d;box-shadow:0 0 0 2px #2b3644,0 30px 80px #000c;padding:6px;box-sizing:border-box">
        <img src="${img}" style="width:238px;height:529px;border-radius:28px;display:block;object-fit:cover;object-position:top"></div></div>
    </body></html>`);
  await p.waitForTimeout(100);
  await p.screenshot({ path: path.join(ROOT, `store/feature-graphic${lang === 'en' ? '' : '-he'}.png`) });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  // English images serve every store language (the listing text is localized).
  for (const lang of ['en']) await frame(b, lang, await scenes(b, lang));
  await b.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('done');
})();
