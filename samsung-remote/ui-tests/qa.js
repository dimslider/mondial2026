// UI QA: taps through every button and panel with real touch taps and checks what reaches the TV.
// Run: npm install && npx playwright install chromium && node qa.js
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '../app/src/main/assets/remote.html');
let pass = 0, fail = 0;
function check(name, ok, info = '') { if (ok) pass++; else { fail++; console.log('FAIL:', name, info); } }
const HEB = /[֐-׿]/;

// A page with a stubbed Android bridge. prefs: initial stored prefs; license: what A.license() returns.
async function newPage(b, { w, h, locale = 'en-US', prefs = {}, license = null, missing = [] }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(({ prefs, license, missing }) => {
    window.__prefs = Object.assign({}, prefs); window.__calls = [];
    window.__license = license ? JSON.stringify(license) : '';
    window.Android = new Proxy({}, { get: (_, k) => missing.includes(k) ? undefined : (...a) => {
      window.__calls.push([String(k), a]);
      if (k === 'getPref') return window.__prefs[a[0]] ?? a[1];
      if (k === 'setPref') window.__prefs[a[0]] = a[1];
      if (k === 'requestPermission') setTimeout(() => onTv({ type: 'permission', what: a[0], granted: true }), 30);
      if (k === 'version') return '1.0.test';
      if (k === 'license') return window.__license;
      return '';
    } });
  }, { prefs, license, missing });
  await p.goto(PAGE);
  p.calls = async () => p.evaluate(() => window.__calls.splice(0));
  p.sent = async (name) => (await p.calls()).filter(c => c[0] === name).map(c => c[1]);
  p.open = () => p.evaluate(() => [...document.querySelectorAll('.sheet.show')].map(s => s.id.replace('sheet-', '')).join(',') || 'none');
  p.reset = async () => { await p.evaluate(() => closeSheets()); await p.waitForTimeout(260); await p.calls(); };
  p.overflow = () => p.evaluate(() => [...document.querySelectorAll('.app *')].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1); }).map(e => e.className || e.tagName).slice(0, 5));
  p.ctx = ctx;
  return p;
}

// Visible Hebrew text (text nodes, aria-labels, placeholders) inside root, ignoring language names
// marked lang="he" and what the user said (voice data).
function hebrewIn(rootSel) {
  const root = document.querySelector(rootSel);
  const vis = (el) => el && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }) && el.getClientRects().length;
  const skip = (el) => el.closest('[lang="he"],#voiceText');
  const out = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement;
    if (/[֐-׿]/.test(n.nodeValue) && vis(el) && !skip(el)) out.push(n.nodeValue.trim());
  }
  root.querySelectorAll('[aria-label],[placeholder]').forEach((el) => {
    const s = (el.getAttribute('aria-label') || '') + (el.getAttribute('placeholder') || '');
    if (/[֐-׿]/.test(s) && vis(el) && !skip(el)) out.push(s);
  });
  return out.slice(0, 5);
}

const TVS_HE = [{ ip: '10.0.0.5', type: 'samsung', name: 'Samsung Q60', label: 'סלון', mac: 'aa' }, { ip: '10.0.0.6', type: 'androidtv', name: 'TCL', label: '', mac: '' }];
const TVS_EN = [{ ip: '10.0.0.5', type: 'samsung', name: 'Samsung Q60', label: 'Living room', mac: 'aa' }, { ip: '10.0.0.6', type: 'androidtv', name: 'TCL', label: '', mac: '' }];

