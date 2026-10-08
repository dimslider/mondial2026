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
  // שדה טלפון יכול להכיל כמה מספרים ("1201 | וואטסאפ 052-…", "*3362 / 1-800-…") — לחיוג לוקחים את הראשון.
  // "1111 שלוחה 6" מחויג כ-1111 ואז 6 (פסיק = המתנה בחיוג)
  const firstPhone = p => String(p).split(/\||\/|\bאו\b|,|\(|;/)[0].replace(/שלוחה\s*\d+/, "").trim();
  const telHref = p => {
    const ext = String(p).split(/\||\/|\bאו\b|,|\(|;/)[0].match(/שלוחה\s*(\d+)/);
    return "tel:" + firstPhone(p).replace(/[^\d*+#]/g, "") + (ext ? "," + ext[1] : "");
  };
  // וואטסאפ רק למספר נייד ישראלי מלא (05X + 7 ספרות), לא לקווי כוכבית
  const isMobile = p => { const f = firstPhone(p); if (f.includes("*")) return false; const d = f.replace(/[^\d]/g, "").replace(/^972/, "0"); return /^05\d{8}$/.test(d); };
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
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY)) || null;
      // "טיולים ונסיעות" אוחד עם "טבע, טיולים ומסעות"
      if (p && Array.isArray(p.interests)) p.interests = [...new Set(p.interests.map(i => i === "travel" ? "nature" : i))];
      return p;
    } catch (e) { return null; }
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
  // "פתוח לכולם": רק שירות רחב באמת (קווי סיוע, מרכזי חוסן וכו'), שמסומן גם "אזרח/ית" וגם לפחות 3 קבוצות נוספות.
  // שירות שמסומן רק "נפגעי איבה + אזרחים" (למשל הטבה של ביטוח לאומי) לא יוצג לשוטר או למילואימניק.
  const openToAll = s => { const el = arr(s.eligibility); return el.includes("civilians") && el.length >= 4; };
  function eligible(s, statuses) {
    const el = arr(s.eligibility);
    if (!statuses.length || !el.length) return true;
    if (el.some(e => statuses.includes(e))) return true;
    return openToAll(s);
  }
  // אזורים שכנים: מי שגר בשפלה יקבל גם מה שבמרכז ובירושלים, אבל לא את מרכז החוסן בשדרות
  const NEAR = { shfela: ["center", "jerusalem", "south"], center: ["shfela", "sharon"], sharon: ["center"], haifa: ["north"], north: ["haifa"],
    jerusalem: ["shfela", "judea-samaria"], "judea-samaria": ["jerusalem"], south: ["shfela"] };
  const withNear = regions => [...new Set(regions.flatMap(r => [r, ...(NEAR[r] || [])]))];
  function regionOk(s, regions) {
    const r = arr(s.regions);
    if (!regions.length || !r.length) return true;
    if (r.includes("nationwide") || r.includes("online")) return true;
    const ok = withNear(regions);
    return r.some(x => ok.includes(x));
  }
  // שירות שעיקרו פציעה גופנית (קטיעה, נכות פיזית, פגיעת ראש). למי שלא סימן קושי כזה הוא לא רלוונטי,
  // גם אם מופיעה בו גם "פוסט טראומה".
  const PHYS = ["amputation", "physical-disability", "tbi"];
  const physicalFocus = s => { const d = arr(s.difficulties); return d.some(x => PHYS.includes(x)) && d.filter(x => !PHYS.includes(x) && x !== "ptsd").length <= 1; };
  function score(s, p) {
    let sc = 0;
    const why = [];
    const d = arr(s.difficulties).filter(x => p.difficulties.includes(x));
    const i = arr(s.interests).filter(x => p.interests.includes(x));
    // "פוסט טראומה" מסומנת כמעט בכל שירות, אז לבדה היא שווה פחות מקושי ספציפי (שינה, כעס, זוגיות)
    if (d.length) { sc += d.reduce((t, x) => t + (x === "ptsd" && p.difficulties.length > 1 ? 1.5 : 3), 0); why.push("עוזר ב: " + d.map(x => T.difficulties[x]).join(", ")); }
    if (i.length) { sc += 3 * i.length; why.push("מתאים לתחומי עניין: " + i.map(x => T.interests[x]).join(", ")); }
    const r = arr(s.regions);
    if (p.regions.length && r.some(x => p.regions.includes(x))) { sc += 1; why.push("קרוב אליך"); }
    else if (p.regions.length && !regionOk(s, p.regions)) { sc -= 3; why.push("באזור אחר"); }
    // עלות לא ידועה נחשבת באמצע, לא כמו "בתשלום"
    const cr = s.cost ? (T.cost[s.cost] || { rank: 4 }).rank : 2;
    sc += Math.max(0, 2 - cr * 0.5);
    if (p.maxCost != null && cr > p.maxCost) sc -= 4;
    if (/ניסוי קליני|ניסוי\s/.test(s.name)) sc -= 3;   // ניסויים קליניים: לא בראש הרשימה
    const el = arr(s.eligibility).filter(x => p.statuses.includes(x));
    if (el.length) { sc += 1; why.unshift("מתאים לסטטוס שלך"); }
    else if (p.statuses.length) sc -= 2;   // פתוח לכולם, לא מיועד במיוחד למצב שסימנת
    // שירות לבני משפחה או לשכול, למי שלא סימן משפחה, שכול או זוגיות
    const forFamily = s.category === "family-support" || /בני משפחה|לבני זוג|בנות זוג|לאחים|ליתומי|לאלמנות|ימי הזיכרון/.test(s.name);
    // תוכנית של עמותת בוגרי יחידה מסוימת (דובדבן, מגלן): רלוונטית רק לבוגרי היחידה, אז לא בראש הרשימה
    if (/בוגרי|יוצאי (?:שלדג|עוקץ)/.test(s.name) && !/חבל זוג|מים שקטים/.test(s.name)) sc -= 3;
    if (forFamily && !p.statuses.some(x => x === "families" || x === "bereaved") && !p.difficulties.some(x => x === "family-relations" || x === "grief")) sc -= 3;
    if (s.confidence === "low") sc -= 1;
    if (starred(s)) { sc += 1; why.push("מומלץ בקהילה"); }
    return { sc, why };
  }
  function match(p) {
    // מי שבתהליך הכרה או עוד לא מוכר צריך קודם כול ליווי בהכרה, גם אם לא סימן "בירוקרטיה"
    if (p.statuses.some(x => x === "mod-in-process" || x === "not-recognized") && !p.difficulties.includes("bureaucracy"))
      p = Object.assign({}, p, { difficulties: [...p.difficulties, "bureaucracy"] });
    const asked = p.difficulties.length || p.interests.length;
    const free = p.maxCost === 0;
    return SERVICES
      .filter(s => s.category !== "hotlines")
      .filter(s => eligible(s, p.statuses))
      // "רק ללא עלות": מוציאים מה שידוע שעולה כסף (מסובסד, חלקי, בתשלום)
      .filter(s => !free || !["subsidized", "partial", "paid"].includes(s.cost))
      // אזור: מה שמקומי ורחוק לא מוצג (ארצי ואונליין תמיד כן)
      .filter(s => regionOk(s, p.regions))
      .filter(s => !physicalFocus(s) || p.difficulties.some(d => PHYS.includes(d)) || !p.difficulties.length)
      .map(s => Object.assign({ s }, score(s, p)))
      // כשסימנו קושי או תחום עניין, שירות חייב לענות על לפחות אחד מהם (קרבה לבד לא מספיקה)
      .filter(x => asked ? (arr(x.s.difficulties).some(d => p.difficulties.includes(d)) || arr(x.s.interests).some(i => p.interests.includes(i))) && x.sc > 1.5 : regionOk(x.s, p.regions))
      // שירות שפתוח לכולם (ולא ספציפית לסטטוס שסימנת) מוצג רק אם הוא עונה על קושי או תחום עניין שבחרת
      .filter(x => !p.statuses.length || arr(x.s.eligibility).some(e => p.statuses.includes(e)) ||
        arr(x.s.difficulties).some(d => p.difficulties.includes(d)) || arr(x.s.interests).some(i => p.interests.includes(i)))
      .sort((a, b) => b.sc - a.sc)
      // רשימה קצרה ומדויקת: מה שרחוק מאוד מההתאמה הטובה ביותר לא מוצג (אפשר למצוא אותו בחיפוש)
      .filter((x, _, all) => !asked || x.sc >= Math.max(4, all[0].sc * 0.35));
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
  // שם עם תוספת לועזית בסוגריים: עוטפים כדי שהסוגריים לא יתהפכו בשבירת שורה
  const nameHtml = n => esc(n).replace(/\(([A-Za-z][^()]*)\)/g, '(<bdi dir="ltr">$1</bdi>)');
  // שם ארוך ("אתגרים – ספורט אתגרי לפצועי חרבות ברזל (Etgarim)") מתפצל ברשימות לשם ראשי ולשורת משנה.
  // שום דבר לא נמחק: השם המלא מופיע בכרטיס. תוספת לועזית בסוגריים יורדת רק מהרשימה.
  function splitName(n) {
    const full = String(n || "");
    const m = full.match(/^(.{3,}?)\s+[–—]\s+(.+)$/);
    let main = m ? m[1] : full, sub = m ? m[2] : "";
    const strip = t => t.replace(/\s*\([A-Za-z][^()]*\)\s*$/, "").trim();
    main = strip(main) || main; sub = strip(sub);
    return { main, sub };
  }
  const nameBlock = (s, tag = "h3", attrs = "") => {
    const { main, sub } = splitName(s.name);
    // שם ראשי קצר ("ער״ן", "1202", "InHeal") לא אומר כלום לבד: ההסבר נשאר בשורה שלו, באותה הדגשה
    if (sub && main.length <= 12) return `<${tag} ${attrs}>${esc(main)}<span class="name-inline">: ${esc(sub)}</span></${tag}>`;
    return `<${tag} ${attrs}>${esc(main)}</${tag}>${sub ? `<span class="name-sub">${esc(sub)}</span>` : ""}`;
  };
  // סיבה שחוזרת זהה בכל התחנות היא רעש; מציגים אותה רק כשהיא מבחינה בין התחנות
  const whyText = r => r.why.filter(w => w !== "מתאים לסטטוס שלך")[0] || "";
  const distinctWhy = list => new Set(list.map(whyText)).size > 1;
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
          ${nameBlock(s)}
          ${splitName(s.name).sub ? "" : `<p class="teaser">${esc(shortDesc(s.description, 110))}</p>`}
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

  // הלוגו: מצפן, קווי גובה, ושביל מנוקד שמוביל לחץ. detail=false לגדלים קטנים.
  const LOGO = (size, detail = true) => `<svg class="logo" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 240 240" fill="none">
    ${detail ? `<defs><clipPath id="lg-disc"><circle cx="120" cy="120" r="93"/></clipPath></defs>` : ""}
    <path d="M120 22 C 176 20, 220 64, 218 121 C 216 175, 173 219, 118 217 C 64 215, 21 172, 23 118 C 25 64, 66 23, 123 24" fill="var(--t-sea)" stroke="currentColor" stroke-width="${detail ? 6 : 12}" stroke-linecap="round"/>
    ${detail ? `<g clip-path="url(#lg-disc)" stroke="currentColor" stroke-linecap="round" fill="none">
      <path d="M14 128 C 40 116, 62 140, 92 128 C 120 116, 142 140, 172 126 C 196 116, 214 132, 232 124" stroke-width="4.5"/>
      <path d="M40 160 C 66 150, 84 170, 110 160 C 136 150, 156 168, 200 156" stroke-width="3.2"/>
      <path d="M60 188 C 84 180, 104 194, 128 186 C 150 180, 166 190, 186 184" stroke-width="3.2"/></g>` : ""}
    <path d="M120 24 L 120 44" stroke="currentColor" stroke-width="${detail ? 6 : 12}" stroke-linecap="round"/>
    <path d="M48 210 C 58 198, 70 192, 84 186 C 100 180, 108 170, 122 162 C 138 152, 154 140, 160 118 C 164 106, 168 96, 170 90" stroke="currentColor" stroke-width="${detail ? 5 : 10}" stroke-linecap="round" stroke-dasharray="0.1 ${detail ? 14 : 26}"/>
    ${detail ? `<circle cx="44" cy="214" r="9" fill="var(--paper)" stroke="currentColor" stroke-width="4.5"/>` : ""}
    <path d="M116 124 C 132 108, 150 92, 170 72" stroke="currentColor" stroke-width="${detail ? 9 : 16}" stroke-linecap="round"/>
    <path d="M150 70 C 160 69, 168 68, 175 67 C 174 74, 173 82, 173 90" stroke="currentColor" stroke-width="${detail ? 9 : 16}" stroke-linecap="round" stroke-linejoin="round"/>
    ${detail ? `<circle cx="116" cy="124" r="10" fill="var(--paper)" stroke="currentColor" stroke-width="5"/>` : ""}
  </svg>`;

  // ---------- views ----------
  // דף הבית: ביקור ראשון = כריכה שהופכת למסלול. מי שכבר ענה על השאלון = התחנות שלו.
  function viewHome() {
    const prof = loadProfile();
    if (prof) return viewReturning(prof);
    $main.innerHTML = `
      <section class="welcome">
        <div class="glass hero">
          <div class="lockup">${LOGO(72)}<div class="wordmark">אזימוט</div></div>
          <h1 class="welcome-title">מוצאים מה יכול לעזור לך, ואיך מגיעים לשם.</h1>
          <p class="welcome-sub">טיפול, ים, חוות, ספורט, מענקים וזכויות. לנכי צה״ל, מילואימניקים, לוחמים, שוטרים ומי שעוד לא הוכר. רובו בלי עלות.</p>
        </div>
        <ol class="route">
          <li class="glass-sm"><span class="st-node area-soul">1</span><strong>מספרים קצת על עצמך</strong></li>
          <li class="glass-sm"><span class="st-node area-sea">2</span><strong>מקבלים 3 מקומות שמתאימים לך</strong></li>
          <li class="glass-sm"><span class="st-node area-land">3</span><strong>מתקשרים, או מבקשים שיחזרו אליך</strong></li>
        </ol>
        <a class="btn btn-ink btn-wide welcome-cta" href="#/match"><span class="big">יוצאים לדרך</span><span class="small">4 שאלות · דקה</span></a>
        <p class="welcome-alt">או <a class="link-u" href="#/explore">לחפש לבד</a> · <a class="link-u" href="#/rights">מה מגיע לי</a></p>
        <p class="note quiet center">${SERVICES.length} מקומות · בלי הרשמה · נבדק מול מקורות רשמיים</p>
      </section>`;
  }

  // ביקור חוזר: 3 התחנות, ומתחת לשוטט לבד
  function viewReturning(p) {
    const res = match(p);
    const first = [];
    for (const r of res) { if (first.length < 3 && !first.some(f => areaOf(f.s.category) === areaOf(r.s.category))) first.push(r); }
    const SHORTS = { "mod-recognized": "מוכר/ת", "mod-in-process": "בתהליך הכרה", "not-recognized": "עוד לא מוכר/ת", "reservists": "מילואים",
      "combat-soldiers": "לוחם/ת", "police": "משטרה", "security-forces": "כוחות ביטחון", "families": "משפחה", "bereaved": "משפחה שכולה",
      "terror-victims": "נפגע/ת איבה", "civilians": "אזרח/ית" };
    const who = [...p.statuses.map(x => SHORTS[x]).slice(0, 2), ...p.regions.map(r => T.regions[r]).slice(0, 1)].filter(Boolean).join(" · ");
    const showWhy = distinctWhy(first);
    $main.innerHTML = `
      <section>
        <h1 class="page-title">התחנות שלך</h1>
        <p class="lead">${esc(who)}${who ? " · " : ""}<a class="link-u" href="#/match">לשנות</a></p>
        ${first.length ? `<ol class="stations lined compact">
          ${HAND_LINE}
          ${first.map((r, n) => `<li>
            <span class="st-node" aria-hidden="true">${n + 1}</span>
            <div class="tag-row">${starTag(r.s)}${areaTag(r.s)}</div>
            ${nameBlock(r.s, "h2", `data-open="${esc(r.s.id)}" tabindex="0" role="button"`)}
            ${showWhy && whyText(r) ? `<span class="why">← ${esc(whyText(r))}</span>` : ""}
          </li>`).join("")}
        </ol>
        <p class="actions"><a class="link-u" href="#/results">לכל התחנות שלך (${res.length}) ←</a></p>` : `<p class="empty">לא מצאנו התאמה. <a href="#/match">לשנות תשובות</a></p>`}
        <h2 class="section-title">או לשוטט לבד</h2>
        <div class="area-chips">${Object.keys(AREAS).map(k => `<a class="area-chip area-${k}" href="#/area?a=${k}">${esc(AREAS[k].label)}</a>`).join("")}</div>
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>מכירים מקום שעוזר ולא מופיע?</strong><br>להוסיף בדקה</span></a>
      </section>`;
  }

  // כל התחומים (מה שהיה דף הבית)
  function viewExplore() {
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
                <span class="sub">${esc(AREAS[k].sub)}</span>
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
    // עם פרופיל: מציגים רק מה שמתאים לסטטוס, והכי מתאים קודם
    if (p) items = items.filter(s => eligible(s, p.statuses)).map(s => Object.assign({ s }, score(s, p))).sort((a, b) => b.sc - a.sc).map(x => x.s);
    else items.sort((a, b) => (b.verified_at ? 1 : 0) - (a.verified_at ? 1 : 0));
    const top = items[0], rest = items.slice(1);
    const cats = A.cats.filter(c => c !== "hotlines" && rest.some(s => s.category === c));
    $main.innerHTML = `
      <section class="area-${k}">
        <div class="area-hero">
          <h1 class="dabbed"><span class="word${A.label.length > 4 ? " long" : ""}">${esc(A.label)}</span></h1>
          <span class="note">${items.length} אפשרויות<br>${esc(A.sub)}</span>
        </div>
        ${WAVE}
        ${top ? `
          <article class="sheet" style="margin-top: 16px">
            <span class="note highlight">${p ? "הכי מתאים לך" : "כדאי להתחיל כאן"} · ${esc(costLabel(top.cost))}</span>
            ${starTag(top)}
            ${nameBlock(top, "h2")}
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
    // אם בחרו תחום עניין, תחנה אחת לפחות תהיה ממנו
    const byInterest = p.interests.length ? res.find(r => arr(r.s.interests).some(i => p.interests.includes(i))) : null;
    if (byInterest) first.push(byInterest);
    // בתהליך הכרה / עוד לא מוכר: תחנה אחת היא ליווי בהכרה, כי ממנה נפתח כל השאר
    const needsRecognition = p.statuses.some(x => x === "mod-in-process" || x === "not-recognized");
    // עדיפות לליווי אישי (מישהו שעושה את זה איתך) על פני פורטל מידע, ולמה שמומלץ בקהילה
    const recRank = r => r.sc + (starred(r.s) ? 4 : 0) + (/ליווי|ייצוג|מימון הליך/.test(r.s.name) ? 3 : 0) - (/פורטל|מדריך|המלצות/.test(r.s.name) ? 4 : 0);
    const byRecognition = needsRecognition ? res.filter(r => r.s.category === "rights-legal" && arr(r.s.difficulties).includes("bureaucracy") && !first.includes(r))
      .sort((a, b) => recRank(b) - recRank(a))[0] : null;
    if (byRecognition) first.push(byRecognition);
    for (const r of res) { if (first.length < 3 && !first.includes(r) && !first.some(f => areaOf(f.s.category) === areaOf(r.s.category))) first.push(r); }
    first.sort((a, b) => b.sc - a.sc);
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
                ${nameBlock(s, "h2", `data-open="${esc(s.id)}" tabindex="0" role="button"`)}
                <p class="clamp-2">${esc(shortDesc(s.description, 120))}</p>
                ${distinctWhy(first) && whyText(r) ? `<span class="why">← ${esc(whyText(r))}</span>` : ""}
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
          <h2 class="section-title">עוד אפשרויות שמתאימות לך, לפי תחום</h2>
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
    ["קנאביס", "קנביס", "cbd"],
    ["אלמנה", "אלמנות", "אלמן", "שכול", "שכולה", "משפחות שכולות"],
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
  // גרשיים וגרש בכל הצורות (״ " ׳ ') לא משנים לחיפוש: נט״ל = נט"ל = נטל
  const normQ = t => String(t || "").toLowerCase().replace(/["״׳'`]/g, "");
  SYNONYMS.forEach((g, i) => { SYNONYMS[i] = g.map(normQ).filter(w => w !== "עוד"); });   // "עו\"ד" בלי גרשיים = "עוד"
  function expand(word) {
    const out = new Set([word]);
    for (const p of PREFIXES) if (word.length > p.length + 2 && word.startsWith(p)) out.add(word.slice(p.length));
    for (const w of [...out]) for (const g of SYNONYMS) if (g.includes(w)) g.forEach(x => out.add(x));
    return [...out];
  }
  const REGION_WORDS = { "צפון": "north", "בצפון": "north", "חיפה": "haifa", "בחיפה": "haifa", "קריות": "haifa", "מרכז": "center", "במרכז": "center",
    "שרון": "sharon", "בשרון": "sharon", "ירושלים": "jerusalem", "בירושלים": "jerusalem", "דרום": "south", "בדרום": "south", "באר שבע": "south",
    "שפלה": "shfela", "בשפלה": "shfela", "רחובות": "shfela", "מודיעין": "shfela", "בית שמש": "shfela", "רמלה": "shfela", "לוד": "shfela" };
  function searchScore(s, words) {
    const name = normQ(s.name);
    const tags = [catLabel(s.category), ...arr(s.interests).map(x => T.interests[x]), ...arr(s.difficulties).map(x => T.difficulties[x]),
      ...arr(s.regions).map(x => T.regions[x]), ...arr(s.eligibility).map(x => T.eligibility[x])].join(" ").toLowerCase().replace(/["״׳'`]/g, "");
    const body = normQ([s.description, s.location, s.cost_notes, s.how_to_apply].join(" "));
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
      // קיצורים עם גרשיים שבלי הגרשיים הופכים למילה אחרת ("עו״ד" → "עוד")
      const q = normQ((fd.get("q") || "").trim().replace(/עו["״]ד/g, "עורך דין").replace(/ב["״]ל/g, "ביטוח לאומי"));
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
    // סטטוסים בלי מדריך משלהם מקבלים את הקרוב ביותר; משפחה שכולה ואזרחים מקבלים את מדריך המשפחות / נפגעי האיבה
    const ALIAS = { "combat-soldiers": "not-recognized", "security-forces": "police", "bereaved": "families", "civilians": "terror-victims" };
    const pick = x => G[x] ? x : (G[ALIAS[x]] ? ALIAS[x] : null);
    const k = pick(params.get("s")) || (prof && prof.statuses.map(pick).find(Boolean)) || keys[0];
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
    // מי יכול לעזור: קודם מה שמיועד במפורש לסטטוס הזה, ורק אחר כך שירותים רחבים
    const related = SERVICES.filter(s => ["rights-legal", "financial-grants"].includes(s.category) && eligible(s, [k]))
      .sort((a, b) => (arr(b.eligibility).includes(k) ? 1 : 0) - (arr(a.eligibility).includes(k) ? 1 : 0) || (b.verified_at ? 1 : 0) - (a.verified_at ? 1 : 0))
      .slice(0, 5);
    $main.innerHTML = `
      <section class="area-soul">
        <h1 class="big-word">מה מגיע לי</h1>
        <nav class="status-pick" aria-label="הסטטוס שלי">
          ${keys.map(x => `<a href="#/rights?s=${x}" class="${x === k ? "active" : ""}" ${x === k ? 'aria-current="page"' : ""}>${esc(G[x].title)}</a>`).join("")}
        </nav>
        <div class="guide-intro"><p class="clamp-2" id="g-intro" role="button" tabindex="0" title="להרחבה">${esc(g.intro)}</p></div>
        ${key ? `
          <article class="sheet key-right">
            <span class="area-tag badge">הכי חשוב</span>
            <p class="clamp-2" id="key-text" role="button" tabindex="0">${esc(key.text)}</p>
            <button class="link-u read-more" type="button" id="key-more">לקרוא הכול</button>
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
    intro.onclick = () => intro.classList.remove("clamp-2");
    const kt = document.getElementById("key-text");
    const km = document.getElementById("key-more");
    if (kt) kt.onclick = km.onclick = () => { kt.classList.remove("clamp-2"); km.remove(); };
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
        <div class="calm-tabs" role="tablist">
          <button type="button" role="tab" class="active" data-tab="breath">נשימה</button>
          <button type="button" role="tab" data-tab="ground">5 חושים</button>
        </div>
        <div id="tab-breath">
          <div class="breath" aria-hidden="true">
            <span class="blob"></span>
            <svg viewBox="0 0 210 210" fill="none"><path d="M105 8 C 160 6, 204 48, 202 104 C 200 160, 158 204, 104 202 C 50 200, 8 158, 10 104 C 12 52, 54 10, 108 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            <span class="phase"><span id="phase">שאיפה</span><span class="count" id="count-down">4</span></span>
          </div>
          <p class="breath-how" id="breath-how">שואפים לאט דרך האף, הבטן מתמלאת</p>
          <p class="note" style="text-align: center">ממשיכים כמה סבבים, עד שהנשימה נרגעת.</p>
        </div>
        <div id="tab-ground" hidden>
          <p class="lead">כשהראש מוצף, מחזירים אותו לחדר. עוברים חוש אחרי חוש, לאט, ואפשר להגיד בקול.</p>
          <div class="ground" id="ground"></div>
        </div>
        <h2 class="section-title">לדבר עם מישהו, עכשיו</h2>
        <ul class="lines">
          ${lines.map(l => `<li><a href="tel:${l.num}"><span><span class="name">${l.name}</span><span class="what">${l.what}</span></span><span class="num">${l.num}</span></a></li>`).join("")}
        </ul>
        <p class="emergency">אם יש סכנה מיידית: מד״א <a href="tel:101">101</a> · משטרה <a href="tel:100">100</a></p>
        <p class="actions"><a class="link-u" href="#/browse?cat=hotlines">כל קווי הסיוע</a></p>
      </section>`;
    // הכיתוב מתחלף עם הנשימה (4 שאיפה, 4 עצירה, 6 נשיפה = 14 שניות, כמו האנימציה)
    // ספירה בתוך העיגול, כדי שיהיה למה להיצמד
    const el = document.getElementById("phase"), cd = document.getElementById("count-down"), how = document.getElementById("breath-how");
    const seq = [["שאיפה", 4, "שואפים לאט דרך האף, הבטן מתמלאת"], ["עצירה", 4, "מחזיקים רגע, הכתפיים רפויות"], ["נשיפה", 6, "נושפים לאט דרך הפה, כמו דרך קשית"]];
    let i = 0, n = 0;
    const tick = () => {
      if (!document.body.contains(el)) return;
      if (n === 0) { el.textContent = seq[i][0]; how.textContent = seq[i][2]; n = seq[i][1]; i = (i + 1) % seq.length; }
      cd.textContent = n; n--;
      setTimeout(tick, 1000);
    };
    tick();
    // תרגיל קרקוע 5-4-3-2-1: צעד אחרי צעד
    const G = [
      ["5", "דברים שרואים", "שמים לב לפרטים קטנים: צבע, אור, צל, כתם על הקיר."],
      ["4", "דברים שאפשר לגעת בהם", "הבגד על הגוף, הכיסא מתחת, משטח קר או חם, חפץ ביד."],
      ["3", "דברים ששומעים", "מזגן, ציפורים, רכב רחוק, הנשימה של עצמך."],
      ["2", "דברים שמריחים", "אוויר, בגד, קפה, סבון. אפשר לקום ולחפש ריח."],
      ["1", "דבר אחד שטועמים", "לגימת מים, מסטיק, או פשוט הטעם שיש עכשיו בפה."]
    ];
    let g = 0;
    const ground = document.getElementById("ground");
    const drawG = () => {
      ground.innerHTML = g < G.length ? `
        <div class="ground-step"><span class="ground-n">${G[g][0]}</span><div><strong>${G[g][1]}</strong><p>${G[g][2]}</p></div></div>
        <div class="ground-dots" aria-hidden="true">${G.map((_, k) => `<span class="${k <= g ? "on" : ""}"></span>`).join("")}</div>
        <button type="button" class="btn btn-ink" id="g-next">${g < G.length - 1 ? "הבא" : "סיימתי"}</button>` : `
        <p class="lead">יפה. עכשיו נשימה אחת ארוכה. אם עדיין קשה, אפשר לדבר עם מישהו, כאן למטה.</p>
        <button type="button" class="link-u" id="g-next">מההתחלה</button>`;
      document.getElementById("g-next").onclick = () => { g = g < G.length ? g + 1 : 0; drawG(); };
    };
    drawG();
    $main.querySelectorAll(".calm-tabs button").forEach(b => b.onclick = () => {
      $main.querySelectorAll(".calm-tabs button").forEach(x => x.classList.toggle("active", x === b));
      document.getElementById("tab-breath").hidden = b.dataset.tab !== "breath";
      document.getElementById("tab-ground").hidden = b.dataset.tab !== "ground";
    });
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
        <p class="note quiet">לא מפרסמים את הפרטים שלך. מה ששלחת נבדק לפני שמופיע במאגר. <a href="#/privacy">פרטיות</a></p>
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

  // ---------- פרטיות ----------
  function viewPrivacy() {
    $main.innerHTML = `
      <section class="form-page privacy">
        <h1 class="page-title">פרטיות</h1>
        <p class="lead">בקצרה: אין הרשמה, אין פרסומות, ואין מעקב. אנחנו שומרים רק מה שבחרת לשלוח, ורק כדי שהאתר יעבוד.</p>

        <h2 class="section-title">מה נשאר רק אצלך במכשיר</h2>
        <p>התשובות לשאלון, הבחירה במצב עמום, ואילו שירותים המלצת עליהם. הכול נשמר בדפדפן או באפליקציה שלך בלבד, ולא נשלח אלינו. אפשר למחוק את זה בניקוי נתוני האתר בדפדפן.</p>

        <h2 class="section-title">מה מגיע אלינו, ורק כשבחרת לשלוח</h2>
        <ul class="ticks plain">
          <li>${TICK}<span><strong>"שיחזרו אליי":</strong> השם, הטלפון או המייל, ומה שכתבת. משמש רק כדי שהגוף שבחרת יחזור אליך. אנחנו מעבירים לגוף הזה בלבד, ולא לאף אחד אחר.</span></li>
          <li>${TICK}<span><strong>הוספת מקום ותיקון פרטים:</strong> מה שכתבת בטופס. פרטי קשר שלך הם לא חובה, ומשמשים רק אם נצטרך לשאול משהו. לא מתפרסמים.</span></li>
          <li>${TICK}<span><strong>"ממליץ/ה":</strong> רק איזה שירות, וקוד אקראי של המכשיר כדי שלא ייספר פעמיים. בלי שם ובלי פרטים.</span></li>
        </ul>

        <h2 class="section-title">מי רואה, ולכמה זמן</h2>
        <p>רק מנהל/ת האתר, בעמוד ניהול שנעול בסיסמה. פניות "שיחזרו אליי" נמחקות אוטומטית אחרי חצי שנה. אנחנו לא מוכרים מידע, לא משתמשים בו לפרסום, ולא משתפים אותו.</p>

        <h2 class="section-title">טכני</h2>
        <p>האתר מתארח ב-Cloudflare, והמידע שנשלח נשמר שם. כתובת ה-IP לא נשמרת: לצורך הגבלת הודעות ספאם שומרים רק קוד מוצפן שמתחלף כל יום. בטפסים יש בדיקה של Cloudflare (Turnstile) שמוודאת שלא מדובר ברובוט. הגופנים נטענים מ-Google Fonts. אין כלי מדידה, אין עוגיות פרסום.</p>

        <h2 class="section-title">חשוב לדעת</h2>
        <p>המידע באתר נאסף ממקורות פתוחים ונבדק מול האתרים הרשמיים כשאפשר. הוא לא תחליף לייעוץ רפואי, נפשי או משפטי. כדאי לוודא תנאים ועלויות ישירות מול הגוף. אם יש סכנה מיידית: מד״א <a href="tel:101">101</a>, משטרה <a href="tel:100">100</a>, ובכל שעה <a href="#/help">עזרה עכשיו</a>.</p>

        <h2 class="section-title">לבקש מחיקה או לשאול</h2>
        <p>שלחת פנייה ורוצה שנמחק אותה? כתבו כאן מה שלחתם ומתי (בערך), ואיך לחזור אליכם אם צריך.</p>
        <form id="contact" class="form">
          <label>מה לבקש<textarea name="text" rows="3" maxlength="1000" required></textarea></label>
          <label>טלפון או מייל (לא חובה)<input name="contact" maxlength="120"></label>
          <div class="ts" id="contact-ts"></div>
          <button class="btn btn-ink" type="submit">לשלוח</button>
          <p class="form-msg" role="status"></p>
        </form>
        <p class="note quiet">עודכן: אוקטובר 2026</p>
      </section>`;
    const f = document.getElementById("contact");
    let token = () => "";
    captcha(document.getElementById("contact-ts")).then(g => { token = g; });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f), msg = f.querySelector(".form-msg");
      const text = (fd.get("text") || "").trim();
      if (text.length < 3) { msg.textContent = "כתבו כמה מילים."; return; }
      try {
        await Store.submit("fix", { text, contact: (fd.get("contact") || "").trim() }, { service_id: "_contact", token: token() });
        f.innerHTML = `<p class="form-msg">התקבל. נטפל בזה בהקדם.</p>`;
      } catch (err) { msg.textContent = sendError(err); }
    });
  }

  // ---------- service card ----------
  function openService(id) {
    const s = SERVICES.find(x => x.id === id);
    if (!s) return;
    const links = [];
    if (s.phone && isMobile(s.phone)) links.push(`<a class="link-u" href="${waHref(s.phone)}" target="_blank" rel="noopener">וואטסאפ</a>`);
    if (s.email) links.push(`<a class="link-u" href="mailto:${esc(s.email)}?subject=${encodeURIComponent("פנייה דרך אזימוט: " + s.name)}">מייל</a>`);
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
        <h2 id="modal-title">${nameHtml(s.name)}</h2>
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
          <label class="check"><input type="checkbox" name="consent" required> אני מסכים/ה שהפרטים יועברו ל${esc(s.name)} רק כדי ליצור איתי קשר. <a href="#/privacy">פרטיות</a></label>
          <button class="btn btn-ink">לשלוח</button>
          <p class="form-msg" role="status"></p>
        </form>
        ${s.source_url ? `<p class="source">מקור: <a href="${esc(safeUrl(s.source_url))}" target="_blank" rel="noopener">${esc(s.source_url.replace(/^https?:\/\//, "").slice(0, 60))}</a></p>` : ""}
      </div>`;
    $modal.hidden = false;
    document.body.classList.add("no-scroll");
    // כפתור "חזרה" בטלפון סוגר את הכרטיס במקום לצאת מהעמוד
    if (!(history.state && history.state.sheet)) history.pushState({ sheet: true }, "");
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
        const r = await Store.submit("lead", {
          serviceName: s.name, name: fd.get("name").trim(), contact: fd.get("contact").trim(),
          message: (fd.get("message") || "").trim(), consent: true
        }, { service_id: s.id, token: leadToken ? leadToken() : "" });
        f.querySelectorAll("input,textarea,button").forEach(x => x.disabled = true);
        msg.textContent = r && r.local ? "לא הצלחנו לשלוח עכשיו (אין חיבור לשרת). הכי בטוח להתקשר או לכתוב להם ישירות."
          : "הפנייה נשלחה. אם לא חזרו אליך תוך כמה ימים, אפשר גם להתקשר ישירות.";
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
  // סגירה מהממשק: חוזרים צעד אחד בהיסטוריה (מוחקים את הצעד שהכרטיס הוסיף)
  const closeSheet = () => { if (history.state && history.state.sheet) history.back(); else closeModal(); };
  window.addEventListener("popstate", () => { if (!$modal.hidden) closeModal(); });
  $modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$modal.hidden) closeSheet();
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
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", path === "/" + a.dataset.nav || (a.dataset.nav === "explore" && path === "/area")));
    await ensureLive();
    if (path === "/match") viewMatch();
    else if (path === "/results") viewResults();
    else if (path === "/browse") viewBrowse(params);
    else if (path === "/rights") viewRights(params);
    else if (path === "/area") viewArea(params);
    else if (path === "/explore") viewExplore();
    else if (path === "/help") viewHelp();
    else if (path === "/privacy") viewPrivacy();
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

  const bl = document.getElementById("brand-logo");
  if (bl) bl.innerHTML = LOGO(30, false);
  document.getElementById("data-stamp").textContent = window.SERVICES_UPDATED ? "המאגר עודכן: " + window.SERVICES_UPDATED : "";
  route();
})();
