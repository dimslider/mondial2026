(function () {
  const T = window.TAXONOMY;
  const $main = document.getElementById("main");
  const $modal = document.getElementById("modal");
  const $modalBody = document.getElementById("modal-body");
  const PROFILE_KEY = "vh-profile-v1";
  // בתוך מסגרת (iframe) הדפדפן לא תמיד מאפשר להדפיס, אז לא מציגים את הכפתור
  const canPrint = (() => { try { return window.self === window.top; } catch (e) { return false; } })();

  let SERVICES = (window.SERVICES || []).map(s => Object.assign({ source: "research" }, s));
  let liveLoaded = false;

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

  // מה שאושר בשרת: מקומות שהקהילה הוסיפה, תיקונים לשירותים קיימים, והמלצות ("ממליץ/ה")
  async function ensureLive() {
    if (liveLoaded) return;
    liveLoaded = true;
    const L = await Store.live();
    L.services.forEach(x => { x.source = "community"; SERVICES.push(x); });
    for (const [id, patch] of Object.entries(L.overrides)) {
      const t = SERVICES.find(x => x.id === id);
      if (t) Object.assign(t, patch);
    }
    for (const [id, n] of Object.entries(L.recs)) {
      const t = SERVICES.find(x => x.id === id);
      if (t) t.community_recs = (Number(t.community_recs) || 0) + n;
    }
    const mode = document.getElementById("store-mode");
    if (mode) mode.textContent = Store.mode === "cloud" ? "" : "מצב הדגמה: מה ששולחים נשמר רק במכשיר";
  }

  // הגנה מספאם (Cloudflare Turnstile). בלי מפתח או בלי שרת, מחזיר טוקן ריק.
  let tsScript = null;
  function captcha(el) {
    const key = (window.APP_CONFIG || {}).turnstileSiteKey;
    if (!key || Store.mode !== "cloud" || !el) return Promise.resolve(() => "");
    tsScript = tsScript || new Promise((ok, fail) => {
      const sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      sc.onload = ok; sc.onerror = fail;
      document.head.appendChild(sc);
    });
    return tsScript.then(() => {
      const w = window.turnstile.render(el, { sitekey: key, language: "he", appearance: "interaction-only" });
      return () => window.turnstile.getResponse(w) || "";
    }).catch(() => () => "");
  }
  const sendError = err => err && err.code === "rate" ? "שלחת הרבה הודעות היום. אפשר לנסות שוב מחר."
    : err && err.code === "captcha" ? "לא הצלחנו לוודא שזה לא רובוט. נסו לרענן את העמוד."
    : "השליחה לא הצליחה. נסו שוב בעוד רגע.";

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
    if (starred(s)) { sc += 1; why.push("מומלץ בקהילה"); }
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
  // כוכב: כמה הודעות המלצה היו עליו בקבוצת הנכים והלוחמים (מינימום 3, ורק כשההמלצות רבות מהתלונות)
  const STAR_MIN = 3;
  const starred = s => (s.community_recs || 0) >= STAR_MIN;
  const STAR = `<svg class="star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 C 12.8 7, 14 9.6, 21.5 10.2 C 16 13, 15.6 15, 17.6 21.5 C 13.8 18, 10.4 18, 6.4 21.5 C 8.4 15, 8 13, 2.5 10.2 C 10 9.6, 11.2 7, 12 2.5 Z"/></svg>`;
  const starTag = s => starred(s) ? `<span class="star-tag">${STAR}מומלץ בקהילה</span>` : "";
  const shortDesc = (t, n) => (t || "").length > n ? (t || "").slice(0, n).replace(/\s+\S*$/, "") + "…" : (t || "");

  function chip(group, key, label, checked) {
    return `<label class="chip"><input type="checkbox" name="${group}" value="${esc(key)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  // שורה קצרה ברשימה: שם, משפט פתיחה בשורה אחת, ושורת פרטים. כל השאר בכרטיס שנפתח.
  function card(s, why, noTag) {
    const meta = [costLabel(s.cost), ...arr(s.regions).slice(0, 1).map(r => T.regions[r] || r)];
    if (s.source === "community") meta.push("נוסף ע״י הקהילה");
    else if (s.verified_at) meta.push("✓ נבדק");
    return `
      <article class="card" data-open="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}">
        <div class="card-main">
          <h3>${esc(s.name)}</h3>
          <p class="teaser">${esc(shortDesc(s.description, 110))}</p>
          ${why && why.length ? `<span class="why">← ${esc(why[0])}</span>` : ""}
          <span class="meta-line">${starTag(s)}${noTag ? "" : areaTag(s)}${esc(meta.join(" · "))}</span>
        </div>
        <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M15 4 C 11 8, 9 10, 8 12 C 10 14, 12 17, 15 20"/></svg>
      </article>`;
  }
  // רשימה שנפתחת בהדרגה: מציגים כמה, והשאר בלחיצה על "עוד"
  const PAGE = 8;
  function pagedList(el, items, render) {
    let shown = PAGE;
    const draw = () => {
      el.innerHTML = items.slice(0, shown).map(render).join("") +
        (items.length > shown ? `<button class="more-btn" type="button">עוד ${Math.min(PAGE * 2, items.length - shown)} מתוך ${items.length - shown}</button>` : "");
      const b = el.querySelector(".more-btn");
      if (b) b.onclick = () => { shown += PAGE * 2; draw(); };
    };
    draw();
  }

  // ---------- views ----------
  function viewHome() {
    const prof = loadProfile();
    const counts = {};
    SERVICES.forEach(s => { const a = areaOf(s.category); counts[a] = (counts[a] || 0) + 1; });
    $main.innerHTML = `
      <section>
        <h1 class="page-title">מה מושך אותך?</h1>
        <p class="lead">לנכי צה״ל, מילואימניקים, לוחמים, שוטרים ולמי שעוד לא הוכר.</p>
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
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>מכירים מקום שעוזר ולא מופיע כאן?</strong><br>להוסיף בדקה. ככה המאגר גדל.</span></a>
        ${prof ? `<p class="saved-link"><a class="link-u" href="#/results">לתחנות שלי ←</a></p>` : ""}
        <p class="note quiet">בלי הרשמה. מה שמסמנים נשאר רק במכשיר.</p>
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
    const cats = A.cats.filter(c => c !== "hotlines" && rest.some(s => s.category === c));
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
            ${starTag(top)}
            <h2>${esc(top.name)}</h2>
            <p class="clamp-2">${esc(shortDesc(top.description, 140))}</p>
            <div class="actions">
              <button class="btn btn-ink" type="button" data-open="${esc(top.id)}">לפרטים וליצירת קשר</button>
            </div>
          </article>` : `<p class="empty">עוד אין כאן שירותים. אפשר <a href="#/provider">להציע גוף</a>.</p>`}
        ${cats.length > 1 ? `<nav class="subcats" aria-label="סינון">
          <button type="button" class="active" data-cat="">הכל</button>
          ${cats.map(c => `<button type="button" data-cat="${c}">${esc(SHORT_CAT[c] || catLabel(c))}</button>`).join("")}
        </nav>` : ""}
        <div class="grid" id="area-list" style="margin-top: 6px"></div>
        ${!p ? `<p class="actions"><a class="link-u" href="#/match">לסדר לפי מה שמתאים לי ←</a></p>` : ""}
        <a class="add-row" href="#/add?a=${k}"><span class="plus" aria-hidden="true">+</span><span><strong>חסר כאן משהו?</strong><br>להוסיף מקום ל${esc(A.label)}</span></a>
      </section>`;
    const list = document.getElementById("area-list");
    const show = c => pagedList(list, rest.filter(s => !c || s.category === c), s => card(s, null, true));
    show("");
    $main.querySelectorAll(".subcats button").forEach(b => b.onclick = () => {
      $main.querySelectorAll(".subcats button").forEach(x => x.classList.toggle("active", x === b));
      show(b.dataset.cat);
    });
  }
  const SHORT_CAT = { "rehab-farm": "חוות", "animal-therapy": "בעלי חיים", "nature-retreats": "טבע ומסעות", "sports": "ספורט",
    "yoga-mind-body": "יוגה וגוף-נפש", "medical-rehab": "שיקום רפואי", "mental-health": "טיפול", "peer-support": "עמיתים",
    "art-music": "יצירה", "family-support": "משפחה", "housing-daily": "דיור ויומיום", "community-volunteer": "קהילה",
    "rights-legal": "זכויות", "financial-grants": "מענקים", "employment-education": "עבודה ולימודים" };

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
                <div class="tag-row">${starTag(s)}${areaTag(s)}<span class="cost-tag">${esc(costLabel(s.cost))}</span></div>
                <h2 data-open="${esc(s.id)}" tabindex="0" role="button">${esc(s.name)}</h2>
                <p class="clamp-2">${esc(shortDesc(s.description, 120))}</p>
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
              <div class="grid" data-area-list="${a}"></div>
            </details>`).join("")}
        </section>` : ""}`;
    $main.querySelectorAll("[data-area-list]").forEach(el => pagedList(el, byArea[el.dataset.areaList],
      r => card(r.s, r.why.filter(w => w !== "מתאים לסטטוס שלך"), true)));
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
    // מחפשים רק בתחילת מילה (מותר לפניה ה/ב/ל/ו/מ/כ; בלי ש, אחרת "חווה" נמצא ב"שחווה"), כדי ש"חוות" לא יימצא באמצע מילה אחרת
    const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const has = (text, f) => new RegExp(`(^|[^א-תa-z0-9])(ו|ה|ב|ל|מ|כ|וה|בה|לה|מה|וב|ול)?${escRe(f)}` + (f.length <= 2 ? "([^א-תa-z]|$)" : "")).test(text);
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
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>לא מצאת?</strong><br>להוסיף מקום או שירות</span></a>
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
      const list = document.getElementById("list");
      if (out.length) pagedList(list, out, s => card(s)); else list.innerHTML = `<p class="empty">אין תוצאות. נסו חיפוש אחר.</p>`;
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
    // כל סעיף סגור: רואים כותרת קצרה, ופותחים כדי לקרוא. כותרת = מה שלפני הנקודתיים, או המשפט הראשון.
    const split = t => {
      const c = t.indexOf(":");
      if (c > 0 && c < 70) return [t.slice(0, c), t.slice(c + 1).trim()];
      const m = t.match(/^(.{12,80}?[.!?])\s+(.+)$/);
      return m ? [m[1].replace(/\.$/, ""), m[2]] : [t, ""];
    };
    const src = it => it.url ? `<a class="link-u src" href="${esc(it.url)}" target="_blank" rel="noopener">למקור ←</a>` : "";
    const fold = it => {
      const [h, b] = split(it.text);
      if (!b) return `<li class="fold-flat">${TICK}<span>${esc(h)} ${src(it)}</span></li>`;
      return `<li><details class="fold"><summary>${TICK}<span>${esc(h)}</span></summary><p>${esc(b)} ${src(it)}</p></details></li>`;
    };
    const related = SERVICES.filter(s => ["rights-legal", "financial-grants"].includes(s.category) && eligible(s, [k])).slice(0, 5);
    $main.innerHTML = `
      <section class="area-soul">
        <h1 class="big-word">מה מגיע לי</h1>
        <nav class="status-pick" aria-label="הסטטוס שלי">
          ${keys.map(x => `<a href="#/rights?s=${x}" class="${x === k ? "active" : ""}" ${x === k ? 'aria-current="page"' : ""}>${esc(G[x].title)}</a>`).join("")}
        </nav>
        <p class="guide-intro clamp-3" id="g-intro" role="button" tabindex="0" title="להרחבה">${esc(g.intro)}</p>
        ${key ? `
          <article class="sheet key-right">
            <span class="area-tag badge">הכי חשוב</span>
            <p class="clamp-3" id="key-text" role="button" tabindex="0">${esc(key.text)}</p>
            <p>${src(key)}</p>
          </article>` : ""}
        ${g.sections.map(sec => {
          const its = sec.items.filter(it => it !== g.sections[0].items[0]);
          return its.length ? `<h2 class="section-title">${esc(sec.title)}</h2><ul class="ticks folds">${its.map(fold).join("")}</ul>` : "";
        }).join("")}
        ${related.length ? `<h2 class="section-title">מי יכול לעזור עם זה</h2><div class="grid">${related.map(s => card(s, null, true)).join("")}</div>` : ""}
        <p class="note quiet" style="margin-top: 18px">כל סעיף מקושר למקור שלו. זה לא ייעוץ משפטי.</p>
      </section>`;
    const intro = document.getElementById("g-intro");
    intro.onclick = () => intro.classList.remove("clamp-3");
    const kt = document.getElementById("key-text");
    if (kt) kt.onclick = () => kt.classList.remove("clamp-3");
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

  // ---------- להוסיף מקום ----------
  // טופס קצר, בעיקר בלחיצות. נכנס לתור של המנהל, ואחרי אישור מופיע אצל כולם.
  function radioChip(group, key, label, checked) {
    return `<label class="chip"><input type="radio" name="${group}" value="${esc(key)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  function viewAdd(params) {
    const pre = AREAS[params.get("a")] ? AREAS[params.get("a")].cats : [];
    const cats = Object.keys(T.categories);
    const COSTS = { free: "ללא עלות", "mod-funded": "במימון משרד הביטחון", partial: "השתתפות חלקית", paid: "בתשלום", "": "לא יודע/ת" };
    $main.innerHTML = `
      <section class="form-page add-page">
        <h1 class="page-title">להוסיף מקום</h1>
        <p class="lead">עמותה, חווה, קבוצה, מטפל/ת דרך גוף, פעילות, מענק. כל דבר שעזר לך או למישהו שאת/ה מכיר/ה. אנחנו בודקים ומוסיפים.</p>
        <form id="add" class="form" novalidate>
          <label class="big">איך קוראים לזה? *<input name="name" required maxlength="120" autocomplete="off" placeholder="למשל: חוות הגליל לוחמים"></label>
          <fieldset><legend>באיזה תחום?</legend>
            <div class="chips small">${cats.map(k => radioChip("category", k, SHORT_CAT[k] || (k === "hotlines" ? "קו סיוע" : catLabel(k)), pre[0] === k)).join("")}</div>
          </fieldset>
          <label>מה עושים שם, במשפט או שניים<textarea name="what" rows="3" maxlength="800"></textarea></label>
          <fieldset><legend>איפה?</legend>
            <div class="chips small">${Object.keys(T.regions).map(k => chip("regions", k, T.regions[k])).join("")}</div>
          </fieldset>
          <fieldset><legend>כמה זה עולה?</legend>
            <div class="chips small">${Object.keys(COSTS).map(k => radioChip("cost", k, COSTS[k], k === "")).join("")}</div>
          </fieldset>
          <div class="row">
            <label>אתר או עמוד<input name="website" maxlength="300" inputmode="url" placeholder="קישור"></label>
            <label>טלפון של הגוף<input name="phone" type="tel" maxlength="40"></label>
          </div>
          <fieldset><legend>מה הקשר שלך?</legend>
            <div class="chips small">${radioChip("relation", "used", "הייתי שם / נעזרתי", true)}${radioChip("relation", "staff", "אני עובד/ת שם")}${radioChip("relation", "heard", "שמעתי עליו")}</div>
          </fieldset>
          <label class="check star-check"><input type="checkbox" name="recommend"> ${STAR} אני ממליץ/ה בחום</label>
          <details class="fold more-fields"><summary>עוד פרטים (לא חובה)</summary>
            <label>למי זה מתאים, תנאים, איך נרשמים<textarea name="notes" rows="3" maxlength="800"></textarea></label>
            <label>כתובת / יישוב<input name="location" maxlength="120"></label>
            <label>אם נרצה לשאול משהו: טלפון או מייל שלך<input name="contact" maxlength="120"></label>
          </details>
          <div class="ts" id="add-ts"></div>
          <button class="btn btn-ink btn-wide" type="submit">לשלוח</button>
          <p class="form-msg" id="add-msg" role="status"></p>
        </form>
        <p class="note quiet">לא מפרסמים את הפרטים שלך. מה ששלחת נבדק לפני שמופיע במאגר.</p>
      </section>`;
    const f = document.getElementById("add");
    const msg = document.getElementById("add-msg");
    let token = () => "";
    captcha(document.getElementById("add-ts")).then(g => { token = g; });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f);
      const name = (fd.get("name") || "").trim();
      if (name.length < 2) { msg.textContent = "צריך לפחות שם."; f.name.focus(); return; }
      const data = { name, recommend: !!fd.get("recommend"), regions: fd.getAll("regions") };
      ["category", "what", "cost", "website", "phone", "relation", "notes", "location", "contact"].forEach(k => data[k] = (fd.get(k) || "").toString().trim());
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const r = await Store.submit("new", data, { token: token() });
        f.innerHTML = `<div class="sheet thanks"><h2>תודה!</h2><p>${r.local ? "נשמר במכשיר (מצב הדגמה, עוד אין שרת)." : "קיבלנו. אחרי בדיקה קצרה זה יופיע במאגר לכולם."}</p>
          <p class="actions"><a class="btn" href="#/add">להוסיף עוד מקום</a> <a class="link-u" href="#/">לדף הבית</a></p></div>`;
      } catch (err) {
        btn.disabled = false;
        msg.textContent = sendError(err);
      }
    });
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
          <span class="verify">${s.verified_at ? "✓ נבדק " + esc(s.verified_at) : "עוד לא נבדק. כדאי לוודא איתם."}</span>
        </div>
        <h2 id="modal-title">${esc(s.name)}</h2>
        ${starred(s) ? `<p class="community">${STAR}<span><strong>${s.community_recs} המלצות בקבוצת הנכים והלוחמים</strong>${s.community_note ? " · " + esc(s.community_note) : ""}</span></p>` : ""}
        <p class="desc clamp-3" id="svc-desc">${esc(s.description)}</p>
        ${(s.description || "").length > 150 ? `<button class="link-u read-more" type="button" id="svc-more">לקרוא עוד</button>` : ""}
        ${s.cost_notes ? `<p class="desc"><span class="highlight area-${areaOf(s.category)}">${esc(s.cost_notes)}</span></p>` : ""}
        <div class="contact">
          ${s.phone ? `<a class="btn btn-ink btn-wide" href="${telHref(s.phone)}">להתקשר <span dir="ltr">${esc(firstPhone(s.phone))}</span></a>` : ""}
          <div class="links">${links.join("")}</div>
        </div>
        <div class="folds-svc">
          ${s.how_to_apply ? `<details class="fold" open><summary>איך מתחילים</summary><p>${esc(s.how_to_apply)}</p></details>` : ""}
          ${who.length ? `<details class="fold"><summary>למי זה</summary><p>${esc(who.slice(0, 6).join(" · "))}</p></details>` : ""}
          ${helps.length ? `<details class="fold"><summary>במה זה עוזר</summary><p>${esc(helps.join(" · "))}</p></details>` : ""}
          ${s.location || arr(s.regions).length ? `<details class="fold"><summary>איפה</summary><p>${esc([s.location, arr(s.regions).map(r => T.regions[r]).join(", ")].filter(Boolean).join(" · "))}</p></details>` : ""}
        </div>
        <div class="svc-community">
          <button class="chip-btn" type="button" id="rec-btn" aria-pressed="${Store.hasRecommended(s.id)}">${STAR}<span>${Store.hasRecommended(s.id) ? "המלצת. תודה" : "ממליץ/ה"}</span></button>
          <button class="chip-btn" type="button" id="fix-toggle">משהו לא נכון? / להוסיף פרט</button>
        </div>
        <form id="fix" class="form lead-form" hidden>
          <label>מה לא נכון, או מה כדאי להוסיף?<textarea name="text" rows="3" maxlength="1000" required placeholder="למשל: הטלפון השתנה, יש המתנה של חודשיים, זה פתוח גם למי שלא מוכר"></textarea></label>
          <label>אם נרצה לשאול משהו: טלפון או מייל (לא חובה)<input name="contact" maxlength="120"></label>
          <div class="ts" id="fix-ts"></div>
          <button class="btn btn-ink">לשלוח</button>
          <p class="form-msg" role="status"></p>
        </form>
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
    const more = document.getElementById("svc-more");
    if (more) more.onclick = () => { document.getElementById("svc-desc").classList.remove("clamp-3"); more.remove(); };
    const f = document.getElementById("lead");
    document.getElementById("lead-toggle").onclick = () => {
      f.hidden = !f.hidden;
      if (!f.hidden) {
        f.querySelector("input").focus();
        if (!f.querySelector(".ts")) { const d = document.createElement("div"); d.className = "ts"; f.querySelector("button").before(d); captcha(d).then(g => { leadToken = g; }); }
      }
    };
    let leadToken = null;
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f);
      const msg = f.querySelector(".form-msg");
      try {
        await Store.submit("lead", {
          serviceName: s.name, name: fd.get("name").trim(), contact: fd.get("contact").trim(),
          message: (fd.get("message") || "").trim(), consent: true
        }, { service_id: s.id, token: leadToken ? leadToken() : "" });
        f.querySelectorAll("input,textarea,button").forEach(x => x.disabled = true);
        msg.textContent = "הפנייה נשלחה. אם לא חזרו אליך תוך כמה ימים, אפשר גם להתקשר ישירות.";
      } catch (err) {
        msg.textContent = sendError(err) + " אפשר גם להתקשר ישירות.";
      }
    });
    // המלצה בלחיצה אחת
    const rec = document.getElementById("rec-btn");
    rec.onclick = async () => {
      if (Store.hasRecommended(s.id)) return;
      rec.disabled = true;
      try {
        await Store.recommend(s.id);
        s.community_recs = (Number(s.community_recs) || 0) + 1;
        rec.setAttribute("aria-pressed", "true");
        rec.querySelector("span").textContent = "המלצת. תודה";
      } catch (err) { rec.querySelector("span").textContent = "לא נשמר, נסו שוב"; }
      rec.disabled = false;
    };
    // תיקון או פרט נוסף
    const fx = document.getElementById("fix");
    let fixToken = null;
    document.getElementById("fix-toggle").onclick = () => {
      fx.hidden = !fx.hidden;
      if (!fx.hidden) {
        fx.querySelector("textarea").focus();
        if (!fixToken) captcha(document.getElementById("fix-ts")).then(g => { fixToken = g; });
      }
    };
    fx.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(fx);
      const msg = fx.querySelector(".form-msg");
      const text = (fd.get("text") || "").trim();
      if (text.length < 3) { msg.textContent = "כתבו כמה מילים."; return; }
      try {
        await Store.submit("fix", { text, contact: (fd.get("contact") || "").trim() }, { service_id: s.id, token: fixToken ? fixToken() : "" });
        fx.innerHTML = `<p class="form-msg">תודה! נבדוק ונעדכן.</p>`;
      } catch (err) { msg.textContent = sendError(err); }
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
    await ensureLive();
    if (path === "/match") viewMatch();
    else if (path === "/results") viewResults();
    else if (path === "/browse") viewBrowse(params);
    else if (path === "/rights") viewRights(params);
    else if (path === "/area") viewArea(params);
    else if (path === "/help") viewHelp();
    else if (path === "/add" || path === "/provider") viewAdd(params);
    else if (path === "/admin") { location.href = "admin/"; return; }
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

  document.getElementById("data-stamp").textContent = window.SERVICES_UPDATED ? "המאגר עודכן: " + window.SERVICES_UPDATED : "";
  route();
})();