// The full remote walkthrough, in one language.
async function suite(b, lang, w, h) {
  const p = await newPage(b, { w, h, prefs: { lang } });
  const { calls, sent, open, reset } = p;
  const tag = `[${lang} ${w}] `;
  check(tag + 'lang from pref', await p.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir) === (lang === 'he' ? 'he/rtl' : 'en/ltr'));
  const tvs = lang === 'he' ? TVS_HE : TVS_EN;
  await p.evaluate((tvs) => onTv({ type: 'status', state: 'connected', ip: '10.0.0.5', tvType: 'samsung', name: 'Samsung Q60', label: tvs[0].label, mac: 'aa', tvs, sleepAt: 0 }), tvs);

  // 1. every remote key sends its key on tap
  const keys = await p.evaluate(() => [...document.querySelectorAll('.app [data-key]')].filter(e => e.offsetParent).map(e => e.dataset.key));
  for (const k of keys) {
    await p.tap(`.app [data-key="${k}"]`);
    const s = await sent('key');
    check(tag + `key ${k}`, s.length === 1 && s[0][0] === k, JSON.stringify(s));
  }
  check(tag + 'no sheet opened by keys', (await open()) === 'none', await open());
  // power
  await p.tap('.pwr'); check(tag + 'power', (await sent('power')).length === 1);

  // 2. panels open on tap and stay open
  for (const sh of ['numpad', 'more', 'apps']) {
    await reset();
    await p.tap(`.app [data-sheet="${sh}"]`); await p.waitForTimeout(450);
    check(tag + `tap opens ${sh}`, (await open()) === sh, await open());
  }
  // apps sheet asked the TV and shows spinner, then a message after timeout
  await reset(); await p.tap('.app [data-sheet="apps"]'); await p.waitForTimeout(450);
  check(tag + 'apps requested', (await sent('refreshApps')).length >= 1);
  check(tag + 'apps spinner', await p.evaluate(() => !!document.querySelector('#applist .spinner')));
  await p.evaluate(() => onTv({ type: 'apps', apps: [{ appId: '3201907018807', name: 'Netflix', app_type: 2 }, { appId: '3201901017640', name: 'Disney+', app_type: 2 }] }));
  check(tag + 'apps listed', await p.evaluate(() => document.querySelectorAll('#applist [data-launch]').length) === 2);
  await p.tap('#applist [data-launch="3201901017640"]');
  check(tag + 'app launch', JSON.stringify(await sent('launch')) === JSON.stringify([['3201901017640', 2]]));
  check(tag + 'apps closes after launch', (await open()) === 'none', await open());

  // numpad keys keep the sheet open
  await reset(); await p.tap('.app [data-sheet="numpad"]'); await p.waitForTimeout(450);
  await p.tap('#sheet-numpad [data-key="KEY_7"]'); await p.tap('#sheet-numpad [data-key="KEY_CYAN"]');
  check(tag + 'numpad keys', JSON.stringify(await sent('key')) === JSON.stringify([['KEY_7'], ['KEY_CYAN']]));
  check(tag + 'numpad stays open', (await open()) === 'numpad');
  check(tag + 'media keys stay left-to-right', await p.evaluate(() => { const r = (k) => document.querySelector(`.media [data-key="${k}"]`).getBoundingClientRect().left; return r('KEY_REWIND') < r('KEY_PLAY') && r('KEY_PAUSE') < r('KEY_FF'); }));
  check(tag + 'numpad stays left-to-right', await p.evaluate(() => { const r = (k) => document.querySelector(`#sheet-numpad [data-key="${k}"]`).getBoundingClientRect().left; return r('KEY_1') < r('KEY_3') && r('KEY_7') < r('KEY_9'); }));
  // backdrop closes
  await p.tap('#scrim', { position: { x: 30, y: 30 } }); await p.waitForTimeout(300);
  check(tag + 'backdrop closes', (await open()) === 'none', await open());

  // 3. more -> sleep timer
  await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  await p.tap('#sheet-more [data-sheet="sleep"]'); await p.waitForTimeout(450);
  check(tag + 'sleep opens from more', (await open()) === 'sleep', await open());
  await p.tap('#sheet-sleep [data-sleep="30"]'); await p.waitForTimeout(300);
  check(tag + 'sleep set 30', JSON.stringify(await sent('sleepTimer')) === '[[30]]');
  check(tag + 'sleep closes', (await open()) === 'none', await open());
  // keyboard -> YouTube search (Samsung: YouTube's own keyboard ignores remote text)
  await reset(); await p.evaluate(() => openSheet('keyboard')); await p.waitForTimeout(300);
  check(tag + 'keyboard youtube hidden on samsung', await p.evaluate(() => getComputedStyle(document.getElementById('kbYt')).display === 'none'));
  await p.fill('#kbText', 'חתולים'); await p.evaluate(() => kbYoutube()); await p.waitForTimeout(300);
  check(tag + 'keyboard youtube search', JSON.stringify(await sent('launch')) === JSON.stringify([['https://www.youtube.com/results?search_query=' + encodeURIComponent('חתולים'), 0]]));
  // apps sheet: open the TV's own app screen
  await reset(); await p.evaluate(() => openSheet('apps')); await p.waitForTimeout(300);
  await p.tap('#sheet-apps button[onclick="allAppsOnTv()"]'); await p.waitForTimeout(250);
  check(tag + 'all apps on tv (samsung -> home)', JSON.stringify(await sent('key')) === '[["KEY_HOME"]]');
  // custom sleep minutes (1 minute, for testing)
  await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  await p.tap('#sheet-more [data-sheet="sleep"]'); await p.waitForTimeout(450);
  await p.fill('#sleepCustom', 'abc'); await p.tap('#sheet-sleep .inrow .btn'); await p.waitForTimeout(200);
  check(tag + 'sleep custom rejects junk', JSON.stringify(await sent('sleepTimer')) === '[]' && (await open()) === 'sleep', await sent('sleepTimer'));
  const junkToast = await p.textContent('#toast');
  check(tag + 'sleep junk toast in language', lang === 'he' ? HEB.test(junkToast) : (!HEB.test(junkToast) && /minutes/.test(junkToast)), junkToast);
  await p.fill('#sleepCustom', '1'); await p.tap('#sheet-sleep .inrow .btn'); await p.waitForTimeout(300);
  check(tag + 'sleep custom 1 minute', JSON.stringify(await sent('sleepTimer')) === '[[1]]', await sent('sleepTimer'));
  check(tag + 'sleep custom closes', (await open()) === 'none', await open());
  // more -> keyboard
  await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  await p.tap('#sheet-more [data-action="keyboard"]'); await p.waitForTimeout(450);
  check(tag + 'keyboard opens from more', (await open()) === 'keyboard', await open());
  await p.fill('#kbText', 'hello'); await p.tap('#sheet-keyboard .btn:not(.ghost)');
  check(tag + 'keyboard sends', JSON.stringify(await sent('text')) === '[["hello"]]');
  // more -> voice
  await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  await p.tap('#sheet-more [data-action="voice"]'); await p.waitForTimeout(200);
  check(tag + 'voice starts', (await sent('voice')).length === 1);
  // more tiles send keys
  await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  await p.tap('#sheet-more [data-key="KEY_SOURCE"]');
  check(tag + 'more key', JSON.stringify(await sent('key')) === '[["KEY_SOURCE"]]');

  // 3b. voice from the main screen, TV keyboard opens the typing panel, hold-to-repeat is capped
  await reset(); await p.tap('.top [data-action="voice"]'); await p.waitForTimeout(150);
  check(tag + 'voice button on main screen', (await sent('voice')).length === 1);
  await p.evaluate(() => onTv({ type: 'keyboard' })); await p.waitForTimeout(350);
  check(tag + 'tv keyboard opens typing panel', (await open()) === 'keyboard', await open());
  await reset();
  await p.dispatchEvent('[data-key="KEY_VOLUP"]', 'pointerdown'); await p.waitForTimeout(6000);
  const held = (await sent('key')).length;
  check(tag + 'hold-to-repeat stops by itself', held > 5 && held <= 32, String(held));
  await p.dispatchEvent('[data-key="KEY_VOLUP"]', 'pointerup'); await calls();
  await p.dispatchEvent('[data-key="KEY_VOLDOWN"]', 'pointerdown'); await p.waitForTimeout(700);
  await p.evaluate(() => stopRepeat()); await calls(); await p.waitForTimeout(600);
  check(tag + 'stopRepeat stops immediately', (await sent('key')).length === 0);
  await p.dispatchEvent('[data-key="KEY_VOLDOWN"]', 'pointerup');

  // 4. voice results (Hebrew and English speech work in either UI language)
  await reset();
  await p.evaluate(() => onTv({ type: 'voice', text: 'נטפליקס' }));
  check(tag + 'voice netflix launches', (await sent('launch')).length >= 1 && (await open()) === 'none');
  await p.evaluate(() => onTv({ type: 'voice', text: 'תפתח את דיסני' }));
  check(tag + 'voice disney (TV list)', JSON.stringify(await sent('launch')) === JSON.stringify([['3201901017640', 2]]));
  await p.evaluate(() => onTv({ type: 'voice', text: 'open netflix' }));
  check(tag + 'voice "open netflix" (English)', (await sent('launch')).length >= 1);
  await p.evaluate(() => onTv({ type: 'apps', apps: [{ appId: 'STING', name: 'STING+ by yes', app_type: 2 }, { appId: 'STREMIO', name: 'Stremio', app_type: 2 }, { appId: '3201901017640', name: 'Disney+', app_type: 2 }] }));
  for (const [said, want] of [['סטינג', 'STING'], ['תפתח את יס', 'STING'], ['sting', 'STING'], ['פתח סטרימיו', 'STREMIO'], ['דיסני פלוס', '3201901017640'], ['ליוטיוב', '111299001912']]) {
    await p.evaluate((x) => onTv({ type: 'voice', text: x }), said);
    const l = await sent('launch');
    check(tag + `voice "${said}"`, l.length >= 1 && l[0][0] === want, JSON.stringify(l));
  }
  await p.evaluate(() => onTv({ type: 'voice', text: 'שעון עולמי' })); await p.waitForTimeout(350);
  check(tag + 'voice other opens sheet', (await open()) === 'voice', await open());
  await p.tap('#sheet-voice .tiles button');
  check(tag + 'voice type', JSON.stringify(await sent('text')) === '[["שעון עולמי"]]');

  // 5. shortcuts: tap launches, long-press opens picker without picking
  await reset();
  await p.tap('[data-slot="0"]');
  check(tag + 'shortcut tap launches netflix', JSON.stringify(await sent('launch')).includes('3201907018807'));
  await p.dispatchEvent('[data-slot="1"]', 'pointerdown'); await p.waitForTimeout(700);
  await p.dispatchEvent('[data-slot="1"]', 'pointerup'); await p.dispatchEvent('[data-slot="1"]', 'click');
  await p.waitForTimeout(100);
  check(tag + 'long-press opens picker', (await open()) === 'pick', await open());
  check(tag + 'long-press does not launch', (await sent('launch')).length === 0);
  await p.waitForTimeout(400);
  await p.tap('#pickList [data-pick="3"]'); await p.waitForTimeout(300);
  check(tag + 'picker saves slot', JSON.stringify(await sent('setPref')).includes('slots:10.0.0.5'));

  // 5b. recorded shortcut: record keys, name it, replay by tap and by voice
  await reset();
  await p.dispatchEvent('[data-slot="2"]', 'pointerdown'); await p.waitForTimeout(700);
  await p.dispatchEvent('[data-slot="2"]', 'pointerup'); await p.waitForTimeout(450);
  await p.tap('#sheet-pick .btn'); await p.waitForTimeout(300);
  check(tag + 'recording bar shown', await p.evaluate(() => document.getElementById('recbar').classList.contains('show')));
  for (const k of ['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER']) await p.tap(`.app [data-key="${k}"]`);
  await calls();
  const recText = await p.textContent('#recText');
  check(tag + 'recording counter', recText.includes('4') && (lang === 'he') === HEB.test(recText), recText);
  await p.tap('#recbar .btn:not(.ghost)'); await p.waitForTimeout(450);
  check(tag + 'name sheet opens', (await open()) === 'macro', await open());
  await p.fill('#macroName', 'STING'); await p.tap('#sheet-macro .btn');
  const savedSlots = (await sent('setPref')).filter(a => a[0].startsWith('slots:')).map(a => JSON.parse(a[1])).pop() || [];
  check(tag + 'macro saved', JSON.stringify(savedSlots[2]) === JSON.stringify({ name: 'STING', macro: ['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER'] }), JSON.stringify(savedSlots));
  check(tag + 'macro tile label', (await p.textContent('[data-slot="2"]')).includes('STING'));
  await p.waitForTimeout(400);
  await p.tap('[data-slot="2"]'); await p.waitForTimeout(3600);
  check(tag + 'macro replays keys', JSON.stringify((await sent('key')).map(k => k[0])) === JSON.stringify(['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER']));
  await p.evaluate(() => onTv({ type: 'voice', text: 'תפתח סטינג' })); await p.waitForTimeout(3600);
  check(tag + 'voice plays macro (Hebrew alias)', (await sent('key')).length === 4);

  // 6. TV switcher
  await reset(); await p.tap('#status'); await p.waitForTimeout(450);
  check(tag + 'status opens tvs', (await open()) === 'tvs', await open());
  await p.tap('[data-tv="10.0.0.6"] .meta'); await p.waitForTimeout(300);
  check(tag + 'switch tv', JSON.stringify(await sent('switchTv')) === '[["10.0.0.6"]]');

  // 7. settings: gear, scan, quick access
  await reset(); await p.tap('#settingsBtn'); await p.waitForTimeout(450);
  check(tag + 'gear opens settings', (await open()) === 'settings');
  check(tag + 'gear aria-label', await p.getAttribute('#settingsBtn', 'aria-label') === (lang === 'he' ? 'הגדרות' : 'Settings'));
  await p.tap('#scanBtn'); check(tag + 'scan', (await sent('scan')).length === 1);
  await p.evaluate(() => { onTv({ type: 'scanFound', device: { type: 'lg', ip: '10.0.0.9', name: 'LG', model: '', mac: '' } }); onTv({ type: 'scanDone', ok: true, count: 1 }); });
  await p.tap('[data-ip="10.0.0.9"]'); await p.waitForTimeout(100);
  check(tag + 'select scanned', JSON.stringify(await sent('selectTv')) === JSON.stringify([['10.0.0.9', 'lg', 'LG', '']]));

  // 8. pin flow (android tv)
  await reset();
  await p.evaluate(() => onTv({ type: 'status', state: 'pin', ip: '10.0.0.6', tvType: 'androidtv', name: 'TCL', label: '', mac: '', tvs: [], sleepAt: 0 }));
  await p.waitForTimeout(400);
  check(tag + 'pin sheet auto-opens', (await open()) === 'pin');
  await p.fill('#pinInput', 'ab12cf'); await p.tap('#sheet-pin .btn');
  check(tag + 'pin submit', JSON.stringify(await sent('submitPin')) === '[["AB12CF"]]');
  // androidtv: apps sheet uses built-in list
  await p.evaluate(() => onTv({ type: 'status', state: 'connected', ip: '10.0.0.6', tvType: 'androidtv', name: 'TCL', label: '', mac: '', tvs: [], sleepAt: 0 }));
  await reset(); await p.tap('.app [data-sheet="apps"]'); await p.waitForTimeout(450);
  check(tag + 'atv apps list', await p.evaluate(() => document.querySelectorAll('#applist [data-launch]').length) >= 10);
  await reset();
  await p.evaluate(() => onTv({ type: 'voice', text: 'בדיחות' })); await p.waitForTimeout(350);
  await p.tap('#voiceYt');
  check(tag + 'atv youtube search', JSON.stringify(await sent('launch')).includes('youtube.com/results'));

  // 9. touchpad
  await reset(); await p.tap('#modeTp');
  await p.tap('#touchpad');
  check(tag + 'touchpad tap = OK', JSON.stringify(await sent('key')) === '[["KEY_ENTER"]]');
  // swipes keep their physical direction in RTL too
  const tp = await p.locator('#touchpad').boundingBox();
  const swipe = (dx) => p.evaluate(({ x, y, dx }) => {
    const pad = document.getElementById('touchpad');
    const ev = (type, cx) => pad.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: cx, clientY: y, bubbles: true }));
    ev('pointerdown', x); ev('pointermove', x + dx); ev('pointerup', x + dx);
  }, { x: tp.x + tp.width / 2, y: tp.y + tp.height / 2, dx });
  await swipe(80); await swipe(-80);
  check(tag + 'touchpad swipe right/left', JSON.stringify(await sent('key')) === '[["KEY_RIGHT"],["KEY_LEFT"]]');
  await p.evaluate(() => document.getElementById('modePad').click());
  check(tag + 'd-pad right arrow is on the right', await p.evaluate(() => document.querySelector('.dpad .right').getBoundingClientRect().left > document.querySelector('.dpad .left').getBoundingClientRect().left));

  // 10. back button closes sheets
  await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  check(tag + 'back handled', await p.evaluate(() => handleBack()) === true && (await open()) === 'none');
  check(tag + 'back exits when nothing open', await p.evaluate(() => handleBack()) === false);

  // 11. layout: nothing overflows the screen
  const overflow = await p.overflow();
  check(tag + 'no overflow', overflow.length === 0, JSON.stringify(overflow));

  check(tag + 'no JS errors', p.errs.length === 0, JSON.stringify(p.errs));
  await p.ctx.close();
}

