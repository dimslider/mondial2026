// UI QA: taps through every button and panel with real touch taps and checks what reaches the TV.
// Run: npm install && npx playwright install chromium && node qa.js
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '../app/src/main/assets/remote.html');
let pass = 0, fail = 0;
function check(name, ok, info = '') { if (ok) pass++; else { fail++; console.log('FAIL:', name, info); } }
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[412, 915], [360, 640]]) {
    console.log(`--- viewport ${w}x${h}`);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => {
      const prefs = {}; window.__calls = [];
      window.Android = new Proxy({}, { get: (_, k) => (...a) => {
        window.__calls.push([String(k), a]);
        if (k === 'getPref') return prefs[a[0]] ?? a[1];
        if (k === 'setPref') prefs[a[0]] = a[1];
        if (k === 'requestPermission') setTimeout(() => onTv({ type: 'permission', what: a[0], granted: true }), 30);
        if (k === 'version') return '1.0.test';
        return '';
      } });
    });
    await p.goto(PAGE);
    const tvs = [{ ip: '10.0.0.5', type: 'samsung', name: 'Samsung Q60', label: 'סלון', mac: 'aa' }, { ip: '10.0.0.6', type: 'androidtv', name: 'TCL', label: '', mac: '' }];
    await p.evaluate((tvs) => onTv({ type: 'status', state: 'connected', ip: '10.0.0.5', tvType: 'samsung', name: 'Samsung Q60', label: 'סלון', mac: 'aa', tvs, sleepAt: 0 }), tvs);
    const calls = async () => p.evaluate(() => window.__calls.splice(0));
    const sent = async (name) => (await calls()).filter(c => c[0] === name).map(c => c[1]);
    const open = () => p.evaluate(() => [...document.querySelectorAll('.sheet.show')].map(s => s.id.replace('sheet-', '')).join(',') || 'none');
    const reset = async () => { await p.evaluate(() => closeSheets()); await p.waitForTimeout(260); await calls(); };

    // 1. every remote key sends its key on tap
    const keys = await p.evaluate(() => [...document.querySelectorAll('.app [data-key]')].filter(e => e.offsetParent).map(e => e.dataset.key));
    for (const k of keys) {
      await p.tap(`.app [data-key="${k}"]`);
      const s = await sent('key');
      check(`key ${k}`, s.length === 1 && s[0][0] === k, JSON.stringify(s));
    }
    check('no sheet opened by keys', (await open()) === 'none', await open());
    // power
    await p.tap('.pwr'); check('power', (await sent('power')).length === 1);

    // 2. panels open on tap and stay open
    for (const sh of ['numpad', 'more', 'apps']) {
      await reset();
      await p.tap(`.app [data-sheet="${sh}"]`); await p.waitForTimeout(450);
      check(`tap opens ${sh}`, (await open()) === sh, await open());
    }
    // apps sheet asked the TV and shows spinner, then a message after timeout
    await reset(); await p.tap('.app [data-sheet="apps"]'); await p.waitForTimeout(450);
    check('apps requested', (await sent('refreshApps')).length >= 1);
    check('apps spinner', await p.evaluate(() => !!document.querySelector('#applist .spinner')));
    await p.evaluate(() => onTv({ type: 'apps', apps: [{ appId: '3201907018807', name: 'Netflix', app_type: 2 }, { appId: '3201901017640', name: 'Disney+', app_type: 2 }] }));
    check('apps listed', await p.evaluate(() => document.querySelectorAll('#applist [data-launch]').length) === 2);
    await p.tap('#applist [data-launch="3201901017640"]');
    check('app launch', JSON.stringify(await sent('launch')) === JSON.stringify([['3201901017640', 2]]));
    check('apps closes after launch', (await open()) === 'none', await open());

    // numpad keys keep the sheet open
    await reset(); await p.tap('.app [data-sheet="numpad"]'); await p.waitForTimeout(450);
    await p.tap('#sheet-numpad [data-key="KEY_7"]'); await p.tap('#sheet-numpad [data-key="KEY_CYAN"]');
    check('numpad keys', JSON.stringify(await sent('key')) === JSON.stringify([['KEY_7'], ['KEY_CYAN']]));
    check('numpad stays open', (await open()) === 'numpad');
    // backdrop closes
    await p.tap('#scrim', { position: { x: 30, y: 30 } }); await p.waitForTimeout(300);
    check('backdrop closes', (await open()) === 'none', await open());

    // 3. more -> sleep timer
    await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
    await p.tap('#sheet-more [data-sheet="sleep"]'); await p.waitForTimeout(450);
    check('sleep opens from more', (await open()) === 'sleep', await open());
    await p.tap('#sheet-sleep [data-sleep="30"]'); await p.waitForTimeout(300);
    check('sleep set 30', JSON.stringify(await sent('sleepTimer')) === '[[30]]');
    check('sleep closes', (await open()) === 'none', await open());
    // keyboard -> YouTube search (Samsung: YouTube's own keyboard ignores remote text)
    await reset(); await p.evaluate(() => openSheet('keyboard')); await p.waitForTimeout(300);
    await p.fill('#kbText', 'חתולים'); await p.tap('#kbYt'); await p.waitForTimeout(300);
    check('keyboard youtube search', JSON.stringify(await sent('launch')) === JSON.stringify([['https://www.youtube.com/results?search_query=' + encodeURIComponent('חתולים'), 0]]));
    // custom sleep minutes (1 minute, for testing)
    await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
    await p.tap('#sheet-more [data-sheet="sleep"]'); await p.waitForTimeout(450);
    await p.fill('#sleepCustom', 'abc'); await p.tap('#sheet-sleep .inrow .btn'); await p.waitForTimeout(200);
    check('sleep custom rejects junk', JSON.stringify(await sent('sleepTimer')) === '[]' && (await open()) === 'sleep', await sent('sleepTimer'));
    await p.fill('#sleepCustom', '1'); await p.tap('#sheet-sleep .inrow .btn'); await p.waitForTimeout(300);
    check('sleep custom 1 minute', JSON.stringify(await sent('sleepTimer')) === '[[1]]', await sent('sleepTimer'));
    check('sleep custom closes', (await open()) === 'none', await open());
    // more -> keyboard
    await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
    await p.tap('#sheet-more [data-action="keyboard"]'); await p.waitForTimeout(450);
    check('keyboard opens from more', (await open()) === 'keyboard', await open());
    await p.fill('#kbText', 'hello'); await p.tap('#sheet-keyboard .btn:not(.ghost)');
    check('keyboard sends', JSON.stringify(await sent('text')) === '[["hello"]]');
    // more -> voice
    await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
    await p.tap('#sheet-more [data-action="voice"]'); await p.waitForTimeout(200);
    check('voice starts', (await sent('voice')).length === 1);
    // more tiles send keys
    await reset(); await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
    await p.tap('#sheet-more [data-key="KEY_SOURCE"]');
    check('more key', JSON.stringify(await sent('key')) === '[["KEY_SOURCE"]]');

    // 3b. voice from the main screen, TV keyboard opens the typing panel, hold-to-repeat is capped
    await reset(); await p.tap('.top [data-action="voice"]'); await p.waitForTimeout(150);
    check('voice button on main screen', (await sent('voice')).length === 1);
    await p.evaluate(() => onTv({ type: 'keyboard' })); await p.waitForTimeout(350);
    check('tv keyboard opens typing panel', (await open()) === 'keyboard', await open());
    await reset();
    await p.dispatchEvent('[data-key="KEY_VOLUP"]', 'pointerdown'); await p.waitForTimeout(6000);
    const held = (await sent('key')).length;
    check('hold-to-repeat stops by itself', held > 5 && held <= 32, String(held));
    await p.dispatchEvent('[data-key="KEY_VOLUP"]', 'pointerup'); await calls();
    await p.dispatchEvent('[data-key="KEY_VOLDOWN"]', 'pointerdown'); await p.waitForTimeout(700);
    await p.evaluate(() => stopRepeat()); await calls(); await p.waitForTimeout(600);
    check('stopRepeat stops immediately', (await sent('key')).length === 0);
    await p.dispatchEvent('[data-key="KEY_VOLDOWN"]', 'pointerup');

    // 4. voice results
    await reset();
    await p.evaluate(() => onTv({ type: 'voice', text: 'נטפליקס' }));
    check('voice netflix launches', (await sent('launch')).length >= 1 && (await open()) === 'none');
    await p.evaluate(() => onTv({ type: 'voice', text: 'תפתח את דיסני' }));
    check('voice disney (TV list)', JSON.stringify(await sent('launch')) === JSON.stringify([['3201901017640', 2]]));
    await p.evaluate(() => onTv({ type: 'apps', apps: [{ appId: 'STING', name: 'STING+ by yes', app_type: 2 }, { appId: 'STREMIO', name: 'Stremio', app_type: 2 }, { appId: '3201901017640', name: 'Disney+', app_type: 2 }] }));
    for (const [said, want] of [['סטינג', 'STING'], ['תפתח את יס', 'STING'], ['sting', 'STING'], ['פתח סטרימיו', 'STREMIO'], ['דיסני פלוס', '3201901017640'], ['ליוטיוב', '111299001912']]) {
      await p.evaluate((t) => onTv({ type: 'voice', text: t }), said);
      const l = await sent('launch');
      check(`voice "${said}"`, l.length >= 1 && l[0][0] === want, JSON.stringify(l));
    }
    await p.evaluate(() => onTv({ type: 'voice', text: 'שעון עולמי' })); await p.waitForTimeout(350);
    check('voice other opens sheet', (await open()) === 'voice', await open());
    await p.tap('#sheet-voice .tiles button'); 
    check('voice type', JSON.stringify(await sent('text')) === '[["שעון עולמי"]]');

    // 5. shortcuts: tap launches, long-press opens picker without picking
    await reset();
    await p.tap('[data-slot="0"]');
    check('shortcut tap launches netflix', JSON.stringify(await sent('launch')).includes('3201907018807'));
    await p.dispatchEvent('[data-slot="1"]', 'pointerdown'); await p.waitForTimeout(700);
    await p.dispatchEvent('[data-slot="1"]', 'pointerup'); await p.dispatchEvent('[data-slot="1"]', 'click');
    await p.waitForTimeout(100);
    check('long-press opens picker', (await open()) === 'pick', await open());
    check('long-press does not launch', (await sent('launch')).length === 0);
    await p.waitForTimeout(400);
    await p.tap('#pickList [data-pick="3"]'); await p.waitForTimeout(300);
    check('picker saves slot', JSON.stringify(await sent('setPref')).includes('slots:10.0.0.5'));

    // 5b. recorded shortcut: record keys, name it, replay by tap and by voice
    await reset();
    await p.dispatchEvent('[data-slot="2"]', 'pointerdown'); await p.waitForTimeout(700);
    await p.dispatchEvent('[data-slot="2"]', 'pointerup'); await p.waitForTimeout(450);
    await p.tap('#sheet-pick .btn'); await p.waitForTimeout(300);
    check('recording bar shown', await p.evaluate(() => document.getElementById('recbar').classList.contains('show')));
    for (const k of ['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER']) await p.tap(`.app [data-key="${k}"]`);
    await calls();
    await p.tap('#recbar .btn:not(.ghost)'); await p.waitForTimeout(450);
    check('name sheet opens', (await open()) === 'macro', await open());
    await p.fill('#macroName', 'STING'); await p.tap('#sheet-macro .btn');
    const savedSlots = (await sent('setPref')).filter(a => a[0].startsWith('slots:')).map(a => JSON.parse(a[1])).pop() || [];
    check('macro saved', JSON.stringify(savedSlots[2]) === JSON.stringify({ name: 'STING', macro: ['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER'] }), JSON.stringify(savedSlots));
    check('macro tile label', (await p.textContent('[data-slot="2"]')).includes('STING'));
    await p.waitForTimeout(400);
    await p.tap('[data-slot="2"]'); await p.waitForTimeout(3600);
    check('macro replays keys', JSON.stringify((await sent('key')).map(k => k[0])) === JSON.stringify(['KEY_HOME', 'KEY_RIGHT', 'KEY_RIGHT', 'KEY_ENTER']));
    await p.evaluate(() => onTv({ type: 'voice', text: 'תפתח סטינג' })); await p.waitForTimeout(3600);
    check('voice plays macro (Hebrew alias)', (await sent('key')).length === 4);

    // 6. TV switcher
    await reset(); await p.tap('#status'); await p.waitForTimeout(450);
    check('status opens tvs', (await open()) === 'tvs', await open());
    await p.tap('[data-tv="10.0.0.6"] .meta'); await p.waitForTimeout(300);
    check('switch tv', JSON.stringify(await sent('switchTv')) === '[["10.0.0.6"]]');

    // 7. settings: gear, scan, quick access
    await reset(); await p.tap('.gear[aria-label="הגדרות"]'); await p.waitForTimeout(450);
    check('gear opens settings', (await open()) === 'settings');
    await p.tap('#scanBtn'); check('scan', (await sent('scan')).length === 1);
    await p.evaluate(() => { onTv({ type: 'scanFound', device: { type: 'lg', ip: '10.0.0.9', name: 'LG', model: '', mac: '' } }); onTv({ type: 'scanDone', ok: true, count: 1 }); });
    await p.tap('[data-ip="10.0.0.9"]'); await p.waitForTimeout(100);
    check('select scanned', JSON.stringify(await sent('selectTv')) === JSON.stringify([['10.0.0.9', 'lg', 'LG', '']]));

    // 8. pin flow (android tv)
    await reset();
    await p.evaluate(() => onTv({ type: 'status', state: 'pin', ip: '10.0.0.6', tvType: 'androidtv', name: 'TCL', label: '', mac: '', tvs: [], sleepAt: 0 }));
    await p.waitForTimeout(400);
    check('pin sheet auto-opens', (await open()) === 'pin');
    await p.fill('#pinInput', 'ab12cf'); await p.tap('#sheet-pin .btn');
    check('pin submit', JSON.stringify(await sent('submitPin')) === '[["AB12CF"]]');
    // androidtv: apps sheet uses built-in list
    await p.evaluate(() => onTv({ type: 'status', state: 'connected', ip: '10.0.0.6', tvType: 'androidtv', name: 'TCL', label: '', mac: '', tvs: [], sleepAt: 0 }));
    await reset(); await p.tap('.app [data-sheet="apps"]'); await p.waitForTimeout(450);
    check('atv apps list', await p.evaluate(() => document.querySelectorAll('#applist [data-launch]').length) >= 10);
    await reset();
    await p.evaluate(() => onTv({ type: 'voice', text: 'בדיחות' })); await p.waitForTimeout(350);
    await p.tap('#voiceYt');
    check('atv youtube search', JSON.stringify(await sent('launch')).includes('youtube.com/results'));

    // 9. touchpad
    await reset(); await p.tap('#modeTp');
    const tp = await p.locator('#touchpad').boundingBox();
    await p.tap('#touchpad');
    check('touchpad tap = OK', JSON.stringify(await sent('key')) === '[["KEY_ENTER"]]');
    await p.evaluate(() => document.getElementById('modePad').click());

    // 10. back button closes sheets
    await p.tap('.app [data-sheet="more"]'); await p.waitForTimeout(450);
    check('back handled', await p.evaluate(() => handleBack()) === true && (await open()) === 'none');
    check('back exits when nothing open', await p.evaluate(() => handleBack()) === false);

    // 11. layout: nothing overflows the screen
    const overflow = await p.evaluate(() => [...document.querySelectorAll('.app *')].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1); }).map(e => e.className || e.tagName).slice(0, 5));
    check('no overflow', overflow.length === 0, JSON.stringify(overflow));

    check('no JS errors', errs.length === 0, JSON.stringify(errs));
    await p.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
