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
  function chip(group, key, label, checked) {
    return `<label class="chip"><input type="checkbox" name="${group}" value="${esc(key)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  function card(s, why) {
    const tags = [];
    tags.push(`<span class="tag cost-${esc(s.cost)}">${esc(costLabel(s.cost))}</span>`);
    arr(s.regions).slice(0, 2).forEach(r => tags.push(`<span class="tag">${esc(T.regions[r] || r)}</span>`));
    if (s.source === "provider") tags.push(`<span class="tag tag-new">הצטרף ללוח</span>`);
    else if (s.verified_at) tags.push(`<span class="tag tag-ok">✓ מאומת</span>`);
    return `
      <article class="card" data-open="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}">
        <div class="card-cat">${catIcon(s.category)} ${esc(catLabel(s.category))}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc((s.description || "").slice(0, 170))}${(s.description || "").length > 170 ? "…" : ""}</p>
        ${why && why.length ? `<ul class="why">${why.slice(0, 2).map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
        <div class="tags">${tags.join("")}</div>
      </article>`;
  }
  function hotlinesBlock() {
    const lines = SERVICES.filter(s => s.category === "hotlines" && s.phone);
    if (!lines.length) return "";
    return `
      <section class="hotlines">
        <h2>☎️ קווים פתוחים — אפשר להתקשר גם עכשיו</h2>
        <div class="hotline-grid">
          ${lines.slice(0, 12).map(s => `
            <div class="hotline">
              <div><strong>${esc(s.name)}</strong><small>${esc((s.description || "").slice(0, 80))}</small></div>
              <a class="btn btn-small" href="${telHref(s.phone)}">${esc(s.phone)}</a>
            </div>`).join("")}
        </div>
      </section>`;
  }

  // ---------- views ----------
  function viewHome() {
    const cats = Object.keys(T.categories).filter(k => k !== "hotlines");
    const counts = {};
    SERVICES.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    const prof = loadProfile();
    $main.innerHTML = `
      <section class="hero">
        <h1>כל מה שמגיע לך — במקום אחד.</h1>
        <p class="lead">טיפולים, עמותות, חוות שיקומיות, גלישה, יוגה, מענקים וזכויות — לנכי צה״ל, למילואימניקים, ללוחמים, לשוטרים, וגם למי שעוד לא הוכר במשרד הביטחון.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#/match">${prof ? "לעדכן את ההתאמה שלי" : "מצאו לי מה מתאים (2 דקות)"}</a>
          ${prof ? `<a class="btn" href="#/results">להתאמות שלי</a>` : ""}
          <a class="btn" href="#/browse">לדפדף בכל ${SERVICES.length} השירותים</a>
        </div>
        <p class="note">לא צריך להירשם. מה שתסמנו נשמר רק אצלכם במכשיר.</p>
      </section>

      <section class="notrec">
        <h2>עוד לא מוכר/ת? זה לא אומר שאין לך כלום.</h2>
        <p>הרבה מהשירותים כאן פתוחים בלי הכרה: עמותות, קווי סיוע, קופות החולים, מרכזי חוסן ותוכניות למילואימניקים. וגם במשרד הביטחון יש היום טיפול נפשי שאפשר לקבל עוד לפני שההכרה הסתיימה.</p>
        <a class="link" href="#/rights">מה מגיע לי לפי הסטטוס שלי ←</a>
      </section>

      <section>
        <h2 class="section-title">לפי תחום</h2>
        <div class="cat-grid">
          ${cats.map(k => `
            <a class="cat" href="#/browse?cat=${k}">
              <span class="cat-icon">${T.categories[k].icon}</span>
              <span>${esc(T.categories[k].label)}</span>
              <small>${counts[k] || 0}</small>
            </a>`).join("")}
        </div>
      </section>

      ${hotlinesBlock()}

      <section class="provider-cta">
        <h2>מפעילים חווה, סטודיו, קבוצה או תוכנית?</h2>
        <p>הציעו את עצמכם בלוח. אחרי בדיקה קצרה תופיעו למי שזה יכול לעזור, ופניות יגיעו אליכם.</p>
        <a class="btn btn-primary" href="#/provider">להצטרפות ללוח</a>
      </section>`;
  }

  function viewMatch() {
    const p = loadProfile() || { statuses: [], difficulties: [], interests: [], regions: [], maxCost: null };
    const steps = [
      { key: "statuses", title: "מה המצב שלך?", sub: "אפשר לסמן כמה. זה קובע לאילו שירותים יש לך זכאות.", opts: T.eligibility },
      { key: "difficulties", title: "עם מה הכי קשה עכשיו?", sub: "סמנו מה שמרגיש נכון. אין תשובה לא נכונה.", opts: T.difficulties },
      { key: "interests", title: "מה מדבר אליך?", sub: "דברים שאוהבים, או שתמיד רצית לנסות. לרוב הם הדרך הכי טובה להתחיל.", opts: T.interests },
      { key: "regions", title: "איפה נוח לך?", sub: "שירותים ארציים ואונליין יופיעו תמיד.", opts: T.regions }
    ];
    let idx = 0;
    function render() {
      const st = steps[idx];
      const last = idx === steps.length - 1;
      $main.innerHTML = `
        <section class="wizard">
          <div class="progress" aria-hidden="true"><span style="width:${((idx + 1) / steps.length) * 100}%"></span></div>
          <p class="step-count">שלב ${idx + 1} מתוך ${steps.length}</p>
          <h1>${st.title}</h1>
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
              ${idx > 0 ? `<button type="button" class="btn" id="back">חזרה</button>` : "<span></span>"}
              <button type="submit" class="btn btn-primary">${last ? "הראו לי מה מתאים" : "המשך"}</button>
            </div>
          </form>
        </section>`;
      const form = document.getElementById("step-form");
      form.addEventListener("submit", e => {
        e.preventDefault();
        p[st.key] = [...form.querySelectorAll(`input[name="${st.key}"]:checked`)].map(i => i.value);
        if (last) {
          const mc = form.querySelector('input[name="maxCost"]:checked');
          p.maxCost = mc && mc.value !== "" ? Number(mc.value) : null;
          saveProfile(p);
          location.hash = "#/results";
        } else { idx++; render(); window.scrollTo(0, 0); }
      });
      const back = document.getElementById("back");
      if (back) back.onclick = () => {
        p[st.key] = [...form.querySelectorAll(`input[name="${st.key}"]:checked`)].map(i => i.value);
        idx--; render();
      };
    }
    render();
  }

  function viewResults() {
    const p = loadProfile();
    if (!p) { location.hash = "#/match"; return; }
    const res = match(p);
    const byCat = {};
    res.forEach(r => { (byCat[r.s.category] = byCat[r.s.category] || []).push(r); });
    // סדר הקבוצות לפי שתי ההתאמות הטובות בכל קבוצה, כדי שקבוצה עם התאמה אחת מקרית לא תקפוץ לראש
    const depth = c => byCat[c].slice(0, 2).reduce((t, r) => t + r.sc, 0);
    const order = Object.keys(byCat).sort((a, b) => depth(b) - depth(a));
    // שלושה צעדים ראשונים: ההתאמות הכי טובות, כל אחת מתחום אחר
    const first = [];
    for (const r of res) { if (first.length < 3 && !first.some(f => f.s.category === r.s.category)) first.push(r); }
    const firstIds = new Set(first.map(r => r.s.id));
    const crisis = p.difficulties.some(d => ["ptsd", "depression", "addiction", "moral-injury"].includes(d));
    const gentle = !crisis && p.difficulties.some(d => ["anxiety", "loneliness", "sleep", "anger", "grief"].includes(d));
    const noInput = !p.difficulties.length && !p.interests.length;
    const SHOW = 2;
    const guideKeys = p.statuses.filter(s => window.GUIDES && GUIDES[s]);
    $main.innerHTML = `
      <section class="results-head">
        <h1>${first.length ? "מאיפה להתחיל" : "לא מצאנו התאמה מדויקת"}</h1>
        <p class="lead">${res.length} אפשרויות מתאימות לך. כאן למטה שלוש שכדאי להתחיל מהן, ואחריהן השאר לפי תחום.</p>
        <div class="actions"><a class="btn" href="#/match">לשנות תשובות</a>${canPrint ? ` <button class="btn" id="print">להדפיס / לשמור PDF</button>` : ""}</div>
      </section>
      ${noInput ? `<div class="callout callout-info">כדי שהרשימה תהיה קצרה ומדויקת, כדאי לסמן לפחות קושי אחד או תחום עניין. <a href="#/match">לסמן עכשיו</a></div>` : ""}
      ${gentle ? `<div class="callout callout-soft">כשקשה, לא חייבים להתמודד לבד. אפשר לדבר עם מישהו כבר היום, גם בלילה: ער״ן <a href="tel:1201">1201</a>, נט״ל <a href="tel:*3362">*3362</a>, נפש אחת <a href="tel:*8944">*8944</a>.</div>` : ""}
      ${first.length ? `
        <section class="first-steps" aria-label="צעדים ראשונים">
          <ol>${first.map((r, n) => `<li>${card(r.s, r.why)}</li>`).join("")}</ol>
        </section>` : ""}
      ${crisis ? `<div class="callout">אם קשה במיוחד עכשיו, לא צריך לחכות לאף תוכנית: <a href="tel:*8944">*8944</a> (נפש אחת, 24/7, גם ללא הכרה), ער״ן <a href="tel:1201">1201</a>, נט״ל <a href="tel:*3362">*3362</a>. זמינים גם בלילה.</div>` : ""}
      ${guideKeys.length ? `<div class="callout callout-info"><strong>חשוב לדעת על הזכויות שלך:</strong> ${guideKeys.map(k => `<a href="#/rights?s=${k}">${esc(GUIDES[k].title)}</a>`).join(" · ")}</div>` : ""}
      ${order.length ? `<h2 class="more-title">עוד אפשרויות לפי תחום</h2>` : ""}
      ${order.map(c => { const rest = byCat[c].filter(r => !firstIds.has(r.s.id)); return rest.length ? `
        <section class="res-group">
          <h3 class="group-title">${catIcon(c)} ${esc(catLabel(c))} <small>${rest.length}</small></h3>
          <div class="grid">${rest.slice(0, SHOW).map(r => card(r.s, r.why)).join("")}</div>
          ${rest.length > SHOW ? `<details><summary>להציג עוד ${rest.length - SHOW}</summary><div class="grid">${rest.slice(SHOW).map(r => card(r.s, r.why)).join("")}</div></details>` : ""}
        </section>` : ""; }).join("")}
      ${!res.length ? `<p class="empty">לא מצאנו התאמה מדויקת. נסו לסמן פחות סינונים, או <a href="#/browse">לדפדף בכל השירותים</a>.</p>` : ""}`;
    if (canPrint) document.getElementById("print").onclick = () => {
      document.querySelectorAll("details").forEach(d => d.open = true);
      window.print();
    };
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
        <h1>כל השירותים</h1>
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
    const sel = params.get("s");
    const keys = Object.keys(G);
    $main.innerHTML = `
      <section>
        <h1>מה מגיע לי?</h1>
        <p class="lead">סיכום קצר לפי סטטוס: מה אפשר לקבל, איפה מתחילים, ומה לא לפספס. זה לא ייעוץ משפטי. כשיש ספק, כדאי לפנות לגוף שמסייע במיצוי זכויות (יש כאלה ללא עלות במאגר).</p>
        <div class="tabs" role="tablist">
          ${keys.map(k => `<a role="tab" class="tab ${k === sel || (!sel && k === keys[0]) ? "active" : ""}" href="#/rights?s=${k}">${esc(G[k].title)}</a>`).join("")}
        </div>
        <div id="guide"></div>
      </section>`;
    const k = sel && G[sel] ? sel : keys[0];
    if (!k) return;
    const g = G[k];
    const related = SERVICES.filter(s => ["rights-legal", "financial-grants"].includes(s.category) && eligible(s, [k])).slice(0, 6);
    document.getElementById("guide").innerHTML = `
      <article class="guide">
        <p class="lead">${esc(g.intro)}</p>
        ${g.sections.map(sec => `
          <h2>${esc(sec.title)}</h2>
          <ul>${sec.items.map(it => `<li>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.text)}</a>` : esc(it.text)}</li>`).join("")}</ul>`).join("")}
        ${related.length ? `<h2>מי יכול לעזור עם זה</h2><div class="grid">${related.map(s => card(s)).join("")}</div>` : ""}
      </article>`;
  }

  function viewProvider() {
    const cats = Object.keys(T.categories).filter(k => k !== "hotlines");
    $main.innerHTML = `
      <section class="form-page">
        <h1>הצטרפות ללוח — לגופים ולמפעילים</h1>
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
          <button class="btn btn-primary" type="submit">שליחה לבדיקה</button>
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
          <h1>כניסת מנהלים</h1>
          <form id="login" class="form">
            <label>אימייל<input name="email" type="email" required></label>
            <label>סיסמה<input name="password" type="password" required></label>
            <button class="btn btn-primary">כניסה</button>
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
    $main.innerHTML = `<section><h1>ניהול</h1><p>טוען…</p></section>`;
    let leads = [], subs = [];
    try { [leads, subs] = await Promise.all([Store.listLeads(), Store.listSubmissions()]); }
    catch (e) { $main.innerHTML = `<section><h1>ניהול</h1><p>אין הרשאה לצפות בנתונים. ודאו שהמשתמש מוגדר כמנהל (ראו README).</p></section>`; return; }
    leads.sort((a, b) => b.createdAt - a.createdAt);
    subs.sort((a, b) => b.createdAt - a.createdAt);
    const byId = Object.fromEntries(SERVICES.map(s => [s.id, s]));
    const pending = subs.filter(s => !s.status || s.status === "pending");
    const fmt = t => new Date(t).toLocaleString("he-IL");
    $main.innerHTML = `
      <section>
        <h1>ניהול</h1>
        ${Store.mode === "local" ? `<div class="callout callout-info">מצב הדגמה: הנתונים כאן נשמרו רק בדפדפן הזה. כדי לקבל פניות אמיתיות מחברים את Firebase (ראו README).</div>` : ""}
        <h2>הצעות של גופים שממתינות לאישור (${pending.length})</h2>
        <div class="admin-list">
          ${pending.map(s => `
            <div class="admin-item">
              <strong>${esc(s.name)}</strong> · ${esc(catLabel(s.category))} · ${esc(costLabel(s.cost))}
              <p>${esc(s.description)}</p>
              <small>${esc(s.contact_person)} · ${esc(s.email)} · ${esc(s.phone)} · ${esc(s.website)} · ${fmt(s.createdAt)}</small>
              <div class="actions">
                <button class="btn btn-small btn-primary" data-approve="${esc(s._id)}">אישור ופרסום</button>
                <button class="btn btn-small" data-reject="${esc(s._id)}">דחייה</button>
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

  // ---------- service modal ----------
  function openService(id) {
    const s = SERVICES.find(x => x.id === id);
    if (!s) return;
    const contactBtns = [];
    if (s.phone) {
      contactBtns.push(`<a class="btn" href="${telHref(s.phone)}">📞 ${esc(s.phone)}</a>`);
      if (isMobile(s.phone)) contactBtns.push(`<a class="btn" href="${waHref(s.phone)}" target="_blank" rel="noopener">וואטסאפ</a>`);
    }
    if (s.email) contactBtns.push(`<a class="btn" href="mailto:${esc(s.email)}?subject=${encodeURIComponent("פנייה דרך מגיע לך — " + s.name)}">✉️ מייל</a>`);
    if (s.website) contactBtns.push(`<a class="btn" href="${esc(safeUrl(s.website))}" target="_blank" rel="noopener">🌐 לאתר</a>`);
    const list = (title, keys, dict) => keys.length ? `<div class="meta-row"><span>${title}</span><div class="tags">${keys.map(k => `<span class="tag">${esc(dict[k] || k)}</span>`).join("")}</div></div>` : "";
    $modalBody.innerHTML = `
      <div class="card-cat">${catIcon(s.category)} ${esc(catLabel(s.category))} · ${esc(T.providerTypes[s.provider_type] || "")}</div>
      <h2 id="modal-title">${esc(s.name)}</h2>
      <p>${esc(s.description)}</p>
      <div class="meta">
        <div class="meta-row"><span>עלות</span><div><span class="tag cost-${esc(s.cost)}">${esc(costLabel(s.cost))}</span> ${esc(s.cost_notes || "")}</div></div>
        ${s.location ? `<div class="meta-row"><span>מיקום</span><div>${esc(s.location)}</div></div>` : ""}
        ${list("למי", arr(s.eligibility), T.eligibility)}
        ${list("עוזר ב", arr(s.difficulties), T.difficulties)}
        ${list("אזור", arr(s.regions), T.regions)}
        ${s.how_to_apply ? `<div class="meta-row"><span>איך מתחילים</span><div>${esc(s.how_to_apply)}</div></div>` : ""}
      </div>
      <div class="contact-btns">${contactBtns.join("")}</div>
      <form id="lead" class="form lead-form">
        <h3>להשאיר פנייה</h3>
        <p class="small">נעביר את הפנייה לגוף, והם יחזרו אליך. לא חובה לספר יותר ממה שנוח לך.</p>
        <div class="row">
          <label>שם *<input name="name" required maxlength="80"></label>
          <label>טלפון או מייל *<input name="contact" required maxlength="120"></label>
        </div>
        <label>משהו שחשוב שידעו? (לא חובה)<textarea name="message" rows="2" maxlength="600"></textarea></label>
        <label class="check"><input type="checkbox" name="consent" required> אני מסכים/ה שהפרטים יועברו ל${esc(s.name)} לצורך יצירת קשר בלבד.</label>
        <button class="btn btn-primary">שליחת פנייה</button>
        <p class="form-msg" role="status"></p>
      </form>
      <p class="verify ${s.verified_at ? "verify-ok" : "verify-no"}">${s.verified_at
        ? "✓ הפרטים אומתו מול אתר הגוף ב-" + esc(s.verified_at)
        : "⚠ הפרטים עוד לא אומתו מול אתר הגוף עצמו. לפני שמגיעים, כדאי לוודא איתם טלפונית."}</p>
      ${s.source_url ? `<p class="source">מקור: <a href="${esc(safeUrl(s.source_url))}" target="_blank" rel="noopener">${esc(s.source_url.replace(/^https?:\/\//, "").slice(0, 60))}</a></p>` : ""}`;
    $modal.hidden = false;
    document.body.classList.add("no-scroll");
    $modal.querySelector(".modal-x").focus();
    const f = document.getElementById("lead");
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
        msg.textContent = "הפנייה נשלחה. אם לא חזרו אליך תוך כמה ימים, אפשר גם ליצור קשר ישירות בכפתורים למעלה.";
      } catch (err) {
        msg.textContent = "השליחה לא הצליחה. אפשר ליצור קשר ישירות בכפתורים למעלה.";
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
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", path === "/" + a.dataset.nav));
    await ensureApproved();
    if (path === "/match") viewMatch();
    else if (path === "/results") viewResults();
    else if (path === "/browse") viewBrowse(params);
    else if (path === "/rights") viewRights(params);
    else if (path === "/provider") viewProvider();
    else if (path === "/admin") viewAdmin();
    else viewHome();
    if (!qs || path !== "/browse") window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  document.getElementById("store-mode").textContent = Store.mode === "cloud" ? "מחובר לענן" : "מצב הדגמה (ללא שרת)";
  document.getElementById("data-stamp").textContent = window.SERVICES_UPDATED ? "המאגר עודכן: " + window.SERVICES_UPDATED : "";
  Store.onAuth(() => { if (location.hash.startsWith("#/admin")) route(); });
  route();
})();