// Language: default choice, switching, and no Hebrew left in English mode.
async function i18n(b, w, h) {
  const tag = `[i18n ${w}] `;
  const dir = (p) => p.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir);
  // default language follows the phone when nothing is stored
  for (const [locale, want] of [['en-US', 'en/ltr'], ['he-IL', 'he/rtl'], ['fr-FR', 'en/ltr']]) {
    const p = await newPage(b, { w, h, locale });
    check(tag + `default language for ${locale}`, (await dir(p)) === want, await dir(p));
    if (locale === 'he-IL') check(tag + 'he default: Hebrew labels', await p.textContent('.bar.vol .mid') === 'קול' && await p.evaluate(() => document.title) === 'שלט לטלוויזיה');
    else check(tag + `${locale}: English labels`, await p.textContent('.bar.vol .mid') === 'VOL' && await p.evaluate(() => document.title) === 'TV Remote');
    await p.ctx.close();
  }
  // stored choice wins over the phone language
  { const p = await newPage(b, { w, h, locale: 'he-IL', prefs: { lang: 'en' } }); check(tag + 'stored lang beats locale', (await dir(p)) === 'en/ltr'); await p.ctx.close(); }

  const p = await newPage(b, { w, h, locale: 'en-US' });
  await p.evaluate((tvs) => onTv({ type: 'status', state: 'connected', ip: '10.0.0.5', tvType: 'samsung', name: 'Samsung Q60', label: 'Living room', mac: 'aa', tvs, sleepAt: 0 }), TVS_EN);
  await p.evaluate(() => onTv({ type: 'apps', apps: [{ appId: '3201907018807', name: 'Netflix', app_type: 2 }] }));

  // no visible Hebrew in English mode: main screen and every sheet
  check(tag + 'en: no Hebrew on main screen', (await p.evaluate(hebrewIn, '.app')).length === 0, JSON.stringify(await p.evaluate(hebrewIn, '.app')));
  for (const sh of ['numpad', 'more', 'voice', 'macro', 'sleep', 'tvs', 'pick', 'keyboard', 'pin', 'apps', 'settings']) {
    await p.reset();
    if (sh === 'voice') await p.evaluate(() => onTv({ type: 'voice', text: 'weather forecast' }));
    else await p.evaluate((s) => openSheet(s), sh);
    await p.waitForTimeout(300);
    const heb = await p.evaluate(hebrewIn, '#sheet-' + sh);
    check(tag + `en: no Hebrew in ${sh} sheet`, heb.length === 0 && (await p.open()) === sh, JSON.stringify(heb));
  }
  await p.reset();
  await p.evaluate(() => { pickSlot = 0; startRecording(); });
  check(tag + 'en: recording bar in English', (await p.evaluate(hebrewIn, '#recbar')).length === 0 && /Recording/.test(await p.textContent('#recText')));
  await p.evaluate(() => cancelRecording());
  check(tag + 'en: settings shows the Hebrew option', await p.evaluate(() => { const b = document.querySelector('#sheet-settings [data-lang="he"]'); return b.textContent === 'עברית' && b.lang === 'he'; }));
  check(tag + 'en: no overflow', (await p.overflow()).length === 0, JSON.stringify(await p.overflow()));

  // switching from Settings
  await p.reset(); await p.tap('#settingsBtn'); await p.waitForTimeout(450);
  check(tag + 'settings starts with the language row', await p.evaluate(() => document.querySelector('#sheet-settings .handle').nextElementSibling.classList.contains('langbox')));
  check(tag + 'English segment is on', await p.evaluate(() => document.querySelector('#sheet-settings [data-lang="en"]').classList.contains('on')));
  await p.tap('#sheet-settings [data-lang="he"]'); await p.waitForTimeout(150);
  const c1 = await p.calls();
  check(tag + 'switch to he: dir', (await dir(p)) === 'he/rtl', await dir(p));
  check(tag + 'switch to he: setPref', c1.some(c => c[0] === 'setPref' && c[1][0] === 'lang' && c[1][1] === 'he'), JSON.stringify(c1));
  check(tag + 'switch to he: setLang', c1.some(c => c[0] === 'setLang' && c[1][0] === 'he'));
  check(tag + 'switch to he: labels', await p.textContent('.bar.vol .mid') === 'קול' && await p.getAttribute('#settingsBtn', 'aria-label') === 'הגדרות' && await p.textContent('#sheet-settings h2') === 'חיבור לטלוויזיה');
  check(tag + 'switch to he: dynamic parts', HEB.test(await p.textContent('#helpText')) && HEB.test(await p.textContent('#ver')) && HEB.test(await p.textContent('#sleepTile')));
  check(tag + 'switch to he: settings stays open', (await p.open()) === 'settings');
  check(tag + 'switch to he: segment on', await p.evaluate(() => document.querySelector('#sheet-settings [data-lang="he"]').classList.contains('on')));
  check(tag + 'he: no overflow', (await p.overflow()).length === 0, JSON.stringify(await p.overflow()));
  await p.tap('#sheet-settings [data-lang="en"]'); await p.waitForTimeout(150);
  const c2 = await p.calls();
  check(tag + 'switch back to en', (await dir(p)) === 'en/ltr' && await p.textContent('.bar.vol .mid') === 'VOL' && c2.some(c => c[0] === 'setLang' && c[1][0] === 'en'));
  check(tag + 'en again: no Hebrew in settings', (await p.evaluate(hebrewIn, '#sheet-settings')).length === 0, JSON.stringify(await p.evaluate(hebrewIn, '#sheet-settings')));

  // globe toggle in the More sheet
  await p.reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
  check(tag + 'more: globe shows other language', (await p.textContent('#langToggle')).includes('עברית'));
  await p.tap('#langToggle'); await p.waitForTimeout(150);
  const c3 = await p.calls();
  check(tag + 'more: globe toggles to he', (await dir(p)) === 'he/rtl' && c3.some(c => c[0] === 'setLang' && c[1][0] === 'he') && (await p.textContent('#langToggle')).includes('English'));
  await p.tap('#langToggle'); await p.waitForTimeout(150);
  check(tag + 'more: globe toggles back to en', (await dir(p)) === 'en/ltr');

  // setLang is optional on the native side
  const p2 = await newPage(b, { w, h, missing: ['setLang', 'license', 'buy', 'restore'] });
  check(tag + 'missing setLang is fine', await p2.evaluate(() => { try { setLanguage('he'); return document.documentElement.dir === 'rtl' && window.__prefs.lang === 'he'; } catch (e) { return String(e); } }) === true);
  check(tag + 'missing license = family', !(await p2.isVisible('#trialBar')) && (await p2.open()) === 'none' && p2.errs.length === 0, JSON.stringify(p2.errs));
  await p2.ctx.close();

  check(tag + 'no JS errors', p.errs.length === 0, JSON.stringify(p.errs));
  await p.ctx.close();
}

