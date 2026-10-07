(function () {
  const T = window.TAXONOMY;
  const $main = document.getElementById("main");
  const $modal = document.getElementById("modal");
  const $modalBody = document.getElementById("modal-body");
  const PROFILE_KEY = "vh-profile-v1";
  // בתוך מסגרת (iframe) הדפדפן לא תמיד מאפשר להדפיס, אז לא מציגים את הכפתור
  const canPrint = (() => { try { return window.self === window.top; } catch (e) { return false; } })();

  let SERVICES = (window.SERVICES || []).map(s => Object.assign({ source: "research" }, s));
  let approvedLoaded = false;

  // ---------- helpers ----------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
  const catLabel = k => (T.categories[k] || { label: k }).label;
  const catIcon = k => (T.categories[k] || { icon: "•" }).icon;
  const costLabel = k => (T.cost[k] || { label: k || "לא ידוע" }).label;
  // שדה טלפון יכול להכיל כמה מספרים ("1201 | וואטסאפ 052-…") — לחיוג לוקחים את הראשון
  const firstPhone = p => String(p).split(/\||או|,|\(/)[0].trim();
  const telHref = p => "tel:" + firstPhone(p).replace(/[^\d*+#]/g, "");
  const isMobile = p => /^0?5\d/.test(firstPhone(p).replace(/[^\d]/g, "").replace(/^972/, "0"));
  const waHref = p => {
    let d = String(p).replace(/[^\d]/g, "");
    if (d.startsWith("0")) d = "972" + d.slice(1);
    return "https://wa.me/" + d;
  };
  const safeUrl = u => {
    if (!u) return "";
    const s = String(u).trim();
    return /^https?:\/\//i.test(s) ? s : "https://" + s;
  };

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; } catch (e) { return null; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }

  async function ensureApproved() {
    if (approvedLoaded) return;
    approvedLoaded = true;
    try {
      const extra = await Store.listApproved();
      extra.forEach(s => {
        s.id = "p-" + s._id;
        s.source = "provider";
        SERVICES.push(s);
      });
    } catch (e) { /* offline */ }
  }

  // ---------- matching ----------
  // ציון התאמה: קשיים שווים יותר מתחומי עניין, אזור קרוב מוסיף, עלות נמוכה מוסיפה מעט.
  // זכאות היא סינון קשיח — לא מציגים שירות שהמשתמש לא זכאי לו (אלא אם השירות פתוח לכולם).
  const OPEN_TO_ALL = ["civilians"];
  function eligible(s, statuses) {
    const el = arr(s.eligibility);
    if (!statuses.length || !el.length) return true;
    if (el.some(e => OPEN_TO_ALL.includes(e))) return true;
    return el.some(e => statuses.includes(e));
  }
  function regionOk(s, regions) {
    const r = arr(s.regions);
    if (!regions.length || !r.length) return true;
    if (r.includes("nationwide") || r.includes("online")) return true;
    return r.some(x => regions.includes(x));
  }
  function score(s, p) {
    let sc = 0;
    const why = [];
    const d = arr(s.difficulties).filter(x => p.difficulties.includes(x));
    const i = arr(s.interests).filter(x => p.interests.includes(x));
    if (d.length) { sc += 3 * d.length; why.push("עוזר ב: " + d.map(x => T.difficulties[x]).join(", ")); }
    if (i.length) { sc += 2 * i.length; why.push("מתאים לתחומי עניין: " + i.map(x => T.interests[x]).join(", ")); }
    const r = arr(s.regions);
    if (p.regions.length && r.some(x => p.regions.includes(x))) { sc += 2; why.push("קרוב אליך"); }
    const cr = (T.cost[s.cost] || { rank: 4 }).rank;
    sc += Math.max(0, 2 - cr * 0.5);
    if (p.maxCost != null && cr > p.maxCost) sc -= 4;
    const el = arr(s.eligibility).filter(x => p.statuses.includes(x));
    if (el.length) { sc += 1; why.unshift("מתאים לסטטוס שלך"); }
    if (s.confidence === "low") sc -= 1;
    return { sc, why };
  }
  function match(p) {
    return SERVICES
      .filter(s => s.category !== "hotlines")
      .filter(s => eligible(s, p.statuses) && regionOk(s, p.regions))
      .map(s => Object.assign({ s }, score(s, p)))
      .filter(x => x.sc > 1.5 || (!p.difficulties.length && !p.interests.length))
      // שירות שפתוח לכולם (ולא ספציפית לסטטוס שסימנת) מוצג רק אם הוא עונה על קושי או תחום עניין שבחרת
      .filter(x => !p.statuses.length || arr(x.s.eligibility).some(e => p.statuses.includes(e)) ||
        arr(x.s.difficulties).some(d => p.difficulties.includes(d)) || arr(x.s.interests).some(i => p.interests.includes(i)))
      .sort((a, b) => b.sc - a.sc);
  }

  // ---------- components ----------
  const AREAS = window.AREAS || {};
  const areaOf = cat => Object.keys(AREAS).find(k => AREAS[k].cats.includes(cat)) || "soul";
  const areaTag = s => { const a = areaOf(s.category); return `<span class="area-tag area-${a}">${esc(AREAS[a].label)}</span>`; };
  // קווים שנמשכו ביד: אותו קו משמש לרשימות, לתחנות ולגל
  const HAND_LINE = `<svg class="hand-line" viewBox="0 0 24 400" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M12 0 C 4 40, 20 70, 12 110 C 4 150, 22 180, 12 220 C 2 260, 20 300, 12 340 C 6 370, 16 390, 12 400" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  const WAVE = `<svg class="wave" viewBox="0 0 346 18" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M2 9 Q 22 1 43 9 T 86 9 T 129 9 T 172 9 T 215 9 T 258 9 T 301 9 T 344 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  const TICK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 13 C 7 15, 8 17, 10 19 C 13 13, 16 8, 21 4"/></svg>`;
  const shortDesc = (t, n) => (t || "").length > n ? (t || "").slice(0, n).replace(/\s+\S*$/, "") + "…" : (t || "");

  function chip(group, key, label, checked) {
    return `<label class="chip"><input type="checkbox" name="${group}" value="${esc(key)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  function card(s, why) {
    const meta = [costLabel(s.cost), ...arr(s.regions).slice(0, 2).map(r => T.regions[r] || r)];
    if (s.source === "provider") meta.push("הצטרף ללוח");
    else if (s.verified_at) meta.push("✓ נבדק");
    return `
      <article class="card" data-open="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}">
        <div class="tag-row">${areaTag(s)}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(shortDesc(s.description, 150))}</p>
        ${why && why.length ? `<span class="why">← ${esc(why.slice(0, 2).join(" · "))}</span>` : ""}
        <span class="meta-line">${esc(meta.join(" · "))}</span>
      </article>`;
  }

  // ---------- views ----------
  function viewHome() {
    const prof = loadProfile();
    const counts = {};
    SERVICES.forEach(s => { const a = areaOf(s.category); counts[a] = (counts[a] || 0) + 1; });
    $main.innerHTML = `
      <section>
        <h1 class="page-title">מה מושך אותך?</h1>
        <p class="lead">משם מתחילים. טיפול, ים, חוות, ספורט, מענקים וזכויות, לנכי צה״ל, מילואימניקים, שוטרים ולמי שעוד לא הוכר.</p>
        <ul class="areas lined">
          ${HAND_LINE}
          ${Object.keys(AREAS).map(k => `
            <li>
              <span class="node" aria-hidden="true"></span>
              <a href="#/area?a=${k}">
                <span class="dabbed area-${k}"><span class="word${AREAS[k].label.length > 4 ? " long" : ""}">${esc(AREAS[k].label)}</span></span>
                <span><span class="sub">${esc(AREAS[k].sub)}</span><br><span class="count">${counts[k] || 0} אפשרויות</span></span>
              </a>
            </li>`).join("")}
        </ul>
        <a class="btn btn-wide home-cta" href="#/match">לא בטוח? 4 שאלות קצרות</a>
        ${prof ? `<p class="saved-link"><a class="link-u" href="#/results">לתחנות שלי ←</a></p>` : ""}
        <p class="lead">בלי הרשמה. מה שתסמן נשאר רק אצלך במכשיר.</p>
      </section>`;
  }

  function viewArea(params) {
    const k = AREAS[params.get("a")] ? params.get("a") : "sea";
    const A = AREAS[k];
    const p = loadProfile();
    let items = SERVICES.filter(s => A.cats.includes(s.category) && s.category !== "hotlines");
    if (p) items = items.map(s => Object.assign({ s }, score(s, p))).sort((a, b) => b.sc - a.sc).map(x => x.s);
    else items.sort((a, b) => (b.verified_at ? 1 : 0) - (a.verified_at ? 1 : 0));
    const top = items[0], rest = items.slice(1);
    $main.innerHTML = `
      <section class="area-${k}">
        <div class="area-hero">
          <span class="dabbed"><span class="word">${esc(A.label)}</span></span>
          <span class="note">${items.length} אפשרויות<br>${esc(A.sub)}</span>
        </div>
        ${WAVE}
        ${top ? `
          <article class="sheet" style="margin-top: 16px">
            <span class="note highlight">${p ? "הכי מתאים לך" : "כדאי להתחיל כאן"} · ${esc(costLabel(top.cost))}</span>
            <h2>${esc(top.name)}</h2>
            <p>${esc(shortDesc(top.description, 180))}</p>
            <div class="actions">
              <button class="btn btn-ink" type="button" data-open="${esc(top.id)}">לפרטים וליצירת קשר</button>
            </div>
          </article>` : `<p class="empty">עוד אין כאן שירותים. אפשר <a href="#/provider">להציע גוף</a>.</p>`}
        <div class="grid" style="margin-top: 10px">${rest.map(s => card(s)).join("")}</div>
        ${!p ? `<p class="actions"><a class="link-u" href="#/match">לסדר לפי מה שמתאים לי ←</a></p>` : ""}
      </section>`;
  }

  function progressLine(idx, total) {
    const xs = Array.from({ length: total }, (_, i) => 330 - i * (314 / (total - 1)));
    const solidTo = xs[idx];
    return `<svg class="progress-line" viewBox="0 0 346 40" fill="none" aria-hidden="true">
      <path d="M330 20 C 300 10, 280 30, ${solidTo + 40} 20 S ${solidTo + 10} 24, ${solidTo} 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M${solidTo} 20 C ${solidTo - 30} 10, 60 30, 16 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2 7"/>
      ${xs.map((x, i) => i === idx
        ? `<circle cx="${x}" cy="20" r="13" fill="var(--t-soul)" stroke="currentColor" stroke-width="2.2"/>`
        : `<circle cx="${x}" cy="20" r="9" fill="${i < idx ? "currentColor" : "var(--paper)"}" stroke="currentColor" stroke-width="2.2"/>`).join("")}
    </svg>`;
  }

  function viewMatch() {
    const p = loadProfile() || { statuses: [], difficulties: [], interests: [], regions: [], maxCost: null };
    const steps = [
      { key: "statuses", title: "מה המצב שלך?", sub: "אפשר לסמן כמה. זה קובע למה יש לך זכאות.", opts: T.eligibility },
      { key: "difficulties", title: "עם מה הכי קשה עכשיו?", sub: "אפשר לבחור כמה. אין תשובה לא נכונה.", opts: T.difficulties },
      { key: "interests", title: "מה מדבר אליך?", sub: "דברים שאוהבים, או שתמיד רצית לנסות.", opts: T.interests },
      { key: "regions", title: "איפה נוח לך?", sub: "שירותים ארציים ואונליין יופיעו תמיד.", opts: T.regions }
    ];
    let idx = 0;
    function render() {
      const st = steps[idx];
      const last = idx === steps.length - 1;
      $main.innerHTML = `
        <section class="wizard">
          <div aria-label="שאלה ${idx + 1} מתוך ${steps.length}">${progressLine(idx, steps.length)}</div>
          <h1 class="page-title">${st.title}</h1>
          <p class="lead">${st.sub}</p>
          <form id="step-form">
            <div class="chips">
              ${Object.keys(st.opts).filter(k => !(st.key === "regions" && (k === "nationwide" || k === "online")))
                .map(k => chip(st.key, k, st.opts[k], p[st.key].includes(k))).join("")}
            </div>
            ${last ? `
              <fieldset class="cost-pref">
                <legend>עלות</legend>
                <label><input type="radio" name="maxCost" value="0" ${p.maxCost === 0 ? "checked" : ""}> רק ללא עלות</label>
                <label><input type="radio" name="maxCost" value="3" ${p.maxCost === 3 ? "checked" : ""}> גם השתתפות חלקית</label>
                <label><input type="radio" name="maxCost" value="" ${p.maxCost == null ? "checked" : ""}> לא משנה</label>
              </fieldset>` : ""}
            <div class="wizard-nav">
              ${idx > 0 ? `<button type="button" class="link-u" id="back">חזרה</button>` : ""}
              <button type="button" class="link-u" id="skip">לדלג</button>
              <button type="submit" class="btn btn-ink">${last ? "הראו לי" : "המשך"}</button>
            </div>
          </form>
        </section>`;
      const form = document.getElementById("step-form");
      const collect = () => { p[st.key] = [...form.querySelectorAll(`input[name="${st.key}"]:checked`)].map(i => i.value); };
      const next = () => {
        if (last) {
          const mc = form.querySelector('input[name="maxCost"]:checked');
          p.maxCost = mc && mc.value !== "" ? Number(mc.value) : null;
          saveProfile(p);
          location.hash = "#/results";
        } else { idx++; render(); window.scrollTo(0, 0); }
      };
      form.addEventListener("submit", e => { e.preventDefault(); collect(); next(); });
      document.getElementById("skip").onclick = () => { p[st.key] = []; next(); };
      const back = document.getElementById("back");
      if (back) back.onclick = () => { collect(); idx--; render(); };
    }
    render();
  }

  function viewResults() {
    const p = loadProfile();
    if (!p) { location.hash = "#/match"; return; }
    const res = match(p);
    // שלוש תחנות: ההתאמות הכי טובות, כל אחת מתחום אחר
    const first = [];
    for (const r of res) { if (first.length < 3 && !first.some(f => areaOf(f.s.category) === areaOf(r.s.category))) first.push(r); }
    const firstIds = new Set(first.map(r => r.s.id));
    const byArea = {};
    res.filter(r => !firstIds.has(r.s.id)).forEach(r => { const a = areaOf(r.s.category); (byArea[a] = byArea[a] || []).push(r); });
    const depth = a => byArea[a].slice(0, 2).reduce((t, r) => t + r.sc, 0);
    const order = Object.keys(byArea).sort((a, b) => depth(b) - depth(a));
    const crisis = p.difficulties.some(d => ["ptsd", "depression", "addiction", "moral-injury", "anxiety", "loneliness", "sleep", "anger", "grief"].includes(d));
    const noInput = !p.difficulties.length && !p.interests.length;
    const SHORT = { "mod-recognized": "מוכר/ת", "mod-in-process": "בתהליך הכרה", "not-recognized": "עוד לא מוכר/ת", "reservists": "מילואים",
      "combat-soldiers": "לוחם/ת", "police": "משטרה", "security-forces": "כוחות ביטחון", "families": "משפחה", "bereaved": "משפחה שכולה",
      "terror-victims": "נפגע/ת איבה", "civilians": "אזרח/ית" };
    const who = [...p.statuses.map(s => SHORT[s]).slice(0, 2), ...p.regions.map(r => T.regions[r]).slice(0, 1)].filter(Boolean).join(" · ");
    $main.innerHTML = `
      <section>
        <h1 class="page-title">${first.length ? "התחנות שלך" : "לא מצאנו התאמה מדויקת"}</h1>
        ${who ? `<p class="lead">${esc(who)}</p>` : ""}
        <p class="actions"><a class="link-u" href="#/match">לשנות תשובות</a></p>
        ${noInput ? `<div class="callout">כדי שהרשימה תהיה קצרה ומדויקת, כדאי לסמן לפחות קושי אחד או תחום עניין. <a href="#/match">לסמן עכשיו</a></div>` : ""}
        ${crisis ? `<div class="callout">כשקשה, לא חייבים לחכות לאף תוכנית. אפשר לדבר עם מישהו גם עכשיו, גם בלילה. <a href="#/help">עזרה עכשיו ←</a></div>` : ""}
        ${first.length ? `
          <ol class="stations lined">
            ${HAND_LINE}
            ${first.map((r, n) => {
              const s = r.s;
              return `<li>
                <span class="st-node" aria-hidden="true">${n + 1}</span>
                <div class="tag-row">${areaTag(s)}<span class="cost-tag">${esc(costLabel(s.cost))}</span></div>
                <h2 data-open="${esc(s.id)}" tabindex="0" role="button">${esc(s.name)}</h2>
                <p>${esc(shortDesc(s.description, 120))}</p>
                ${r.why.length ? `<span class="why">← ${esc(r.why.filter(w => w !== "מתאים לסטטוס שלך").slice(0, 1).join("") || r.why[0])}</span>` : ""}
                <div class="actions">
                  ${s.phone ? `<a class="btn btn-ink" href="${telHref(s.phone)}">${esc(firstPhone(s.phone))}</a>` : ""}
                  <button class="link-u" type="button" data-open="${esc(s.id)}">לפרטים</button>
                </div>
              </li>`;
            }).join("")}
          </ol>` : `<p class="empty">נסו לסמן פחות סינונים, או <a href="#/">לבחור תחום</a>.</p>`}
      </section>
      ${order.length ? `
        <section class="more-areas">
          <h2 class="section-title">עוד ${res.length - first.length} תחנות בדרך, לפי תחום</h2>
          ${order.map(a => `
            <details class="area-${a}">
              <summary><span class="dabbed"><span class="display" style="font-size: 26px">${esc(AREAS[a].label)}</span></span><span class="hand">${byArea[a].length} אפשרויות</span></summary>
              <div class="grid">${byArea[a].map(r => card(r.s, r.why.filter(w => w !== "מתאים לסטטוס שלך"))).join("")}</div>
            </details>`).join("")}
        </section>` : ""}`;
  }

  // מילים נרדפות לחיפוש. כל מילה בשאילתה נחשבת כנמצאה אם אחת מהנרדפות שלה מופיעה.
  const SYNONYMS = [
    ["ptsd", "פוסט טראומה", "פוסט-טראומה", "פוסטטראומה", "הלם קרב"],
    ["כסף", "מענק", "מענקים", "כלכלי", "כספי", "תגמול", "החזר", "מימון", "הלוואה"],
    ["עורך דין", "עו\"ד", "עורכי דין", "משפטי", "ייצוג", "ערעור", "תביעה"],
    ["שוטר", "שוטרים", "משטרה", "נכי משטרה", "מג\"ב", "משמר הגבול"],
    ["הכרה", "ועדה רפואית", "אחוזי נכות", "קצין תגמולים"],
    ["גלישה", "גלישת", "גולשים", "סאפ"],
    ["ים", "שיט", "צלילה", "קיאק", "גלישה"],
    ["סוס", "סוסים", "רכיבה"],
    ["כלב", "כלבים", "כלב שירות", "כלבי"],
    ["יוגה", "מדיטציה", "מיינדפולנס", "נשימה"],
    ["פסיכולוג", "פסיכולוגי", "טיפול נפשי", "פסיכותרפיה"],
    ["זוגי", "זוגיות", "בני זוג", "בת זוג", "בן זוג"],
    ["ילדים", "ילד", "ילדיהם", "קייטנות", "קייטנה"],
    ["עבודה", "תעסוקה", "קריירה", "משרה", "הייטק"],
    ["לימודים", "מלגה", "מלגות", "סטודנט", "סטודנטים", "השכלה"],
    ["חוות", "חקלאות", "חקלאי"],
    ["דירה", "דיור", "שכירות", "משכנתא"],
    ["רכב", "נהיגה", "ניידות"]
  ];
  const PREFIXES = ["וה", "שה", "בה", "לה", "מה", "ה", "ב", "ל", "ו", "מ", "ש", "כ"];
  function expand(word) {
    const out = new Set([word]);
    for (const p of PREFIXES) if (word.length > p.length + 2 && word.startsWith(p)) out.add(word.slice(p.length));
    for (const w of [...out]) for (const g of SYNONYMS) if (g.includes(w)) g.forEach(x => out.add(x));
    return [...out];
  }
  const REGION_WORDS = { "צפון": "north", "בצפון": "north", "חיפה": "haifa", "בחיפה": "haifa", "קריות": "haifa", "מרכז": "center", "במרכז": "center",
    "שרון": "sharon", "בשרון": "sharon", "ירושלים": "jerusalem", "בירושלים": "jerusalem", "דרום": "south", "בדרום": "south", "באר שבע": "south" };
  function searchScore(s, words) {
    const name = (s.name || "").toLowerCase();
    const tags = [catLabel(s.category), ...arr(s.interests).map(x => T.interests[x]), ...arr(s.difficulties).map(x => T.difficulties[x]),
      ...arr(s.regions).map(x => T.regions[x]), ...arr(s.eligibility).map(x => T.eligibility[x])].join(" ").toLowerCase();
    const body = [s.description, s.location, s.cost_notes, s.how_to_apply].join(" ").toLowerCase();
    // מילה קצרה (כמו "ים") נחשבת רק כמילה שלמה, אחרת היא נמצאת בתוך "מילואימניקים"
    // מחפשים רק בתחילת מילה (מותר לפניה ה/ב/ל/ו/מ/ש/כ), כדי ש"חוות" לא יימצא באמצע מילה אחרת
    const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const has = (text, f) => new RegExp(`(^|[^א-תa-z0-9])(ו|ה|ב|ל|מ|ש|כ|וה|שה|בה|לה|מה|וב|ול)?${escRe(f)}` + (f.length <= 2 ? "([^א-תa-z]|$)" : "")).test(text);
    let total = 0, matched = 0;
    for (const w of words) {
      if (REGION_WORDS[w]) { if (regionOk(s, [REGION_WORDS[w]])) { matched++; total += arr(s.regions).includes(REGION_WORDS[w]) ? 2 : 0; } continue; }
      const forms = expand(w);
      // המילה עצמה שווה יותר ממילה נרדפת, כדי ש"גלישה" יעלה קודם את מה שבאמת כתוב בו גלישה
      const own = forms.slice(0, PREFIXES.filter(p => w.length > p.length + 2 && w.startsWith(p)).length + 1);
      const hit = own.some(f => has(name, f)) ? 8 : forms.some(f => has(name, f)) ? 5 : forms.some(f => has(tags, f)) ? 3 : forms.some(f => has(body, f)) ? 1 : 0;
      if (hit) matched++;
      total += hit;
    }
    return { total, matched };
  }

  function viewBrowse(params) {
    const st = {
      q: params.get("q") || "",
      cat: params.get("cat") || "",
      el: params.get("el") || "",
      region: params.get("region") || "",
      cost: params.get("cost") || ""
    };
    const opt = (obj, cur, getLabel) => Object.keys(obj).map(k =>
      `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(getLabel ? getLabel(obj[k]) : obj[k])}</option>`).join("");
    $main.innerHTML = `
      <section>
        <h1 class="page-title">חיפוש</h1>
        <form class="filters" id="filters">
          <input type="search" name="q" placeholder="חיפוש: גלישה, סוסים, EMDR, מלגה…" value="${esc(st.q)}" aria-label="חיפוש">
          <select name="cat" aria-label="תחום"><option value="">כל התחומים</option>${opt(T.categories, st.cat, v => v.label)}</select>
          <select name="el" aria-label="זכאות"><option value="">כל הסטטוסים</option>${opt(T.eligibility, st.el)}</select>
          <select name="region" aria-label="אזור"><option value="">כל האזורים</option>${opt(T.regions, st.region)}</select>
          <select name="cost" aria-label="עלות"><option value="">כל העלויות</option>${opt(T.cost, st.cost, v => v.label)}</select>
        </form>
        <p class="count" id="count"></p>
        <div class="grid" id="list"></div>
      </section>`;
    const form = document.getElementById("filters");
    const run = () => {
      const fd = new FormData(form);
      const q = (fd.get("q") || "").trim().toLowerCase();
      // ביטוי שלם שמופיע ברשימת הנרדפות ("עורך דין", "כלב שירות") נחפש כיחידה אחת
      const words = SYNONYMS.some(g => g.includes(q)) ? [q] : q.split(/\s+/).filter(Boolean);
      const pool = SERVICES.filter(s => {
        if (fd.get("cat") && s.category !== fd.get("cat")) return false;
        if (fd.get("el") && !eligible(s, [fd.get("el")])) return false;
        if (fd.get("region") && !regionOk(s, [fd.get("region")])) return false;
        if (fd.get("cost") && s.cost !== fd.get("cost")) return false;
        return true;
      });
      let out = pool, partial = false;
      if (words.length) {
        const scored = pool.map(s => Object.assign({ s }, searchScore(s, words)));
        let hits = scored.filter(x => x.matched === words.length);
        // אין התאמה לכל המילים: מציגים את מה שמתאים לחלק מהן, עם הסבר
        if (!hits.length) { hits = scored.filter(x => x.matched > 0); partial = hits.length > 0; }
        out = hits.sort((a, b) => b.matched - a.matched || b.total - a.total).map(x => x.s);
      }
      document.getElementById("count").textContent = partial
        ? `לא מצאנו התאמה לכל המילים. אלה ${out.length} תוצאות שמתאימות לחלק מהן:`
        : `${out.length} תוצאות`;
      document.getElementById("list").innerHTML = out.map(s => card(s)).join("") ||
        `<p class="empty">אין תוצאות. נסו חיפוש אחר.</p>`;
      const qs = new URLSearchParams();
      for (const [k, v] of fd.entries()) if (v) qs.set(k, v);
      history.replaceState(null, "", "#/browse" + (qs.toString() ? "?" + qs : ""));
    };
    form.addEventListener("input", run);
    form.addEventListener("submit", e => e.preventDefault());
    run();
  }

  function viewRights(params) {
    const G = window.GUIDES || {};
    const keys = Object.keys(G);
    const prof = loadProfile();
    const k = G[params.get("s")] ? params.get("s") : (prof && prof.statuses.find(x => G[x])) || keys[0];
    if (!k) { $main.innerHTML = `<section><h1 class="big-word">מה מגיע לי</h1></section>`; return; }
    const g = G[k];
    const items = g.sections.flatMap(sec => sec.items.map(it => Object.assign({ section: sec.title }, it)));
    const [key, ...rest] = items;
    const link = it => it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.text)}</a>` : esc(it.text);
    const related = SERVICES.filter(s => ["rights-legal", "financial-grants"].includes(s.category) && eligible(s, [k])).slice(0, 5);
    $main.innerHTML = `
      <section class="area-soul">
        <h1 class="big-word">מה מגיע לי</h1>
        <nav class="status-pick" aria-label="הסטטוס שלי">
          ${keys.map(x => `<a href="#/rights?s=${x}" class="${x === k ? "active" : ""}" ${x === k ? 'aria-current="page"' : ""}>${esc(G[x].title)}</a>`).join("")}
        </nav>
        <p class="guide-intro">${esc(g.intro)}</p>
        ${key ? `
          <article class="sheet key-right">
            <span class="area-tag badge">הכי חשוב</span>
            <p>${link(key)}</p>
          </article>` : ""}
        ${g.sections.map(sec => {
          const its = sec.items.filter(it => it !== g.sections[0].items[0]);
          return its.length ? `<h2 class="section-title">${esc(sec.title)}</h2><ul class="ticks">${its.map(it => `<li>${TICK}<span>${link(it)}</span></li>`).join("")}</ul>` : "";
        }).join("")}
        ${related.length ? `<h2 class="section-title">מי יכול לעזור עם זה</h2><div class="grid">${related.map(s => card(s)).join("")}</div>` : ""}
        <p class="lead" style="margin-top: 18px">כל סעיף מקושר למקור שלו. זה לא ייעוץ משפטי.</p>
      </section>`;
  }

  function viewHelp() {
    const lines = [
      { name: "נפש אחת", what: "משרד הביטחון · 24/7 · גם בלי הכרה", num: "*8944" },
      { name: "ער״ן", what: "24/7 · אפשר גם בוואטסאפ", num: "1201" },
      { name: "נט״ל", what: "טראומה על רקע לאומי · 24/7", num: "*3362" }
    ];
    $main.innerHTML = `
      <section class="help">
        <p class="note">אף אחד לא רואה שנכנסת לכאן</p>
        <h1>רגע. נושמים ביחד.</h1>
        <div class="breath" aria-hidden="true">
          <span class="blob"></span>
          <svg viewBox="0 0 210 210" fill="none"><path d="M105 8 C 160 6, 204 48, 202 104 C 200 160, 158 204, 104 202 C 50 200, 8 158, 10 104 C 12 52, 54 10, 108 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          <span class="phase" id="phase">שאיפה</span>
        </div>
        <p class="lead" style="text-align: center">שאיפה 4 · עצירה 4 · נשיפה 6</p>
        <h2 class="section-title">לדבר עם מישהו, עכשיו</h2>
        <ul class="lines">
          ${lines.map(l => `<li><a href="tel:${l.num}"><span><span class="name">${l.name}</span><span class="what">${l.what}</span></span><span class="num">${l.num}</span></a></li>`).join("")}
        </ul>
        <p class="emergency">אם יש סכנה מיידית: מד״א <a href="tel:101">101</a> · משטרה <a href="tel:100">100</a></p>
        <p class="actions"><a class="link-u" href="#/browse?cat=hotlines">כל קווי הסיוע</a></p>
      </section>`;
    // הכיתוב מתחלף עם הנשימה (4 שאיפה, 4 עצירה, 6 נשיפה = 14 שניות, כמו האנימציה)
    const el = document.getElementById("phase");
    const seq = [["שאיפה", 4000], ["עצירה", 4000], ["נשיפה", 6000]];
    let i = 0;
    const tick = () => {
      if (!document.body.contains(el)) return;
      el.textContent = seq[i][0];
      setTimeout(tick, seq[i][1]);
      i = (i + 1) % seq.length;
    };
    tick();
  }

  function viewProvider() {
    const cats = Object.keys(T.categories).filter(k => k !== "hotlines");
    $main.innerHTML = `
      <section class="form-page">
        <h1 class="page-title">הצטרפות ללוח</h1>
        <p class="lead">חוות, עמותות, מטפלים, סטודיואים, מועדוני גלישה וכל מי שמציע משהו שיכול לעזור. אחרי בדיקה קצרה ההצעה תופיע במאגר, ופניות של מתעניינים יועברו אליכם.</p>
        <form id="prov" class="form">
          <label>שם הגוף / התוכנית *<input name="name" required maxlength="120"></label>
          <label>תחום *
            <select name="category" required>${cats.map(k => `<option value="${k}">${esc(T.categories[k].label)}</option>`).join("")}</select>
          </label>
          <label>מה אתם מציעים, בפועל? *<textarea name="description" required maxlength="1200" rows="5" placeholder="למשל: מפגש שבועי של גלישה בקבוצה קטנה, 8 מפגשים, כולל ציוד ומדריך עם הכשרה בטראומה."></textarea></label>
          <fieldset><legend>למי זה מתאים?</legend><div class="chips">${Object.keys(T.eligibility).map(k => chip("eligibility", k, T.eligibility[k])).join("")}</div></fieldset>
          <fieldset><legend>במה זה עוזר?</legend><div class="chips">${Object.keys(T.difficulties).map(k => chip("difficulties", k, T.difficulties[k])).join("")}</div></fieldset>
          <fieldset><legend>תחומי עניין</legend><div class="chips">${Object.keys(T.interests).map(k => chip("interests", k, T.interests[k])).join("")}</div></fieldset>
          <fieldset><legend>אזור</legend><div class="chips">${Object.keys(T.regions).map(k => chip("regions", k, T.regions[k])).join("")}</div></fieldset>
          <div class="row">
            <label>עלות *
              <select name="cost" required>${Object.keys(T.cost).map(k => `<option value="${k}">${esc(T.cost[k].label)}</option>`).join("")}</select>
            </label>
            <label>פירוט עלות<input name="cost_notes" maxlength="200" placeholder="למשל: 50 ש״ח למפגש, חינם למילואימניקים"></label>
          </div>
          <label>כתובת / יישוב<input name="location" maxlength="150"></label>
          <div class="row">
            <label>טלפון<input name="phone" type="tel" maxlength="30"></label>
            <label>אימייל לפניות *<input name="email" type="email" required maxlength="120"></label>
          </div>
          <label>אתר / עמוד פייסבוק / אינסטגרם<input name="website" maxlength="300"></label>
          <label>איך מצטרפים?<textarea name="how_to_apply" rows="2" maxlength="500"></textarea></label>
          <label>איש/אשת קשר ותפקיד *<input name="contact_person" required maxlength="120"></label>
          <label class="check"><input type="checkbox" name="agree" required> אני מאשר/ת שהפרטים נכונים, ושפרטי הגוף יוצגו לציבור באתר.</label>
          <button class="btn btn-ink" type="submit">שליחה לבדיקה</button>
          <p class="form-msg" id="prov-msg" role="status"></p>
        </form>
      </section>`;
    const f = document.getElementById("prov");
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f);
      const rec = {};
      ["name", "category", "description", "cost", "cost_notes", "location", "phone", "email", "website", "how_to_apply", "contact_person"]
        .forEach(k => rec[k] = (fd.get(k) || "").toString().trim());
      ["eligibility", "difficulties", "interests", "regions"].forEach(k => rec[k] = fd.getAll(k));
      rec.provider_type = "private";
      rec.status = "pending";
      const msg = document.getElementById("prov-msg");
      try {
        await Store.addSubmission(rec);
        f.reset();
        msg.textContent = "תודה! ההצעה התקבלה ותיבדק בקרוב.";
      } catch (err) {
        msg.textContent = "משהו השתבש בשליחה. נסו שוב מאוחר יותר.";
      }
    });
  }

  async function viewAdmin() {
    if (!Store.isAdminReady()) {
      $main.innerHTML = `
        <section class="form-page">
          <h1 class="page-title">כניסת מנהלים</h1>
          <form id="login" class="form">
            <label>אימייל<input name="email" type="email" required></label>
            <label>סיסמה<input name="password" type="password" required></label>
            <button class="btn btn-ink">כניסה</button>
            <p class="form-msg" id="login-msg"></p>
          </form>
        </section>`;
      document.getElementById("login").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try { await Store.signIn(fd.get("email"), fd.get("password")); viewAdmin(); }
        catch (err) { document.getElementById("login-msg").textContent = "כניסה נכשלה."; }
      });
      return;
    }
    $main.innerHTML = `<section><h1 class="page-title">ניהול</h1><p>טוען…</p></section>`;
    let leads = [], subs = [];
    try { [leads, subs] = await Promise.all([Store.listLeads(), Store.listSubmissions()]); }
    catch (e) { $main.innerHTML = `<section><h1 class="page-title">ניהול</h1><p>אין הרשאה לצפות בנתונים. ודאו שהמשתמש מוגדר כמנהל (ראו README).</p></section>`; return; }
    leads.sort((a, b) => b.createdAt - a.createdAt);
    subs.sort((a, b) => b.createdAt - a.createdAt);
    const byId = Object.fromEntries(SERVICES.map(s => [s.id, s]));
    const pending = subs.filter(s => !s.status || s.status === "pending");
    const fmt = t => new Date(t).toLocaleString("he-IL");
    $main.innerHTML = `
      <section>
        <h1 class="page-title">ניהול</h1>
        ${Store.mode === "local" ? `<div class="callout callout-info">מצב הדגמה: הנתונים כאן נשמרו רק בדפדפן הזה. כדי לקבל פניות אמיתיות מחברים את Firebase (ראו README).</div>` : ""}
        <h2>הצעות של גופים שממתינות לאישור (${pending.length})</h2>
        <div class="admin-list">
          ${pending.map(s => `
            <div class="admin-item">
              <strong>${esc(s.name)}</strong> · ${esc(catLabel(s.category))} · ${esc(costLabel(s.cost))}
              <p>${esc(s.description)}</p>
              <small>${esc(s.contact_person)} · ${esc(s.email)} · ${esc(s.phone)} · ${esc(s.website)} · ${fmt(s.createdAt)}</small>
              <div class="actions">
                <button class="btn btn-ink" data-approve="${esc(s._id)}">אישור ופרסום</button>
                <button class="btn" data-reject="${esc(s._id)}">דחייה</button>
              </div>
            </div>`).join("") || "<p>אין הצעות ממתינות.</p>"}
        </div>
        <h2>פניות של מטופלים (${leads.length})</h2>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>תאריך</th><th>שירות</th><th>שם</th><th>יצירת קשר</th><th>הודעה</th><th>סטטוס</th></tr></thead>
            <tbody>
              ${leads.map(l => `
                <tr>
                  <td>${fmt(l.createdAt)}</td>
                  <td>${esc((byId[l.serviceId] || {}).name || l.serviceName || l.serviceId)}</td>
                  <td>${esc(l.name)}</td>
                  <td>${esc(l.contact)}</td>
                  <td>${esc(l.message)}</td>
                  <td><select data-lead="${esc(l._id)}">
                    ${["new", "forwarded", "done"].map(st => `<option value="${st}" ${((l.status || "new") === st) ? "selected" : ""}>${{ new: "חדשה", forwarded: "הועברה לגוף", done: "טופלה" }[st]}</option>`).join("")}
                  </select></td>
                </tr>`).join("") || `<tr><td colspan="6">אין פניות עדיין.</td></tr>`}
            </tbody>
          </table>
        </div>
        <p><button class="btn" id="csv">ייצוא פניות ל-CSV</button></p>
      </section>`;
    $main.querySelectorAll("[data-approve]").forEach(b => b.onclick = async () => {
      await Store.approve(subs.find(s => s._id === b.dataset.approve)); approvedLoaded = false;
      SERVICES = SERVICES.filter(s => s.source !== "provider"); await ensureApproved(); viewAdmin();
    });
    $main.querySelectorAll("[data-reject]").forEach(b => b.onclick = async () => { await Store.reject(b.dataset.reject); viewAdmin(); });
    $main.querySelectorAll("[data-lead]").forEach(sel => sel.onchange = () => Store.markLead(sel.dataset.lead, sel.value));
    document.getElementById("csv").onclick = () => {
      const rows = [["date", "service", "name", "contact", "message", "status"]].concat(leads.map(l =>
        [fmt(l.createdAt), (byId[l.serviceId] || {}).name || l.serviceName || "", l.name, l.contact, l.message || "", l.status || "new"]));
      const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "leads.csv"; a.click();
    };
  }

  // ---------- service card ----------
  function openService(id) {
    const s = SERVICES.find(x => x.id === id);
    if (!s) return;
    const links = [];
    if (s.phone && isMobile(s.phone)) links.push(`<a class="link-u" href="${waHref(s.phone)}" target="_blank" rel="noopener">וואטסאפ</a>`);
    if (s.email) links.push(`<a class="link-u" href="mailto:${esc(s.email)}?subject=${encodeURIComponent("פנייה דרך מגיע לך — " + s.name)}">מייל</a>`);
    if (s.website) links.push(`<a class="link-u" href="${esc(safeUrl(s.website))}" target="_blank" rel="noopener">לאתר</a>`);
    links.push(`<button class="link-u" type="button" id="lead-toggle">שיחזרו אליי</button>`);
    const who = arr(s.eligibility).map(k => T.eligibility[k]).filter(Boolean);
    const helps = arr(s.difficulties).map(k => T.difficulties[k]).filter(Boolean);
    $modalBody.innerHTML = `
      <div class="svc">
        <div class="tag-row" style="margin-top: 12px">
          ${areaTag(s)}<span class="cost-tag">${esc(costLabel(s.cost))}</span>
          <span class="verify">${s.verified_at ? "✓ נבדק מול האתר של הגוף, " + esc(s.verified_at) : "עוד לא נבדק מול האתר של הגוף. כדאי לוודא איתם."}</span>
        </div>
        <h2 id="modal-title">${esc(s.name)}</h2>
        <p class="desc">${esc(s.description)}</p>
        ${s.cost_notes ? `<p class="desc"><span class="highlight area-${areaOf(s.category)}">${esc(s.cost_notes)}</span></p>` : ""}
        ${who.length ? `<h3>למי זה</h3><ul class="ticks">${who.slice(0, 5).map(w => `<li>${TICK}<span>${esc(w)}</span></li>`).join("")}</ul>` : ""}
        ${helps.length ? `<h3>במה זה עוזר</h3><p>${esc(helps.join(" · "))}</p>` : ""}
        ${s.how_to_apply ? `<h3>איך מתחילים</h3><p>${esc(s.how_to_apply)}</p>` : ""}
        ${s.location ? `<h3>איפה</h3><p>${esc(s.location)}${arr(s.regions).length ? " · " + esc(arr(s.regions).map(r => T.regions[r]).join(", ")) : ""}</p>` : ""}
        <div class="contact">
          ${s.phone ? `<a class="btn btn-ink btn-wide" href="${telHref(s.phone)}">להתקשר <span dir="ltr">${esc(firstPhone(s.phone))}</span></a>` : ""}
          <div class="links">${links.join("")}</div>
        </div>
        <form id="lead" class="form lead-form" hidden>
          <p class="note">נעביר לגוף, והם יחזרו אליך. לא חובה לספר יותר ממה שנוח.</p>
          <label>שם<input name="name" required maxlength="80"></label>
          <label>טלפון או מייל<input name="contact" required maxlength="120"></label>
          <label>משהו שחשוב שידעו? (לא חובה)<textarea name="message" rows="2" maxlength="600"></textarea></label>
          <label class="check"><input type="checkbox" name="consent" required> אני מסכים/ה שהפרטים יועברו ל${esc(s.name)} רק כדי ליצור איתי קשר.</label>
          <button class="btn btn-ink">לשלוח</button>
          <p class="form-msg" role="status"></p>
        </form>
        ${s.source_url ? `<p class="source">מקור: <a href="${esc(safeUrl(s.source_url))}" target="_blank" rel="noopener">${esc(s.source_url.replace(/^https?:\/\//, "").slice(0, 60))}</a></p>` : ""}
      </div>`;
    $modal.hidden = false;
    document.body.classList.add("no-scroll");
    $modal.querySelector(".modal-x").focus();
    const f = document.getElementById("lead");
    document.getElementById("lead-toggle").onclick = () => { f.hidden = !f.hidden; if (!f.hidden) f.querySelector("input").focus(); };
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f);
      const msg = f.querySelector(".form-msg");
      try {
        await Store.addLead({
          serviceId: s.id, serviceName: s.name, serviceEmail: s.email || "",
          name: fd.get("name").trim(), contact: fd.get("contact").trim(),
          message: (fd.get("message") || "").trim(), consent: true, status: "new"
        });
        f.querySelectorAll("input,textarea,button").forEach(x => x.disabled = true);
        msg.textContent = "הפנייה נשלחה. אם לא חזרו אליך תוך כמה ימים, אפשר גם להתקשר ישירות.";
      } catch (err) {
        msg.textContent = "השליחה לא הצליחה. אפשר להתקשר ישירות.";
      }
    });
  }
  function closeModal() {
    $modal.hidden = true;
    document.body.classList.remove("no-scroll");
  }
  $modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$modal.hidden) closeModal();
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.open) openService(e.target.dataset.open);
  });
  $main.addEventListener("click", e => {
    const c = e.target.closest("[data-open]");
    if (c) openService(c.dataset.open);
  });

  // ---------- router ----------
  async function route() {
    closeModal();
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    const params = new URLSearchParams(qs || "");
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", path === "/" + a.dataset.nav || (a.dataset.nav === "" && path === "/area")));
    await ensureApproved();
    if (path === "/match") viewMatch();
    else if (path === "/results") viewResults();
    else if (path === "/browse") viewBrowse(params);
    else if (path === "/rights") viewRights(params);
    else if (path === "/area") viewArea(params);
    else if (path === "/help") viewHelp();
    else if (path === "/provider") viewProvider();
    else if (path === "/admin") viewAdmin();
    else viewHome();
    if (!qs || path !== "/browse") window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  // מצב עמום: נשמר רק במכשיר. בלי בחירה, האתר עוקב אחרי הגדרת המכשיר.
  const THEME_KEY = "vh-theme";
  const dimBtn = document.getElementById("dim-toggle");
  const applyTheme = t => {
    if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
    const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    if (dimBtn) dimBtn.setAttribute("aria-pressed", String(dark));
  };
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ }
  applyTheme(savedTheme);
  if (dimBtn) dimBtn.onclick = () => {
    const next = dimBtn.getAttribute("aria-pressed") === "true" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage blocked */ }
  };
  document.getElementById("store-mode").textContent = Store.mode === "cloud" ? "מחובר לענן" : "מצב הדגמה (ללא שרת)";
  document.getElementById("data-stamp").textContent = window.SERVICES_UPDATED ? "המאגר עודכן: " + window.SERVICES_UPDATED : "";
  Store.onAuth(() => { if (location.hash.startsWith("#/admin")) route(); });
  route();
})();