// Free trial, purchase and the blocking paywall.
async function license(b, w, h) {
  const tag = `[license ${w}] `;
  const status = (p) => p.evaluate((tvs) => onTv({ type: 'status', state: 'connected', ip: '10.0.0.5', tvType: 'samsung', name: 'Samsung Q60', label: 'Living room', mac: 'aa', tvs, sleepAt: 0 }), TVS_EN);

  // family build (no license function result): nothing shown
  {
    const p = await newPage(b, { w, h });
    check(tag + 'family: no banner', !(await p.isVisible('#trialBar')));
    await p.evaluate(() => openSheet('settings')); await p.waitForTimeout(300);
    check(tag + 'family: no license row', !(await p.isVisible('#licRow')));
    await p.ctx.close();
  }

  for (const lang of ['en', 'he']) {
    const p = await newPage(b, { w, h, prefs: { lang }, license: { state: 'trial', daysLeft: 5, price: '$4.99' } });
    await status(p);
    const lt = `${tag}[${lang}] `;
    check(lt + 'trial banner visible', await p.isVisible('#trialBar'));
    const bt = await p.textContent('#trialBar');
    check(lt + 'trial banner text', bt.includes('5') && bt.includes('$4.99') && (lang === 'he' ? HEB.test(bt) : /Free trial: 5 days left/.test(bt) && /Unlock forever for \u2068?\$4\.99/.test(bt)), bt);
    check(lt + 'trial: no overflow', (await p.overflow()).length === 0, JSON.stringify(await p.overflow()));
    await p.calls();
    await p.tap('#trialBar .tb-main');
    check(lt + 'banner tap buys', (await p.sent('buy')).length === 1);
    await p.evaluate(() => openSheet('settings')); await p.waitForTimeout(400);
    const row = await p.textContent('#licRow');
    check(lt + 'settings trial line', await p.isVisible('#licRow') && row.includes('5') && row.includes('$4.99'), row);
    await p.tap('#licBuy');
    check(lt + 'settings unlock buys', (await p.sent('buy')).length === 1);
    await p.reset();
    await p.tap('#trialBar .tb-x');
    check(lt + 'banner dismiss', !(await p.isVisible('#trialBar')));
    check(lt + 'remote still works in trial', (await p.tap('.app [data-key="KEY_MUTE"]'), JSON.stringify(await p.sent('key'))) === '[["KEY_MUTE"]]');
    if (lang === 'en') {
      await p.evaluate(() => onTv({ type: 'license', state: 'trial', daysLeft: 1, price: null }));
      await p.evaluate(() => openSheet('settings')); await p.waitForTimeout(300);
      const r1 = await p.textContent('#licRow');
      check(lt + 'trial 1 day, no price', /1 day left/.test(r1) && /Unlock forever/.test(r1) && !/forever for/.test(r1), r1);
      await p.reset();
    }
    // purchase arrives from native
    await p.evaluate(() => onTv({ type: 'license', state: 'purchased', daysLeft: 0, price: '$4.99' }));
    await p.evaluate(() => openSheet('settings')); await p.waitForTimeout(300);
    const pr = await p.textContent('#licRow');
    check(lt + 'purchased: full version line', pr.includes('✓') && (lang === 'he' ? HEB.test(pr) : pr.includes('Full version')), pr);
    check(lt + 'purchased: no banner', !(await p.isVisible('#trialBar')));
    check(lt + 'no JS errors', p.errs.length === 0, JSON.stringify(p.errs));
    await p.ctx.close();
  }

  // expired at start-up: blocking paywall
  const p = await newPage(b, { w, h, license: { state: 'expired', daysLeft: 0, price: '₪19.90' } });
  await status(p);
  await p.waitForTimeout(300);
  check(tag + 'expired: paywall on start', (await p.open()) === 'paywall', await p.open());
  check(tag + 'expired: buy button price', (await p.textContent('#pwBuy')).replace(/[\u2066-\u2069]/g, '') === 'Unlock for ₪19.90', await p.textContent('#pwBuy'));
  check(tag + 'expired: benefits listed', await p.evaluate(() => document.querySelectorAll('#sheet-paywall .benefits li').length) === 7);
  check(tag + 'expired: no Hebrew in paywall (en)', (await p.evaluate(hebrewIn, '#sheet-paywall')).length === 0, JSON.stringify(await p.evaluate(hebrewIn, '#sheet-paywall')));
  await p.calls();
  await p.tap('#scrim', { position: { x: 30, y: 30 } }); await p.waitForTimeout(300);
  check(tag + 'expired: scrim does not dismiss', (await p.open()) === 'paywall');
  check(tag + 'expired: back does not dismiss', await p.evaluate(() => handleBack()) === false && (await p.open()) === 'paywall');
  await p.evaluate(() => closeSheets()); await p.waitForTimeout(100);
  check(tag + 'expired: closeSheets keeps paywall', (await p.open()) === 'paywall' && await p.evaluate(() => document.getElementById('scrim').classList.contains('show')));
  await p.evaluate(() => openSheet('settings')); await p.waitForTimeout(100);
  check(tag + 'expired: other sheets stay closed', (await p.open()) === 'paywall');
  for (const k of ['KEY_MUTE', 'KEY_VOLUP', 'KEY_ENTER']) await p.dispatchEvent(`.app [data-key="${k}"]`, 'pointerdown');
  await p.dispatchEvent('.app [data-key="KEY_VOLUP"]', 'pointerup');
  await p.evaluate(() => { send('KEY_HOME'); launchSlot(0); runAction('power'); onTv({ type: 'voice', text: 'נטפליקס' }); onTv({ type: 'voice', text: 'open youtube' }); setSleep(30); });
  await p.dispatchEvent('[data-slot="1"]', 'pointerdown'); await p.dispatchEvent('[data-slot="1"]', 'pointerup');
  await p.waitForTimeout(700);
  const blocked = (await p.calls()).filter(c => ['key', 'launch', 'power', 'text', 'sleepTimer', 'voice'].includes(c[0]));
  check(tag + 'expired: remote sends nothing', blocked.length === 0, JSON.stringify(blocked));
  await p.tap('#pwBuy');
  check(tag + 'expired: buy', (await p.sent('buy')).length === 1);
  await p.tap('#pwRestore');
  check(tag + 'expired: restore', (await p.sent('restore')).length === 1);
  // language is reachable on the paywall
  await p.tap('#sheet-paywall [data-lang="he"]'); await p.waitForTimeout(150);
  check(tag + 'expired: paywall in Hebrew', await p.evaluate(() => document.documentElement.dir) === 'rtl' && HEB.test(await p.textContent('#sheet-paywall h2')) && (await p.open()) === 'paywall');
  check(tag + 'expired: Hebrew price button', (await p.textContent('#pwBuy')).includes('₪19.90') && HEB.test(await p.textContent('#pwBuy')));
  check(tag + 'expired: setLang from paywall', (await p.sent('setLang')).some(a => a[0] === 'he'));
  await p.tap('#sheet-paywall [data-lang="en"]'); await p.waitForTimeout(150);
  // no price: plain "Unlock"
  await p.evaluate(() => onTv({ type: 'license', state: 'expired', daysLeft: 0, price: null }));
  check(tag + 'expired: no price -> Unlock', (await p.textContent('#pwBuy')) === 'Unlock' && (await p.open()) === 'paywall');
  // purchase completes: paywall closes and the remote works again
  await p.evaluate(() => onTv({ type: 'license', state: 'purchased', daysLeft: 0, price: '₪19.90' }));
  await p.waitForTimeout(300);
  check(tag + 'license event closes paywall', (await p.open()) === 'none' && !(await p.evaluate(() => document.getElementById('scrim').classList.contains('show'))));
  check(tag + 'purchase thank-you toast', /Thank you/.test(await p.textContent('#toast')));
  await p.calls();
  await p.tap('.app [data-key="KEY_MUTE"]');
  check(tag + 'keys work after purchase', JSON.stringify(await p.sent('key')) === '[["KEY_MUTE"]]');
  // expiring while the app is open closes other panels and shows the paywall
  await p.evaluate(() => openSheet('numpad')); await p.waitForTimeout(200);
  await p.evaluate(() => onTv({ type: 'license', state: 'expired', daysLeft: 0, price: '₪19.90' }));
  check(tag + 'expiry event shows paywall', (await p.open()) === 'paywall', await p.open());
  check(tag + 'no JS errors', p.errs.length === 0, JSON.stringify(p.errs));
  await p.ctx.close();
}

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[412, 915], [360, 640]]) {
    for (const lang of ['he', 'en']) {
      console.log(`--- viewport ${w}x${h} (${lang})`);
      await suite(b, lang, w, h);
    }
    console.log(`--- i18n + license ${w}x${h}`);
    await i18n(b, w, h);
    await license(b, w, h);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
