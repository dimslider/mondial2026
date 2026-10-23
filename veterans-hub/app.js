(function () {
  const T = window.TAXONOMY;
  // שפה: t() מחזיר את הטקסט העברי, או את התרגום כשנבחרה אנגלית (i18n.js)
  const I18N = window.I18N || { lang: "he", TAX: {} };
  const t = window.t || (x => x);
  const isEn = () => I18N.lang === "en";
  // תווית של מפתח במילון התגיות (קטגוריה, סטטוס, אזור...), בשפה הנבחרת
  const TX = (group, k) => {
    const en = isEn() && I18N.TAX[group] && I18N.TAX[group][k];
    if (en) return en;
    const v = T[group] && T[group][k];
    return v && typeof v === "object" ? v.label : v;
  };
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
  const catLabel = k => TX("categories", k) || k;
  const catIcon = k => (T.categories[k] || { icon: "•" }).icon;
  const costLabel = k => TX("cost", k) || (k || t("עלות: לברר"));
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
    if (mode) mode.textContent = Store.mode === "cloud" ? "" : t("מצב הדגמה: מה ששולחים נשמר רק במכשיר");
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
      const w = window.turnstile.render(el, { sitekey: key, language: I18N.lang, appearance: "interaction-only" });
      return () => window.turnstile.getResponse(w) || "";
    }).catch(() => () => "");
  }
  const sendError = err => err && err.code === "rate" ? t("שלחת הרבה הודעות היום. אפשר לנסות שוב מחר.")
    : err && err.code === "captcha" ? t("לא הצלחנו לוודא שזה לא רובוט. נסו לרענן את העמוד.")
    : t("השליחה לא הצליחה. נסו שוב בעוד רגע.");

  // ---------- matching ----------
  // ציון התאמה: קשיים שווים יותר מתחומי עניין, אזור קרוב מוסיף, עלות נמוכה מוסיפה מעט.
  // זכאות היא סינון קשיח — לא מציגים שירות שהמשתמש לא זכאי לו (אלא אם השירות פתוח לכולם).
  // "פתוח לכולם": רק שירות רחב באמת (קווי סיוע, מרכזי חוסן וכו'), שמסומן גם "אזרח/ית" וגם לפחות 3 קבוצות נוספות.
  // שירות שמסומן רק "נפגעי איבה + אזרחים" (למשל הטבה של ביטוח לאומי) לא יוצג לשוטר או למילואימניק.
  const openToAll = s => { const el = arr(s.eligibility); return el.includes("civilians") && el.length >= 4; };
  // שוטר הוא חלק מ"כוחות הביטחון"
  const expandStatuses = st => st.includes("police") && !st.includes("security-forces") ? [...st, "security-forces"] : st;
  // שוטרים ואנשי כוחות ביטחון: תוכניות ל"לוחמים" פתוחות להם לפעמים, אבל לא תמיד כתוב. מציגים, עם הערה לברר.
  const softEligible = (s, statuses) => statuses.some(x => x === "police" || x === "security-forces") && s.police !== "no" &&
    (s.police === "yes" || arr(s.eligibility).some(e => e === "combat-soldiers" || e === "reservists")) && !needsRecognition(s);
  // שוטר/ה או איש/אשת כוחות הביטחון: שירות שלא כתוב בו שהוא פתוח להם (וגם לא פתוח לכל הציבור).
  // מציגים, אבל עם סימון ברור "אולי מתאים, לא בטוח שפתוח" כדי לחסוך פנייה מיותרת.
  const isForces = statuses => arr(statuses).some(x => x === "police" || x === "security-forces");
  function policeUnsure(s, statuses) {
    if (!isForces(statuses) || s.police === "yes" || openToAll(s)) return false;
    const el = arr(s.eligibility);
    if (el.some(e => e === "police" || e === "security-forces")) return false;
    // הכרה של אגף השיקום חלה גם על שוטרים, אז שירות ממשלתי למוכרים פתוח להם. בעמותה "למוכרים" זה לא בטוח.
    if (s.provider_type === "government" && el.some(e => (e === "mod-recognized" || e === "mod-in-process") && statuses.includes(e))) return false;
    return !el.some(e => statuses.includes(e) && e !== "mod-recognized" && e !== "mod-in-process");
  }
  const forcesWord = statuses => arr(statuses).includes("police") ? t("לשוטרים") : t("לכוחות הביטחון");
  const maybeTag = (s, p) => p && policeUnsure(s, p.statuses) ? `<span class="maybe-tag">${esc(t("אולי מתאים · לא בטוח שפתוח {who}", { who: forcesWord(p.statuses) }))}</span>` : "";
  function eligible(s, statuses) {
    const el = arr(s.eligibility);
    statuses = expandStatuses(statuses);
    if (!statuses.length || !el.length) return true;
    if (el.some(e => statuses.includes(e))) return true;
    return openToAll(s) || softEligible(s, statuses);
  }
  // עמוד מידע (פודקאסט, פורטל, מדריך, רפורמה): שימושי, אבל לא "תחנה" שפונים אליה
  const infoItem = s => s.kind === "info" || /פודקאסט|סדרה תיעודית|פורטל|מדריך זכויות|רפורמ|המלצות ועדת/.test(s.name);
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
  // סוג הפגיעה הגופנית: פגיעת ראש וקטיעה הן עולמות שונים. שירות שעיקרו פגיעה מסוג אחד לא מוצג למי שסימן סוג אחר.
  const INJURY = { tbi: ["tbi"], body: ["amputation", "physical-disability"] };
  const injuryOf = list => Object.keys(INJURY).filter(k => list.some(x => INJURY[k].includes(x)));
  function injuryFocus(s) {
    const d = arr(s.difficulties);
    if (/פגיעה מוחית|פגיעות ראש|פגועי ראש/.test(s.name)) return ["tbi"];
    if (/קטוע/.test(s.name)) return ["body"];
    const k = injuryOf(d);
    return k.length && d.filter(x => !INJURY.tbi.includes(x) && !INJURY.body.includes(x) && x !== "ptsd").length <= 1 ? k : [];
  }
  // שירות שדורש הכרה: מיועד רק למוכרים (ולשוטרים / כוחות ביטחון מוכרים), בלי פתח למי שבתהליך או לא מוכר
  const OPEN_EL = ["mod-in-process", "not-recognized", "combat-soldiers", "reservists", "civilians", "terror-victims"];
  const needsRecognition = s => { if (s.recognition === "required") return true; if (s.recognition === "not_required") return false;
    const el = arr(s.eligibility); return el.includes("mod-recognized") && !el.some(x => OPEN_EL.includes(x)); };
  // תוכנית של עמותת בוגרי יחידה מסוימת, או לחיילים בודדים: לא מתאימה בהתאמה כללית (נשארת בחיפוש)
  const narrowGroup = s => s.unit_only === true || /בוגרי|יוצאי (?:שלדג|עוקץ)|בודדים|חייל בודד|לוחמים בודדים/.test(s.name) && !/חבל זוג|מים שקטים/.test(s.name);
  // קושי ספציפי שווה יותר. "פוסט טראומה" מסומנת כמעט בכל שירות, אז כשבחרו עוד קשיים היא שווה פחות.
  const D_WEIGHT = { tbi: 5, amputation: 5, addiction: 4, "physical-disability": 4, grief: 4 };
  const MENTAL = ["ptsd", "depression", "anxiety", "sleep", "anger", "addiction", "moral-injury", "loneliness"];
  // מרחק: לפי יישוב (אם נבחר) וקואורדינטות השירות. מספיק בקירוב, זה לא ניווט.
  const TOWN_MAP = Object.fromEntries((window.TOWNS || []).flatMap(t => [[t[0], t], ...(t[4] || []).map(a => [a, t])]));
  const townOf = name => TOWN_MAP[String(name || "").trim()];
  function kmTo(s, p) {
    const t = townOf(p.town);
    if (!t || !Array.isArray(s.geo)) return null;
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(s.geo[0] - t[1]), dLng = rad(s.geo[1] - t[2]);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(t[1])) * Math.cos(rad(s.geo[0])) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }
  // פעילות קבועה (שבועית / מזדמנת) רחוקה מדי לא מעשית. תוכנית מרוכזת או שהייה עם לינה: אפשר לנסוע.
  const tooFar = (s, p) => { const km = kmTo(s, p); return km != null && km > 110 && ["weekly", "light", "oneoff", "unknown", undefined].includes(s.intensity) && !arr(s.regions).some(r => r === "nationwide" || r === "online"); };
  // שירות שמיועד לבני משפחה (לא לפגוע/ה עצמו/ה)
  const familyTarget = s => s.category === "family-support" || /בני משפחה|לבני זוג|בנות זוג|לאחים|ליתומי|לאלמנות|ימי הזיכרון|למשפחות|לנשות|לאמהות/.test(s.name);
  function score(s, p) {
    let sc = 0;
    const why = [];
    const d = arr(s.difficulties).filter(x => p.difficulties.includes(x));
    const i = arr(s.interests).filter(x => p.interests.includes(x));
    if (d.length) { sc += d.reduce((t, x) => t + (x === "ptsd" && p.difficulties.length > 1 ? 1.5 : (D_WEIGHT[x] || 3)), 0); why.push("עוזר ב: " + d.map(x => T.difficulties[x]).join(", ")); }
    // תחום עניין: הראשון שווה 3, כל נוסף רק 1. כך שירות עם הרבה תגיות לא גובר על מה שעונה על הקושי.
    if (i.length) { sc += 3 + (i.length - 1); why.push("מתאים לתחומי עניין: " + i.map(x => T.interests[x]).join(", ")); }
    const r = arr(s.regions);
    const km = kmTo(s, p);
    if (km != null) {
      if (km <= 30) { sc += 2.5; why.push(`קרוב אליך, כ-${Math.max(km, 1)} ק"מ`); }
      else if (km <= 60) { sc += 1; why.push(`כ-${km} ק"מ ממך`); }
      else if (km > 90 && s.intensity !== "residential" && s.intensity !== "program") sc -= 2;
    } else if (p.regions.length && r.some(x => p.regions.includes(x))) { sc += 1; why.push("קרוב אליך"); }
    // עלות לא ידועה נחשבת באמצע, לא כמו "בתשלום"
    const cr = s.cost ? (T.cost[s.cost] || { rank: 4 }).rank : 2;
    sc += Math.max(0, 2 - cr * 0.5);
    // עלות לא ידועה לא נענשת. "במימון משרד הביטחון" הוא חינם למי שמוכר או בתהליך
    const modFree = s.cost === "mod-funded" && p.statuses.some(x => x === "mod-recognized" || x === "mod-in-process");
    if (p.maxCost != null && s.cost && !modFree && cr > p.maxCost) sc -= 4;
    if (/ניסוי קליני|ניסוי\s/.test(s.name)) sc -= 3;   // ניסויים קליניים: לא בראש הרשימה
    // מי שלא סימן פוסט טראומה, פציעה או הכרה (למשל מילואימניק עם קשיי הסתגלות): שירות שבשמו "פוסט טראומה", "שיקום" או "פצועים" הוא לא הכתובת הראשונה
    // רק כשסימנו מילואים (בלי לוחם/ת, שוטר/ת, הכרה), ובלי פוסט טראומה או פציעה
    const lightReservist = p.statuses.includes("reservists") && p.statuses.every(x => ["reservists", "not-recognized", "families", "civilians"].includes(x)) &&
      !p.difficulties.some(x => ["ptsd", "tbi", "amputation", "physical-disability", "moral-injury"].includes(x));
    if (lightReservist && /פוסט.?טראומ|הלומי קרב|PTSD|לפצועי|לנכי|שיקומי|שיקום|תגובות קרב/.test(s.name)) sc -= 4;
    // ולו: מה שמיועד במפורש למשרתי מילואים קודם
    if (lightReservist && /מילואים|מילואימניק/.test(s.name)) { sc += 2; why.unshift("מיועד למשרתי מילואים"); }
    // מסגרת שעיקרה גמילה, למי שלא סימן התמכרות
    if (/רטורנו|גמילה|התמכרו/.test(s.name) && !p.difficulties.includes("addiction")) sc -= 5;
    const myStatuses = expandStatuses(p.statuses);
    const el = arr(s.eligibility).filter(x => myStatuses.includes(x));
    if (el.length) { sc += 1; why.unshift("מתאים לסטטוס שלך"); }
    else if (p.statuses.length && softEligible(s, myStatuses)) { sc -= 1; why.push("מיועד ללוחמים. כדאי לשאול אם פתוח גם לשוטרים ולכוחות הביטחון"); }
    else if (p.statuses.length) sc -= 2;   // פתוח לכולם, לא מיועד במיוחד למצב שסימנת
    // שוטרים וכוחות הביטחון: מה שכתוב בו במפורש שפתוח להם קודם למה שלא בטוח
    if (isForces(p.statuses) && s.police === "yes") { sc += 1; if (!el.length) why.unshift("פתוח גם לשוטרים ולכוחות הביטחון"); }
    if (infoItem(s)) sc -= 2;
    // שירות לבני משפחה או לשכול, למי שלא סימן משפחה, שכול או זוגיות
    const forFamily = familyTarget(s);
    if (forFamily && !p.statuses.some(x => x === "families" || x === "bereaved") && !p.difficulties.some(x => x === "family-relations" || x === "grief")) sc -= 3;
    // כאב כרוני: ריצה ואקסטרים בלי התאמה לכאב הם לא ההמלצה הראשונה
    if (p.difficulties.includes("chronic-pain") && !arr(s.difficulties).some(x => x === "chronic-pain" || x === "physical-disability") &&
      arr(s.interests).length && arr(s.interests).every(x => ["fitness", "extreme", "sport"].includes(x))) sc -= 2;
    // תקופת השירות: תוכנית למלחמה הנוכחית פחות מתאימה לוותיק של לבנון, ולהפך
    if (p.era && s.era) {
      if (s.era === "older") sc += p.era === "older" ? 4 : p.era === "iron-swords" ? -3 : 0;
      if (s.era === "iron-swords") sc += p.era === "iron-swords" ? 1 : p.era === "older" ? -4 : -2;
      if (s.era === "iron-swords-desc" && p.era === "older") sc -= 1;
      if (s.era === "older" && p.era === "older") why.push("ללוחמים מהתקופה שלך");
    }
    // גיל: טווח שכתוב בשירות, ותוכניות לצעירים / לסטודנטים
    const AGE_MID = { u30: 25, "30-45": 38, "45-60": 52, "60+": 65 };
    if (p.age) {
      const a = AGE_MID[p.age];
      if (arr(s.age).length && (a < s.age[0] - 3 || a > s.age[1] + 3)) sc -= 4;
      if ((p.age === "45-60" || p.age === "60+") && /צעירים|סטודנטים|מלגות|לימודים אקדמיים|לחזור ללימודים/.test(s.name)) sc -= 2;
      if (p.age === "60+" && arr(s.interests).includes("extreme")) sc -= 2;
    }
    if (s.intensity === "oneoff" && s.kind !== "money" && s.kind !== "rights") sc -= 1;
    // שירות לתפקיד מסוים במשפחה (אלמנות, יתומים, אחים) כשלא ידוע מה הקשר: לא בראש הרשימה
    if (p.statuses.some(x => x === "families" || x === "bereaved") && !p.relation && familyRoles(s).length) sc -= 3;
    if (s.confidence === "low") sc -= 1;
    if (starred(s)) { sc += 1; why.push("מומלץ בקהילה"); }
    return { sc, why };
  }
  // צרכים שלא תמיד מסמנים, אבל ברורים מהמצב: מי שבתהליך הכרה, או לוחם/שוטר עם פוסט טראומה שלא סימן שהוא מוכר,
  // צריך קודם כול ליווי בהכרה
  function withImplied(p) {
    const st = p.statuses;
    const unrecognized = st.some(x => x === "mod-in-process" || x === "not-recognized") ||
      (!st.includes("mod-recognized") && st.some(x => ["police", "combat-soldiers", "reservists", "security-forces"].includes(x)) &&
        p.difficulties.some(x => ["ptsd", "tbi", "amputation", "physical-disability"].includes(x)));
    // מוכר שהמצב שלו החמיר: צריך בדיקה מחדש (החמרה), כלומר שוב ליווי בזכויות
    const worse = p.worsened === true && st.includes("mod-recognized");
    return (unrecognized || worse) && !p.difficulties.includes("bureaucracy") ? Object.assign({}, p, { difficulties: [...p.difficulties, "bureaucracy"], implied: true }) : p;
  }
  // למי במשפחה השירות מיועד, ולמשפחה של מי (פצוע, מילואים, חטוף, חלל)
  function familyRoles(s) {
    const t = s.name, r = [];
    if (/אלמנ|בנות זוג|בני זוג|בן\/בת זוג|בני\/בנות זוג|נשות|רעיות/.test(t)) r.push("partner");
    if (/יתומ|ילדי|לילדים|נוער/.test(t)) r.push("child");
    if (/לאחים|אחים שכולים|אחים ואחיות של|לאחיות|אחים צעירים|לאחים שכולים/.test(t)) r.push("sibling");
    if (/הורים שכולים|להורים(?! של)|הורים לילד/.test(t)) r.push("parent");
    if (/להורים של בנות|הורים של בני/.test(t)) r.push("parent-of-partner");
    return r;
  }
  function familyContext(s) {
    const t = s.name + " " + (s.description || "").slice(0, 160);
    if (/חטופים|חטוף/.test(t)) return "hostage";
    if (/שכול|אלמנ|יתומ|חללי|נופלים|נרצחים/.test(s.name)) return "bereaved";
    if (/פצועים|פצוע|נכים|נכי|הלומי|פוסט טראומה/.test(s.name)) return "wounded";
    if (/מילואים|מילואימניק/.test(s.name)) return "reservist";
    return "";
  }
  function familyFit(s, p) {
    const fam = p.statuses.includes("families"), ber = p.statuses.includes("bereaved");
    if (!fam && !ber) return true;
    if (p.statuses.some(x => !["families", "bereaved"].includes(x))) return true;   // יש עוד סטטוס: לא מסננים כאן
    const roles = familyRoles(s), ctx = familyContext(s);
    if (p.relation && roles.length && !roles.includes(p.relation)) return false;
    if (ber && !fam && (ctx === "hostage" || ctx === "wounded" || ctx === "reservist") && s.kind === "family") return false;
    if (ber && /נובה/.test(s.name)) return false;
    if (ber && !p.statuses.includes("terror-victims") && /איבה/.test(s.name)) return false;
    if (fam && !ber && ctx === "bereaved") return false;
    // פצוע ומילואימניק חופפים הרבה פעמים (מילואימניק עם פוסט טראומה). רק חטופים הם מסלול נפרד לגמרי.
    if (fam && !ber && p.famof && ((ctx === "hostage") !== (p.famof === "hostage"))) return false;
    if (fam && !ber && !p.famof && ctx === "hostage") return false;
    return true;
  }
  // מסגרת לנשים בלבד (לא לבנות זוג או לאמהות, שזה עניין של קשר משפחתי): בהתאמה האישית רק למי שסימנה "אישה"
  const womenOnly = s => /(?:^|[\s–(])לנשים/.test(s.name) || /בהפרדה/.test(s.name);
  // ספק בסל Shikum.Me (מכון כושר, סטודיו, בריכה): רק למוכרים, רק קרוב, ולא יותר מכמה ברשימה
  const isSupplier = s => s.supplier === true;
  function supplierOk(s, p) {
    if (!isSupplier(s)) return true;
    if (!p.statuses.includes("mod-recognized")) return false;
    const km = kmTo(s, p);
    if (km != null) return km <= 35;
    return p.regions.length > 0 && arr(s.regions).some(r => p.regions.includes(r));
  }
  function match(p, opts = {}) {
    p = withImplied(p);
    const t = townOf(p.town);
    if (t && !p.regions.includes(t[3])) p = Object.assign({}, p, { regions: [...p.regions, t[3]] });
    const asked = p.difficulties.length || p.interests.length;
    const free = p.maxCost === 0;
    const myInjury = injuryOf(p.difficulties);
    const recognized = p.statuses.includes("mod-recognized");
    const all = SERVICES
      .filter(s => s.category !== "hotlines")
      .filter(s => eligible(s, p.statuses))
      .filter(s => !p.statuses.length || recognized || !needsRecognition(s))
      .filter(s => !narrowGroup(s))
      .filter(s => familyFit(s, p))
      .filter(s => supplierOk(s, p))
      .filter(s => !s.no_contact)   // בלי שום דרך פנייה: רק בחיפוש, לא בהתאמה האישית
      .filter(s => s.status !== "closed_now")   // לא מקבלים כרגע: רק בחיפוש
      .filter(s => !womenOnly(s) || p.gender === "f")
      // כתוב במפורש שרק לחיילי צה"ל: לא מוצג לשוטר/ה, אלא אם סימנו גם לוחם/ת או מילואים
      .filter(s => !(s.police === "no" && isForces(p.statuses) && !p.statuses.some(x => x === "combat-soldiers" || x === "reservists")))
      // שירות למי שעוד לא מוכר (כתוב בשם) לא מתאים למי שכבר מוכר
      .filter(s => !recognized || !/שאינם מוכרים|שאינן מוכרות|לא מוכרים|ללא הכרה/.test(s.name))
      // "רק ללא עלות": מוציאים מה שידוע שעולה כסף (מסובסד, חלקי, בתשלום)
      .filter(s => !free || !["subsidized", "partial", "paid"].includes(s.cost))
      // אזור: מה שמקומי ורחוק לא מוצג (ארצי ואונליין תמיד כן)
      .filter(s => regionOk(s, p.regions) && !tooFar(s, p))
      .filter(s => { const f = injuryFocus(s); return !f.length || !p.difficulties.length || f.some(k => myInjury.includes(k)); })
      .map(s => Object.assign({ s }, score(s, p)))
      // כשסימנו קושי או תחום עניין, שירות חייב לענות על לפחות אחד מהם (קרבה לבד לא מספיקה)
      .filter(x => asked ? (arr(x.s.difficulties).some(d => p.difficulties.includes(d)) || arr(x.s.interests).some(i => p.interests.includes(i))) && x.sc > 1.5 : true)
      .sort((a, b) => b.sc - a.sc);
    if (opts.all) return all;
    if (!asked || !all.length) return all.slice(0, 30);
    // רשימה קצרה ומדויקת: מה שרחוק מאוד מההתאמה הטובה ביותר לא מוצג (אפשר למצוא אותו בחיפוש)
    const cut = Math.max(4, all[0].sc * 0.45);
    let nSup = 0;
    return all.filter(x => x.sc >= cut).filter(x => !isSupplier(x.s) || ++nSup <= 3).slice(0, 25);
  }
  // שלוש התחנות: מה שהכי חשוב, לפי סדר. קודם מענה לפגיעה (פגיעת ראש, קטיעה), אחר כך טיפול נפשי,
  // אחר כך ליווי בהכרה, ואחר כך משהו מתחום עניין. מה שנשאר מתמלא מהציון הגבוה, מתחום אחר.
  const INTEREST_CATS = { sea: ["water-sports"], nature: ["nature-retreats", "rehab-farm"], animals: ["animal-therapy", "rehab-farm"],
    sport: ["sports", "water-sports"], fitness: ["sports"], "mind-body": ["yoga-mind-body"], art: ["art-music"], music: ["art-music"],
    writing: ["art-music"], crafts: ["art-music", "rehab-farm"], tech: ["employment-education"], learning: ["employment-education"],
    volunteering: ["community-volunteer"], cooking: ["rehab-farm", "art-music"], spiritual: ["nature-retreats", "peer-support"], extreme: ["sports", "water-sports"] };
  function pickStations(p, res) {
    p = withImplied(p);
    const first = [];
    // לא שתי תחנות מאותו סוג (שני כלבים, שתי חוות)
    // role: למה התחנה נבחרה. מוצג ככותרת, כדי ששלוש התחנות יהיו תוכנית ולא רשימה
    const take = (r, role) => { if (r && first.length < 3 && !first.includes(r) && !first.some(f => f.s.category === r.s.category)) { r.role = role; first.push(r); } };
    // בין שתי אפשרויות קרובות, עדיפות למה שאפשר לפנות אליו ישירות (טלפון, אתר, מייל)
    const reach = r => r.s.phone || r.s.website || r.s.email ? 1.5 : 0;
    const notMine = r => familyTarget(r.s) && !p.statuses.some(x => x === "families" || x === "bereaved") && !p.difficulties.includes("family-relations");
    const best = (pred, rank = r => r.sc) => res.filter(r => !first.includes(r) && !infoItem(r.s) && !isSupplier(r.s) && !notMine(r) && pred(r)).sort((a, b) => rank(b) + reach(b) - rank(a) - reach(a))[0];
    const tx = r => r.sc + (arr(r.s.eligibility).length <= 5 ? 2 * arr(r.s.eligibility).filter(x => p.statuses.includes(x) && x !== "combat-soldiers" && x !== "reservists").length : 0) +
      (p.statuses.includes("mod-in-process") && /תהליך ההכרה/.test(r.s.name) ? 3 : 0) + (openToAll(r.s) ? -2 : 0) +
      (p.statuses.some(x => x === "police" || x === "security-forces") ? (r.s.police === "yes" ? 3 : r.s.police === "no" ? -4 : 0) : 0) -
      (r.s.category === "animal-therapy" ? 4 : 0) -
      (/TMS|HBOT|תא לחץ|קנביס|SGB|Stella|סטלה|ניסוי/.test(r.s.name) ? 5 : 0) -   // טיפולי קו שני, לא הצעד הראשון
      (r.s.intensity === "residential" || r.s.intensity === "intensive" || /בית מאזן|אשפוז|הבית הבטוח|אינטנסיבי/.test(r.s.name) ? 5 : 0) - (/רפורמ|המלצות ועדת|מדריך|פורטל/.test(r.s.name) ? 5 : 0);
    const isTreatment = r => (r.s.kind === "family" || r.s.kind === "money") && /טיפול/.test(r.s.name) && r.s.category !== "animal-therapy" || (r.s.kind ? r.s.kind === "treatment" && (r.s.category === "mental-health" || arr(r.s.difficulties).some(x => MENTAL.includes(x))) : r.s.category === "mental-health");
    const likesIt = r => arr(r.s.interests).some(i => p.interests.includes(i));
    // מה שהאדם אמר שהכי חשוב לו עכשיו: זו התחנה הראשונה
    const GOAL_PICK = {
      talk: () => best(isTreatment, tx),
      do: () => best(r => (r.s.kind === "activity" || !r.s.kind && likesIt(r)) && (!p.interests.length || likesIt(r)), r => r.sc + (r.s.format === "group" ? 1 : 0)),
      // "אנשים שמבינים": עדיפות לקהילה של אנשים במצב שלו (הורים שכולים, שוטרים, לוחמים מהתקופה שלו)
      people: () => best(r => r.s.kind === "peer" || r.s.kind === "family" && r.s.format !== "individual" || r.s.kind === "activity" && r.s.format === "group",
        r => r.sc + (likesIt(r) ? 3 : 0) + (p.era === "older" && r.s.era === "older" ? 9 : 0) +
          (arr(r.s.eligibility).length <= 4 && arr(r.s.eligibility).some(x => p.statuses.includes(x) && !["combat-soldiers", "reservists", "civilians"].includes(x)) ? 5 : 0) +
          (p.relation === "partner" && /בנות זוג|בני זוג|נשות|זוגות|לבנות הזוג/.test(r.s.name) ? 6 : 0)),
      rights: () => best(r => r.s.kind === "rights" || r.s.kind === "money", r => r.sc + (starred(r.s) ? 4 : 0) + (/ליווי|ייצוג/.test(r.s.name) ? 3 : 0))
    };
    const GOAL_ROLE = { talk: "לדבר עם מישהו", do: "לעשות משהו", people: "אנשים שמבינים", rights: "לסדר את הזכויות" };
    if (p.goal && GOAL_PICK[p.goal]) take(GOAL_PICK[p.goal](), GOAL_ROLE[p.goal]);
    // מענה ייעודי לפגיעה: עדיפות לשירות שזה עיקרו
    for (const k of injuryOf(p.difficulties))
      take(best(r => arr(r.s.difficulties).some(x => INJURY[k].includes(x)) && r.s.category !== "rights-legal" && !["housing", "work", "money"].includes(r.s.kind) &&
          (injuryFocus(r.s).includes(k) || r.s.category === "medical-rehab" && r.s.kind === "treatment" ||
           (k === "tbi" && /פגיע(?:ת|ות) ראש|פגיעה מוחית|נוירו|קוגניטיב|זעזוע מוח/.test(r.s.name))),
        r => r.sc + (injuryFocus(r.s).includes(k) ? 4 : 0) + (r.s.category === "medical-rehab" ? 2 : 0) +
          (k === "tbi" ? (/נוירו|קוגניטיב/.test(r.s.name + " " + r.s.description) ? 6 : 0) + (/פגיעות ראש|פגיעה מוחית/.test(r.s.name) ? 3 : 0) : 0)),
        k === "tbi" ? "שיקום אחרי פגיעת ראש" : "שיקום הגוף");
    // טיפול נפשי כשסימנו קושי נפשי
    if (p.difficulties.some(x => MENTAL.includes(x) && x !== "loneliness" || x === "ptsd"))
      take(best(isTreatment, tx), "לדבר עם מישהו");   // מסגרת אינטנסיבית היא לא הצעד הראשון
    // ליווי בהכרה: עדיפות לליווי אישי ולמה שמומלץ בקהילה, על פני פורטל מידע
    if (p.implied || p.worsened || p.statuses.some(x => x === "mod-in-process" || x === "not-recognized"))
      take(best(r => r.s.category === "rights-legal" && arr(r.s.difficulties).includes("bureaucracy"),
        r => r.sc + (starred(r.s) ? 4 : 0) + (/ליווי|ייצוג|מימון הליך/.test(r.s.name) ? 3 : 0) - (/פורטל|מדריך|המלצות/.test(r.s.name) ? 4 : 0) +
          (p.worsened ? (/החמרה|בדיקה מחדש/.test(r.s.name) ? 10 : /הגשת בקשה להכרה|מסלול ירוק|מסלול מהיר/.test(r.s.name) ? -6 : 0) : 0)),
        p.worsened ? "במקביל: בקשה להחמרה" : "במקביל: לסדר את ההכרה");
    // בדידות: קבוצת עמיתים
    // בדידות: קבוצה. עדיפות לקבוצה שעושה משהו שהוא אוהב (ריצה, טבע), כי למי שמסתגר קל יותר להגיע לפעילות מאשר "לקבוצת תמיכה"
    if (p.difficulties.includes("loneliness")) take(best(r => (r.s.category === "peer-support" || arr(r.s.interests).some(i => p.interests.includes(i))) && arr(r.s.difficulties).includes("loneliness") || (p.era === "older" && r.s.era === "older"),
      r => r.sc + (arr(r.s.interests).some(i => p.interests.includes(i)) ? 4 : 0) + (p.era === "older" && r.s.era === "older" ? 9 : 0)), "לא להיות לבד עם זה");
    // תחום עניין: שירות שזה עיקרו (ים לגלישה, טבע לחווה), לא שירות שמזכיר את זה בדרך אגב
    if (p.interests.length)
      take(best(r => arr(r.s.interests).some(i => p.interests.includes(i)) && p.interests.some(i => (INTEREST_CATS[i] || []).includes(r.s.category))), "משהו שהוא לא טיפול");
    // השלמה לשלוש תחנות: רק מה שעונה על קושי (לא רק "פוסט טראומה" הכללי) או על תחום עניין, ובלי כלבים/סוסים למי שלא בחר בעלי חיים
    const relevant = r => (arr(r.s.difficulties).some(d => d !== "ptsd" && p.difficulties.includes(d)) || likesIt(r)) &&
      (r.s.category !== "animal-therapy" || p.interests.includes("animals"));
    // משפחה או שכול בלבד: לא תוכנית שבשמה "ללוחמים" או "לפצועים"
    const familyOnly = p.statuses.length && p.statuses.every(x => x === "families" || x === "bereaved");
    const pool = res.filter(r => !infoItem(r.s) && !isSupplier(r.s) && !notMine(r) && relevant(r) && !(familyOnly && /ללוחמי|ללוחמות|לפצועי|לנכי/.test(r.s.name)));
    for (const r of pool) if (first.length < 3 && !first.includes(r) && !first.some(f => areaOf(f.s.category) === areaOf(r.s.category))) first.push(r);
    for (const r of pool) take(r);
    for (const r of pool) if (first.length < 3 && !first.includes(r)) first.push(r);
    // שתי תחנות עם אותה כותרת: לשנייה "ועוד אפשרות"
    first.forEach((r, i) => { if (!r.role || first.slice(0, i).some(f => f.role === r.role)) r.role = "ועוד אפשרות"; });
    // התחנה הראשונה: משהו שאפשר לפנות אליו עכשיו (טלפון, אתר או מייל)
    const direct = r => !!(r.s.phone || r.s.website || r.s.email);
    first.sort((a, b) => direct(b) - direct(a));
    if (first[0] && first[0].role) first[0].role = first[0].role.replace(/^במקביל: /, "");
    return first;
  }

  // ---------- components ----------
  const AREAS = window.AREAS || {};
  const areaOf = cat => Object.keys(AREAS).find(k => AREAS[k].cats.includes(cat)) || "soul";
  const areaLabel = a => isEn() && I18N.TAX.areas && I18N.TAX.areas[a] ? I18N.TAX.areas[a][0] : AREAS[a].label;
  const areaSub = a => isEn() && I18N.TAX.areas && I18N.TAX.areas[a] ? I18N.TAX.areas[a][1] : AREAS[a].sub;
  const areaTag = s => { const a = areaOf(s.category); return `<span class="area-tag area-${a}">${esc(areaLabel(a))}</span>`; };
  // קווים שנמשכו ביד: אותו קו משמש לרשימות, לתחנות ולגל
  const HAND_LINE = `<svg class="hand-line" viewBox="0 0 24 400" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M12 0 C 4 40, 20 70, 12 110 C 4 150, 22 180, 12 220 C 2 260, 20 300, 12 340 C 6 370, 16 390, 12 400" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  const WAVE = `<svg class="wave" viewBox="0 0 346 18" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M2 9 Q 22 1 43 9 T 86 9 T 129 9 T 172 9 T 215 9 T 258 9 T 301 9 T 344 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  const TICK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 13 C 7 15, 8 17, 10 19 C 13 13, 16 8, 21 4"/></svg>`;
  // כוכב: כמה הודעות המלצה היו עליו בקבוצת הנכים והלוחמים (מינימום 3, ורק כשההמלצות רבות מהתלונות)
  const STAR_MIN = 3;
  const starred = s => (s.community_recs || 0) >= STAR_MIN;
  const STAR = `<svg class="star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 C 12.8 7, 14 9.6, 21.5 10.2 C 16 13, 15.6 15, 17.6 21.5 C 13.8 18, 10.4 18, 6.4 21.5 C 8.4 15, 8 13, 2.5 10.2 C 10 9.6, 11.2 7, 12 2.5 Z"/></svg>`;
  const starTag = s => starred(s) ? `<span class="star-tag">${STAR}${esc(t("מומלץ בקהילה"))}</span>` : "";
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
  // הסיבות נבנות בעברית בפונקציית הציון (שנבדקת גם בלי ממשק). כאן מתרגמים אותן לתצוגה.
  const labelsEn = (group, list) => list.split(", ").map(l => { const k = Object.keys(T[group]).find(x => T[group][x] === l); return k ? TX(group, k) : l; }).join(", ");
  const trWhy = w => {
    if (!isEn() || !w) return w;
    let m;
    if ((m = w.match(/^עוזר ב: (.+)$/))) return t("עוזר ב: {x}", { x: labelsEn("difficulties", m[1]) });
    if ((m = w.match(/^מתאים לתחומי עניין: (.+)$/))) return t("מתאים לתחומי עניין: {x}", { x: labelsEn("interests", m[1]) });
    if ((m = w.match(/^קרוב אליך, כ-(\d+) ק"מ$/))) return t("קרוב אליך, כ-{n} ק\"מ", { n: m[1] });
    if ((m = w.match(/^כ-(\d+) ק"מ ממך$/))) return t("כ-{n} ק\"מ ממך", { n: m[1] });
    return t(w);
  };
  // "למה זה מתאים לך": עובדות שמשנות את ההחלטה אם לפנות, לא חזרה על מה שסימנת
  function facts(s, p) {
    const f = [];
    const c = cycleLabel(s); if (c) f.push(c);
    const st = p ? p.statuses : [];
    const recognized = st.includes("mod-recognized");
    const text = [s.description, s.how_to_apply, s.cost_notes, s.avail].join(" ");
    if (p && !recognized && s.kind !== "rights" && (s.recognition === "not_required" || /בלי הכרה|ללא הכרה|לא צריך הכרה|אין צורך בהכרה|גם למי שלא מוכר|גם בלי הכרה/.test(text))) f.push(t("לא צריך הכרה"));
    if (p && isForces(st) && s.police === "yes") f.push(st.includes("police") ? t("פתוח לשוטרים") : t("פתוח לכוחות הביטחון"));
    if (s.cost === "free") f.push(t("חינם"));
    else if (s.cost === "mod-funded" && (recognized || st.includes("mod-in-process"))) f.push(t("במימון משרד הביטחון"));
    if (/בלי תור|ללא תור|ללא המתנה|אין המתנה|בלי המתנה/.test(text)) f.push(t("בלי תור"));
    const km = p ? kmTo(s, p) : null;
    if (km != null && km <= 60) f.push(t("כ-{n} ק\"מ ממך", { n: Math.max(km, 1) }));
    else if (arr(s.regions).includes("online") || s.format === "online") f.push(t("אפשר מהבית"));
    return f.slice(0, 3);
  }
  // הצעד הראשון: המשפט הראשון של "איך מתחילים"
  // משפט שמתאר למי זה מתאים ("מתאים למי ש...") הוא לא צעד. לוקחים את המשפט הבא.
  const firstStep = s => {
    const t = (s.how_to_apply || "").trim(); if (!t) return "";
    const parts = t.split(/(?<=[.!?])\s+/);   // רק נקודה שאחריה רווח: לא שוברים מייל או אתר
    const step = parts.map(x => x.trim()).find(x => x.length > 8 && !/^(?:מתאים|מיועד|רק ל|הזכאות|זכאים)/.test(x)) || parts[0].trim();
    return step.length > 160 ? shortDesc(step, 150) : step;
  };
  const distinctWhy = list => new Set(list.map(whyText)).size > 1;
  const shortDesc = (t, n) => (t || "").length > n ? (t || "").slice(0, n).replace(/\s+\S*$/, "") + "…" : (t || "");

  function chip(group, key, label, checked) {
    return `<label class="chip"><input type="checkbox" name="${group}" value="${esc(key)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  // שורה קצרה ברשימה: שם, משפט פתיחה בשורה אחת, ושורת פרטים. כל השאר בכרטיס שנפתח.
  const hasWait = s => /המתנ|ארוך/.test(s.avail || "");
  // מחזורים: "נפתח ב-16.11" לקבוצה שעוד לא התחילה, "לא מקבלים כרגע" למה שסגור עכשיו
  const cycleLabel = s => {
    if (s.status === "closed_now") return t("לא מקבלים כרגע");
    if (s.status !== "future_cycle" || !s.next_cycle) return "";
    const m = String(s.next_cycle).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    return m ? (m[3] ? t("מחזור חדש נפתח ב-{d}", { d: `${+m[3]}.${+m[2]}` }) : t("מחזור חדש נפתח בחודש {d}", { d: `${+m[2]}/${m[1]}` })) : t("מחזור חדש: {d}", { d: s.next_cycle });
  };
  function card(s, why, noTag) {
    const meta = [costLabel(s.cost), ...arr(s.regions).slice(0, 1).map(r => TX("regions", r) || r)];
    if (cycleLabel(s)) meta.unshift("📅 " + cycleLabel(s));
    if (hasWait(s)) meta.push(t("⏳ יש המתנה"));
    if (isSupplier(s)) meta.push(t("ספק בסל Shikum.Me"));
    if (s.source === "community") meta.push(t("נוסף ע״י הקהילה"));
    else if (s.verified_at) meta.push(t("✓ נבדק"));
    return `
      <article class="card" data-open="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}">
        <div class="card-main">
          <div class="he-wrap" lang="he" dir="rtl">${nameBlock(s)}
          ${splitName(s.name).sub ? "" : `<p class="teaser">${esc(shortDesc(s.description, 110))}</p>`}</div>
          ${why && why.length ? `<span class="why">${isEn() ? "→" : "←"} ${esc(trWhy(why[0]))}</span>` : ""}
          <span class="meta-line">${starTag(s)}${noTag ? "" : areaTag(s)}${esc(meta.join(" · "))}</span>
          ${maybeTag(s, loadProfile())}
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
        (items.length > shown ? `<button class="more-btn" type="button">${esc(t("עוד {n} מתוך {m}", { n: Math.min(PAGE * 2, items.length - shown), m: items.length - shown }))}</button>` : "");
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
  // ---------- דף הבית ----------
  // לפי צורך, בשפה של האדם (לא "ים/אדמה"): כל כפתור הוא סינון של המאגר
  const NEEDS = [
    { k: "talk", label: "לדבר עם מישהו", test: s => s.category === "hotlines" || s.kind === "treatment" && (s.category === "mental-health" || arr(s.difficulties).some(d => MENTAL.includes(d))) },
    { k: "sleep", label: "לישון טוב יותר", test: s => s.category !== "hotlines" && arr(s.difficulties).includes("sleep") },
    { k: "family", label: "זוגיות ומשפחה", test: s => s.category !== "hotlines" && (s.category === "family-support" || s.kind === "family" || /זוג|משפח|הורים|ילדים|אבות|אמהות/.test(s.name)) },
    { k: "rights", label: "הכרה וזכויות", test: s => s.category === "rights-legal" || s.kind === "rights" },
    { k: "body", label: "משהו בגוף או בטבע", test: s => ["sports", "water-sports", "nature-retreats", "rehab-farm", "yoga-mind-body", "animal-therapy"].includes(s.category) },
    { k: "people", label: "אנשים כמוני", test: s => s.category !== "hotlines" && (s.kind === "peer" || s.category === "peer-support" || s.kind === "activity" && s.format === "group" || /קהילה|קהילת|מעגל|קבוצת תמיכה/.test(s.name)) },
    { k: "work", label: "עבודה ולימודים", test: s => s.category === "employment-education" || s.kind === "work" },
    { k: "money", label: "כסף ומענקים", test: s => s.category === "financial-grants" || s.kind === "money" }
  ];
  const needChips = () => `<nav class="needs" aria-label="${t("לפי צורך")}">${NEEDS.map(n => `<a href="#/need?n=${n.k}">${esc(t(n.label))}</a>`).join("")}</nav>`;
  const homeSearch = () => `<form class="h-search" id="h-search" role="search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="search" name="q" placeholder="${t("מה מחפשים? למשל: גלישה, עורך דין, שינה")}" aria-label="${t("חיפוש")}" autocomplete="off">
    </form>`;
  const bindHomeSearch = () => { const f = document.getElementById("h-search"); if (f) f.onsubmit = e => { e.preventDefault(); const q = new FormData(f).get("q").trim(); location.hash = "#/browse" + (q ? "?q=" + encodeURIComponent(q) : ""); }; };

  // "נפתח בקרוב": מחזורים שעוד לא התחילו. באזור שלך, וגם ארצי ומקוון
  const HE_MON = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
  const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monName = i => (isEn() ? EN_MON : HE_MON)[i];
  function upcoming(p, n) {
    const today = new Date().toISOString().slice(0, 10);
    const regs = p && p.regions.length ? withNear(p.regions) : null;
    return SERVICES.filter(s => s.status === "future_cycle" && s.next_cycle && !s.no_contact)
      .map(s => { const m = String(s.next_cycle).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); return { s, m, key: m ? s.next_cycle.padEnd(10, "-01".slice(0, 10 - s.next_cycle.length)) : "9999" }; })
      .filter(x => !x.m || x.key >= today.slice(0, x.m[3] ? 10 : 7))
      .filter(x => !regs || arr(x.s.regions).some(r => r === "nationwide" || r === "online" || regs.includes(r)))
      .filter(x => !p || (eligible(x.s, p.statuses) && familyFit(x.s, p) && (!womenOnly(x.s) || p.gender === "f")))
      .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
      .slice(0, n || 99);
  }
  const upcomingList = items => `<div class="mini">${items.map(({ s, m }) => `<div data-open="${esc(s.id)}" tabindex="0" role="button">
      <span class="d">${m ? (m[3] ? `${+m[3]}<small>${monName(+m[2] - 1)}</small>` : `${monName(+m[2] - 1)}<small>${m[1]}</small>`) : t("בקרוב")}</span>
      <span class="t"><b lang="he" dir="rtl">${esc(splitName(s.name).main)}</b><small>${s.location ? `<span lang="he" dir="rtl">${esc(s.location.slice(0, 60))}</span>` : ""}${s.location && arr(s.regions).includes("online") ? " · " : ""}${arr(s.regions).includes("online") ? t("מקוון") : ""}</small></span></div>`).join("")}</div>`;

  function viewHome() {
    const prof = loadProfile();
    if (prof) return viewReturning(prof);
    const soon = upcoming(null, 3);
    $main.innerHTML = `
      <section class="home">
        <div id="followup"></div>
        <div class="glass hero">
          <div class="lockup">${LOGO(56)}<div class="wordmark">${t("אזימוט")}</div></div>
          <h1 class="welcome-title">${t("מוצאים מה יכול לעזור לך, ואיך מגיעים לשם.")}</h1>
          <p class="welcome-sub">${t("יותר מ-{n} מקומות לנכי צה״ל, מילואימניקים, לוחמים, שוטרים ומי שעוד לא הוכר. בלי הרשמה.", { n: Math.floor(SERVICES.length / 100) * 100 })}</p>
          <a class="btn btn-ink btn-wide welcome-cta" href="#/match"><span class="big">${t("יוצאים לדרך")}</span><span class="small">${t("4 שאלות קצרות · תחנות שמתאימות לך")}</span></a>
        </div>
        ${isEn() ? `<p class="note quiet lang-note">${t("פרטי השירותים כתובים בעברית")}</p>` : ""}
        <h2 class="h-sec">${t("או לחפש לבד")}</h2>
        ${homeSearch()}${needChips()}
        ${soon.length ? `<h2 class="h-sec">${t("נפתח בקרוב")} <a href="#/soon">${t("הכול")}</a></h2>${upcomingList(soon)}` : ""}
        <p class="note quiet center">${t("נבנה בהתנדבות, מתוך רצון לעזור. בלי פרסומות, ואף אחד לא מרוויח מזה.")} <a class="link-u" href="#/about">${t("למה אזימוט קיים")}</a></p>
      </section>`;
    bindHomeSearch();
    followupCard(document.getElementById("followup"));
  }
  function viewReturning(p) {
    const first = pickStations(p, match(p, { all: true }));   // אותן תחנות כמו בדף התוצאות
    const soon = upcoming(p, 3);
    $main.innerHTML = `
      <section class="home">
        <div id="followup"></div>
        <h1 class="h-title">${t("שלום שוב. מה צריך היום?")}</h1>
        ${homeSearch()}${needChips()}
        ${first.length ? `<h2 class="h-sec">${t("התחנות שלך")} <a href="#/match">${t("לשנות")}</a></h2>
        <div class="mini">${first.map((r, n) => { const f = facts(r.s, p); return `<div data-open="${esc(r.s.id)}" tabindex="0" role="button">
          <span class="n">${n + 1}</span><span class="t"><b lang="he" dir="rtl">${esc(splitName(r.s.name).main)}</b><small>${esc([t(r.role), ...f.slice(0, 2)].filter(Boolean).join(" · "))}</small></span></div>`; }).join("")}</div>
        <p class="actions"><a class="link-u" href="#/results">${t("לכל מה שמתאים לך ←")}</a></p>` : `<p class="empty">${t("לא מצאנו התאמה.")} <a href="#/match">${t("לשנות תשובות")}</a></p>`}
        ${soon.length ? `<h2 class="h-sec">${t("נפתח בקרוב באזור שלך")} <a href="#/soon">${t("הכול")}</a></h2>${upcomingList(soon)}`
          : `<p class="actions"><a class="link-u" href="#/soon">${t("קבוצות ותוכניות שנפתחות בקרוב ←")}</a></p>`}
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>${t("מכירים מקום שעוזר ולא מופיע?")}</strong><br>${t("להוסיף בדקה")}</span></a>
      </section>`;
    bindHomeSearch();
    followupCard(document.getElementById("followup"));
  }
  // לפי צורך: רשימה מסוננת. עם שאלון: לפי ההתאמה האישית. בלי: לפי מה שמומלץ ונבדק
  // בלי שאלון: קודם הקווים המרכזיים, מה שמומלץ בקהילה, ומה שמיועד לכלל הלוחמים, ולא לקבוצה צרה (נפגעי טרור, תקיפה מינית)
  const MAIN_LINES = /נפש אחת|^נט"ל – קו|^ער"ן|^סה"ר/;
  const BROAD_EL = ["combat-soldiers", "reservists", "mod-recognized", "mod-in-process", "not-recognized", "security-forces"];
  function generalRank(s, k) {
    let r = 0;
    if (k === "talk" && s.category === "hotlines") r += MAIN_LINES.test(s.name) ? 12 : 3;
    r += Math.min(10, s.community_recs || 0);
    if (arr(s.eligibility).some(e => BROAD_EL.includes(e))) r += 3;
    else if (arr(s.eligibility).length && arr(s.eligibility).every(e => e === "terror-victims" || e === "civilians")) r -= 4;
    if (s.verified_at) r += 1;
    if (infoItem(s)) r -= 3;
    if (s.status === "future_cycle") r += 1;
    return r;
  }
  function viewNeed(params) {
    const need = NEEDS.find(n => n.k === params.get("n")) || NEEDS[0];
    const p = loadProfile();
    const ok = s => need.test(s) && !s.no_contact && s.status !== "closed_now" && !(p ? !supplierOk(s, p) : isSupplier(s));
    let list;
    if (p) list = match(p, { all: true }).filter(r => ok(r.s)).map(r => r.s);
    else list = SERVICES.filter(ok).sort((a, b) => generalRank(b, need.k) - generalRank(a, need.k));
    if (p && list.length < 5) list = list.concat(SERVICES.filter(s => ok(s) && !list.includes(s) && eligible(s, p.statuses)));
    $main.innerHTML = `
      <section>
        <h1 class="page-title">${esc(t(need.label))}</h1>
        <p class="lead">${p ? t("{n} מקומות, מסודרים לפי מה שהכי מתאים לך.", { n: list.length }) : t("{n} מקומות.", { n: list.length }) + ` <a class="link-u" href="#/match">${t("לסדר לפי מה שמתאים לי")}</a>`}</p>
        ${needChips()}
        <div class="grid" id="need-list"></div>
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>${t("חסר משהו?")}</strong><br>${t("להוסיף מקום או שירות")}</span></a>
      </section>`;
    $main.querySelectorAll(".needs a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#/need?n=" + need.k));
    pagedList(document.getElementById("need-list"), list, s => { const f = facts(s, p); return card(s, f.length ? [f.join(" · ")] : null); });
  }
  function viewSoon() {
    const p = loadProfile();
    const mine = p ? upcoming(p) : [];
    const ids = new Set(mine.map(x => x.s.id));
    const rest = upcoming(null).filter(x => !ids.has(x.s.id));
    $main.innerHTML = `
      <section>
        <h1 class="page-title">${t("נפתח בקרוב")}</h1>
        <p class="lead">${t("קבוצות ותוכניות שהמחזור הבא שלהן מתחיל בקרוב. כדאי להירשם מראש.")}</p>
        ${mine.length ? `<h2 class="h-sec">${t("מתאים לך, באזור שלך וארצי")}</h2>${upcomingList(mine)}` : ""}
        ${rest.length ? `<h2 class="h-sec">${p ? t("עוד מחזורים (אולי לא מתאימים לסטטוס או לאזור שלך)") : t("כל המחזורים")}</h2>${upcomingList(rest)}` : ""}
        ${!mine.length && !rest.length ? `<p class="empty">${t("כרגע אין מחזורים קרובים במאגר.")}</p>` : ""}
      </section>`;
  }
  function viewExplore() {
    const prof = loadProfile();
    const counts = {};
    SERVICES.forEach(s => { const a = areaOf(s.category); counts[a] = (counts[a] || 0) + 1; });
    $main.innerHTML = `
      <section>
        <h1 class="page-title">${t("מה מושך אותך?")}</h1>
        <p class="lead">${t("לנכי צה״ל, מילואימניקים, לוחמים, שוטרים ולמי שעוד לא הוכר.")}</p>
        <ul class="areas lined">
          ${HAND_LINE}
          ${Object.keys(AREAS).map(k => `
            <li>
              <span class="node" aria-hidden="true"></span>
              <a href="#/area?a=${k}">
                <span class="dabbed area-${k}"><span class="word${areaLabel(k).length > (isEn() ? 6 : 4) ? " long" : ""}">${esc(areaLabel(k))}</span></span>
                <span class="sub">${esc(areaSub(k))}</span>
              </a>
            </li>`).join("")}
        </ul>
        <a class="btn btn-wide home-cta" href="#/match">${t("לא בטוח? 4 שאלות קצרות")}</a>
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>${t("מכירים מקום שעוזר ולא מופיע כאן?")}</strong><br>${t("להוסיף בדקה. ככה המאגר גדל.")}</span></a>
        ${prof ? `<p class="saved-link"><a class="link-u" href="#/results">${t("לתחנות שלי ←")}</a></p>` : ""}
        <p class="note quiet">${t("בלי הרשמה. מה שמסמנים נשאר רק במכשיר.")}</p>
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
    items = [...items.filter(s => !isSupplier(s)), ...items.filter(isSupplier)];   // ספקי Shikum.Me אחרי התוכניות
    const top = items[0], rest = items.slice(1);
    const cats = A.cats.filter(c => c !== "hotlines" && rest.some(s => s.category === c));
    $main.innerHTML = `
      <section class="area-${k}">
        <div class="area-hero">
          <h1 class="dabbed"><span class="word${areaLabel(k).length > (isEn() ? 6 : 4) ? " long" : ""}">${esc(areaLabel(k))}</span></h1>
          <span class="note">${t("{n} אפשרויות", { n: items.length })}<br>${esc(areaSub(k))}</span>
        </div>
        ${WAVE}
        ${top ? `
          <article class="sheet" style="margin-top: 16px">
            <span class="note highlight">${p ? t("הכי מתאים לך") : t("כדאי להתחיל כאן")} · ${esc(costLabel(top.cost))}</span>
            ${starTag(top)}
            <div class="he-wrap" lang="he" dir="rtl">${nameBlock(top, "h2")}
            <p class="clamp-2">${esc(shortDesc(top.description, 140))}</p></div>
            <div class="actions">
              <button class="btn btn-ink" type="button" data-open="${esc(top.id)}">${t("לפרטים וליצירת קשר")}</button>
            </div>
          </article>` : `<p class="empty">${t("עוד אין כאן שירותים.")} <a href="#/provider">${t("להציע גוף")}</a></p>`}
        ${cats.length > 1 ? `<nav class="subcats" aria-label="${t("סינון")}">
          <button type="button" class="active" data-cat="">${t("הכל")}</button>
          ${cats.map(c => `<button type="button" data-cat="${c}">${esc(shortCat(c))}</button>`).join("")}
        </nav>` : ""}
        <div class="grid" id="area-list" style="margin-top: 6px"></div>
        ${!p ? `<p class="actions"><a class="link-u" href="#/match">${t("לסדר לפי מה שמתאים לי ←")}</a></p>` : ""}
        <a class="add-row" href="#/add?a=${k}"><span class="plus" aria-hidden="true">+</span><span><strong>${t("חסר כאן משהו?")}</strong><br>${esc(t("להוסיף מקום ל{area}", { area: areaLabel(k) }))}</span></a>
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
  const shortCat = c => SHORT_CAT[c] ? t(SHORT_CAT[c]) : catLabel(c);

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

  // השאלה "מה הכי חשוב לך עכשיו" קובעת את התחנה הראשונה
  const GOALS = { talk: "לדבר עם מישהו מקצועי", do: "לצאת ולעשות משהו", people: "להיות עם אנשים שמבינים", rights: "לסדר זכויות וכסף" };
  const taxOpts = group => Object.fromEntries(Object.keys(T[group]).map(k => [k, TX(group, k)]));
  function viewMatch() {
    const p = loadProfile() || { statuses: [], difficulties: [], interests: [], regions: [], maxCost: null };
    const steps = [
      { key: "statuses", title: t("מה המצב שלך?"), sub: t("אפשר לסמן כמה. זה קובע למה יש לך זכאות."), opts: taxOpts("eligibility") },
      { key: "difficulties", title: t("עם מה הכי קשה עכשיו?"), sub: t("אפשר לבחור כמה. אין תשובה לא נכונה."), opts: taxOpts("difficulties") },
      { key: "interests", title: t("מה מדבר אליך?"), sub: t("דברים שאוהבים, או שתמיד רצית לנסות."), opts: taxOpts("interests") },
      { key: "regions", title: t("איפה נוח לך?"), sub: t("שירותים ארציים ואונליין יופיעו תמיד."), opts: taxOpts("regions") }
    ];
    let idx = 0;
    function render() {
      const st = steps[idx];
      const last = idx === steps.length - 1;
      $main.innerHTML = `
        <section class="wizard">
          <p class="step-count">${t("שלב {n} מתוך {m}", { n: idx + 1, m: steps.length })}</p>
          <h1 class="page-title">${st.title}</h1>
          <p class="lead">${st.sub}</p>
          <form id="step-form">
            <div class="chips">
              ${Object.keys(st.opts).filter(k => !(st.key === "regions" && (k === "nationwide" || k === "online")))
                .map(k => chip(st.key, k, st.opts[k], p[st.key].includes(k))).join("")}
            </div>
            ${st.key === "statuses" ? `<div id="followups"></div>` : ""}
            ${st.key === "difficulties" ? `<fieldset class="followup goal-q"><legend>${t("ומה הכי חשוב לך עכשיו?")}</legend><div class="chips small">${
              Object.entries(GOALS).map(([k, l]) => `<label class="chip"><input type="radio" name="goal" value="${k}" ${p.goal === k ? "checked" : ""}><span>${esc(t(l))}</span></label>`).join("")}</div></fieldset>` : ""}
            ${st.key === "regions" ? `<label class="town-q">${t("היישוב שלך (לא חובה, כדי לחשב מרחק)")}
              <input name="town" list="towns-list" autocomplete="off" value="${esc(p.town || "")}" placeholder="${t("למשל: טבריה")}" lang="he" dir="auto">
              <datalist id="towns-list">${(window.TOWNS || []).map(t => `<option value="${esc(t[0])}">`).join("")}</datalist></label>` : ""}
            ${last ? `
              <fieldset class="cost-pref">
                <legend>${t("עלות")}</legend>
                <label><input type="radio" name="maxCost" value="0" ${p.maxCost === 0 ? "checked" : ""}> ${t("רק ללא עלות")}</label>
                <label><input type="radio" name="maxCost" value="3" ${p.maxCost === 3 ? "checked" : ""}> ${t("גם השתתפות חלקית")}</label>
                <label><input type="radio" name="maxCost" value="" ${p.maxCost == null ? "checked" : ""}> ${t("לא משנה")}</label>
              </fieldset>` : ""}
            <div class="wizard-nav">
              ${idx > 0 ? `<button type="button" class="link-u" id="back">${t("חזרה")}</button>` : ""}
              <button type="button" class="link-u" id="skip">${t("לדלג")}</button>
              <button type="submit" class="btn btn-ink">${last ? t("הראו לי") : t("המשך")}</button>
            </div>
          </form>
        </section>`;
      const form = document.getElementById("step-form");
      // שאלות המשך קצרות, רק כשהן רלוונטיות: החמרה (למוכרים), תקופת השירות הקרבי (ללוחמים ומילואים), גיל (לא חובה)
      const fu = document.getElementById("followups");
      const radioRow = (name, legend, opts, cur) => `<fieldset class="followup"><legend>${legend}</legend><div class="chips small">${
        Object.entries(opts).map(([k, l]) => `<label class="chip"><input type="radio" name="${name}" value="${k}" ${cur === k ? "checked" : ""}><span>${esc(t(l))}</span></label>`).join("")}</div></fieldset>`;
      const drawFollow = () => {
        if (!fu) return;
        const on = k => !!form.querySelector(`input[name="statuses"][value="${k}"]:checked`);
        const anyRec = on("mod-recognized") || on("mod-in-process") || on("not-recognized");
        fu.innerHTML =
          (on("families") || on("bereaved") ? radioRow("relation", on("bereaved") ? t("מה הקשר שלך לחלל/ה?") : t("מה הקשר שלך?"),
            { partner: "בן/בת זוג", parent: "הורה", child: "ילד/ה", sibling: "אח/ות" }, p.relation) : "") +
          (on("families") && !on("bereaved") ? radioRow("famof", t("בן/בת משפחה של מי?"),
            { wounded: "פצוע/ה, נכה או מתמודד/ת עם פוסט טראומה", reservist: "משרת/ת מילואים", hostage: "חטוף/ה שחזר/ה" }, p.famof) : "") +
          ((on("police") || on("security-forces")) && !anyRec ? radioRow("secrec", t("ומה עם הכרה בנכות? (לשוטרים ולכוחות הביטחון זה דרך אגף השיקום)"),
            { "mod-recognized": "מוכר/ת", "mod-in-process": "בתהליך", "not-recognized": "לא הגשתי / לא יודע/ת" }, p.secrec) : "") +
          (on("mod-recognized") ? radioRow("worsened", t("ומאז ההכרה?"), { yes: "המצב החמיר", no: "פחות או יותר אותו דבר" }, p.worsened === true ? "yes" : p.worsened === false ? "no" : "") : "") +
          (on("combat-soldiers") || on("reservists") ? radioRow("era", t("מתי היה עיקר השירות הקרבי?"), { "iron-swords": "במלחמה הנוכחית, מאז 2023", "2000s": "בין 2000 ל-2023", older: "לפני 2000 (לבנון, רצועת הביטחון, יום כיפור)" }, p.era) : "") +
          radioRow("age", t("גיל (לא חובה)"), { u30: "עד 30", "30-45": "30 עד 45", "45-60": "45 עד 60", "60+": "60 ומעלה" }, p.age) +
          radioRow("gender", t("איך לפנות אליך? (לא חובה, כדי להציג גם מסגרות לנשים בלבד)"), { f: "אישה", m: "גבר" }, p.gender);
      };
      if (fu) { drawFollow(); form.addEventListener("change", e => { if (e.target.name === "statuses") drawFollow(); }); }
      const collect = () => {
        p[st.key] = [...form.querySelectorAll(`input[name="${st.key}"]:checked`)].map(i => i.value);
        if (st.key === "regions") { const tv = (form.querySelector('input[name="town"]') || {}).value || ""; p.town = townOf(tv) ? townOf(tv)[0] : null; }
        if (st.key === "difficulties") { const g = form.querySelector('input[name="goal"]:checked'); p.goal = g ? g.value : null; }
        if (st.key !== "statuses") return;
        const val = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value || null;
        // הכרה של שוטר / איש כוחות ביטחון: נכנסת לסטטוסים עצמם
        p.relation = p.statuses.some(x => x === "families" || x === "bereaved") ? val("relation") : null;
        p.famof = p.statuses.includes("families") && !p.statuses.includes("bereaved") ? val("famof") : null;
        p.secrec = val("secrec");
        if (p.secrec && !p.statuses.includes(p.secrec)) p.statuses = [...p.statuses, p.secrec];
        const w = val("worsened");
        p.worsened = p.statuses.includes("mod-recognized") && w ? w === "yes" : null;
        p.era = p.statuses.some(x => x === "combat-soldiers" || x === "reservists") ? val("era") : null;
        p.age = val("age");
        p.gender = val("gender");
      };
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
    const first = pickStations(p, match(p, { all: true }));
    first.forEach(f => { if (!res.some(r => r.s.id === f.s.id)) res.push(f); });
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
    const who = [...p.statuses.map(s => SHORT[s] && t(SHORT[s])).slice(0, 2), ...p.regions.map(r => TX("regions", r)).slice(0, 1)].filter(Boolean).join(" · ");
    $main.innerHTML = `
      <section>
        <h1 class="page-title">${first.length ? t("התחנות שלך") : t("לא מצאנו התאמה מדויקת")}</h1>
        ${who ? `<p class="lead">${esc(who)}</p>` : ""}
        <p class="actions"><a class="link-u" href="#/match">${t("לשנות תשובות")}</a></p>
        ${isEn() ? `<p class="note quiet lang-note">${t("פרטי השירותים כתובים בעברית")}</p>` : ""}
        ${noInput ? `<div class="callout">${t("כדי שהרשימה תהיה קצרה ומדויקת, כדאי לסמן לפחות קושי אחד או תחום עניין.")} <a href="#/match">${t("לסמן עכשיו")}</a></div>` : ""}
        ${crisis ? `<p class="crisis-inline">${t("קשה עכשיו? אפשר לדבר עם מישהו גם בלילה.")} <a href="#/help">${t("עזרה עכשיו ←")}</a></p>` : ""}
        ${first.length ? `
          <ol class="stations lined">
            ${HAND_LINE}
            ${first.map((r, n) => {
              const s = r.s;
              return `<li>
                <span class="st-node" aria-hidden="true">${n + 1}</span>
                ${r.role ? `<p class="st-role">${esc(t(r.role))}</p>` : ""}
                <div class="he-wrap" lang="he" dir="rtl">${nameBlock(s, "h2", `data-open="${esc(s.id)}" tabindex="0" role="button"`)}</div>
                ${(() => { const f = facts(s, p); return f.length ? `<p class="facts">${f.map(x => `<span>${esc(x)}</span>`).join("")}</p>` : `<div class="tag-row">${starTag(s)}<span class="cost-tag">${esc(costLabel(s.cost))}</span></div>`; })()}
                ${maybeTag(s, p)}${hasWait(s) && !cycleLabel(s) ? `<span class="wait-tag" lang="he" dir="rtl">⏳ ${esc(s.avail)}</span>` : ""}
                ${firstStep(s) ? `<p class="first-step"><strong>${t("הצעד הראשון:")}</strong> <span lang="he" dir="rtl">${linkify(firstStep(s))}</span></p>` : `<p class="clamp-2" lang="he" dir="rtl">${esc(shortDesc(s.description, 120))}</p>`}
                <div class="actions">
                  ${s.phone ? `<a class="btn btn-ink" href="${telHref(s.phone)}" dir="ltr">${esc(firstPhone(s.phone))}</a>` : ""}
                  <button class="link-u" type="button" data-open="${esc(s.id)}">${t("לפרטים")}</button>
                </div>
              </li>`;
            }).join("")}
          </ol>
          <div id="rate-results"></div>
          <p class="note avail-note">${t("כל המקומות כאן קיימים, אבל לא תמיד יש מקום מיד. כדאי לפנות לשניים או שלושה במקביל, ולשאול בשיחה הראשונה אם יש המתנה.")}${isForces(p.statuses) ? " " + t("מה שמסומן {tag} לא כותב במפורש שהוא פתוח {who}. שווה לשאול.", { tag: `<span class="maybe-tag">${t("אולי מתאים")}</span>`, who: forcesWord(p.statuses) }) : ""}</p>` : `<p class="empty">${t("נסו לסמן פחות סינונים, או")} <a href="#/">${t("לבחור תחום")}</a>.</p>`}
      </section>
      ${order.length ? `
        <section class="more-areas">
          <h2 class="section-title">${t("עוד אפשרויות שמתאימות לך, לפי תחום")}</h2>
          ${order.map(a => `
            <details class="area-${a}">
              <summary><span class="dabbed"><span class="display" style="font-size: 26px">${esc(areaLabel(a))}</span></span><span class="hand">${t("{n} אפשרויות", { n: byArea[a].length })}</span></summary>
              <div class="grid" data-area-list="${a}"></div>
              <p class="actions"><a class="link-u" href="#/area?a=${a}">${esc(t("לכל מה שיש ב{area} ←", { area: areaLabel(a) }))}</a></p>
            </details>`).join("")}
        </section>` : ""}
      <section class="pilot-cta">
        <p><strong>${t("גרסת ניסיון.")}</strong> ${t("הרשימה טובה כמו מה שכולנו יודעים. מה היה מדויק, מה חסר, איפה נתקעת?")} <a class="link-u" href="#/pilot">${t("משוב אנונימי · דקה")}</a></p>
      </section>`;
    rateBox(document.getElementById("rate-results"), "results", "r:" + hashStr(JSON.stringify(p)),
      () => Object.assign(profileCtx(p), { stations: first.map(r => r.s.id).join(",") }));
    $main.querySelectorAll("[data-area-list]").forEach(el => pagedList(el, byArea[el.dataset.areaList],
      r => { const f = facts(r.s, p); return card(r.s, f.length ? [f.join(" · ")] : r.why.filter(w => w !== "מתאים לסטטוס שלך"), true); }));
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
    const tags = [T.categories[s.category] ? T.categories[s.category].label : "", ...arr(s.interests).map(x => T.interests[x]), ...arr(s.difficulties).map(x => T.difficulties[x]),
      ...arr(s.regions).map(x => T.regions[x]), ...arr(s.eligibility).map(x => T.eligibility[x]),
      // באנגלית: גם התוויות המתורגמות, כדי ש-"surfing" או "PTSD" ימצאו משהו
      ...(isEn() ? [catLabel(s.category), ...arr(s.interests).map(x => TX("interests", x)), ...arr(s.difficulties).map(x => TX("difficulties", x)), ...arr(s.regions).map(x => TX("regions", x))] : [])
    ].join(" ").toLowerCase().replace(/["״׳'`]/g, "");
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
      `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(getLabel ? getLabel(k) : obj[k])}</option>`).join("");
    $main.innerHTML = `
      <section>
        <h1 class="page-title">${t("חיפוש")}</h1>
        ${isEn() ? `<p class="note quiet lang-note">${t("פרטי השירותים כתובים בעברית. אפשר לחפש גם בעברית.")}</p>` : ""}
        <form class="filters" id="filters">
          <input type="search" name="q" placeholder="${t("חיפוש: גלישה, סוסים, EMDR, מלגה…")}" value="${esc(st.q)}" aria-label="${t("חיפוש")}">
          <select name="cat" aria-label="${t("תחום")}"><option value="">${t("כל התחומים")}</option>${opt(T.categories, st.cat, k => TX("categories", k))}</select>
          <select name="el" aria-label="${t("זכאות")}"><option value="">${t("כל הסטטוסים")}</option>${opt(T.eligibility, st.el, k => TX("eligibility", k))}</select>
          <select name="region" aria-label="${t("אזור")}"><option value="">${t("כל האזורים")}</option>${opt(T.regions, st.region, k => TX("regions", k))}</select>
          <select name="cost" aria-label="${t("עלות")}"><option value="">${t("כל העלויות")}</option>${opt(T.cost, st.cost, k => TX("cost", k))}</select>
        </form>
        <p class="count" id="count"></p>
        <div class="grid" id="list"></div>
        <div id="rate-search"></div>
        <a class="add-row" href="#/add"><span class="plus" aria-hidden="true">+</span><span><strong>${t("לא מצאת?")}</strong><br>${t("להוסיף מקום או שירות")}</span></a>
      </section>`;
    const form = document.getElementById("filters");
    let rateTimer = null;
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
        out = hits.sort((a, b) => b.matched - a.matched || (isSupplier(a.s) ? 1 : 0) - (isSupplier(b.s) ? 1 : 0) || b.total - a.total).map(x => x.s);
      }
      document.getElementById("count").textContent = partial
        ? t("לא מצאנו התאמה לכל המילים. אלה {n} תוצאות שמתאימות לחלק מהן:", { n: out.length })
        : t("{n} תוצאות", { n: out.length });
      const list = document.getElementById("list");
      if (out.length) pagedList(list, out, s => card(s)); else list.innerHTML = `<p class="empty">${t("אין תוצאות. נסו חיפוש אחר.")}</p>`;
      // אחרי שהחיפוש נרגע (לא בכל הקשה): שאלה קצרה. בלי תוצאות: הצעה לשלוח את החיפוש, כדי שנחפש ונוסיף
      clearTimeout(rateTimer);
      const raw = (fd.get("q") || "").trim(), rs = document.getElementById("rate-search");
      rs.innerHTML = "";
      if (raw.length >= 2) rateTimer = setTimeout(() => {
        if (!document.body.contains(rs)) return;   // כבר עברו לעמוד אחר
        const key = "s:" + hashStr(normQ(raw));
        if (out.length) return rateBox(rs, "search", key, () => ({ query: raw, stations: out.slice(0, 5).map(s => s.id).join(",") }));
        if (ratedGet()[key]) return;
        rs.innerHTML = `<div class="rate-box"><p class="rate-q">${esc(t("לא מצאנו את \"{q}\". לשלוח לנו את החיפוש, כדי שנחפש ונוסיף?", { q: raw }))}</p>
          <div class="rate-btns"><button type="button" id="send-q">${t("לשלוח, בעילום שם")}</button></div><p class="rate-msg" role="status" aria-live="polite"></p></div>`;
        document.getElementById("send-q").onclick = async ev => {
          ev.target.disabled = true; ratedSet(key);
          rs.querySelector(".rate-msg").textContent = t("תודה! נחפש ונוסיף.");
          try { await Store.submit("rate", { where: "search-empty", rating: "empty", query: raw, v: VERSION, lang: I18N.lang }); } catch (e) { /* ignore */ }
        };
      }, 1500);
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
    if (!k) { $main.innerHTML = `<section><h1 class="big-word">${t("מה מגיע לי")}</h1></section>`; return; }
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
    const src = it => it.url ? `<a class="link-u src" href="${esc(it.url)}" target="_blank" rel="noopener">${t("למקור ←")}</a>` : "";
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
        <h1 class="big-word">${t("מה מגיע לי")}</h1>
        ${isEn() ? `<p class="note quiet lang-note">${t("המדריכים כתובים בעברית")}</p>` : ""}
        <nav class="status-pick" aria-label="${t("הסטטוס שלי")}">
          ${keys.map(x => `<a href="#/rights?s=${x}" class="${x === k ? "active" : ""}" ${x === k ? 'aria-current="page"' : ""}>${esc(isEn() ? TX("eligibility", x) : G[x].title)}</a>`).join("")}
        </nav>
        <div class="he-wrap" lang="he" dir="rtl">
        <div class="guide-intro"><p class="clamp-2" id="g-intro" role="button" tabindex="0" title="${t("להרחבה")}">${esc(g.intro)}</p></div>
        ${key ? `
          <article class="sheet key-right">
            <span class="area-tag badge">${t("הכי חשוב")}</span>
            <p class="clamp-2" id="key-text" role="button" tabindex="0">${esc(key.text)}</p>
            <button class="link-u read-more" type="button" id="key-more">${t("לקרוא הכול")}</button>
            <p>${src(key)}</p>
          </article>` : ""}
        ${g.sections.map(sec => {
          const its = sec.items.filter(it => it !== g.sections[0].items[0]);
          return its.length ? `<h2 class="section-title">${esc(sec.title)}</h2><ul class="ticks folds">${its.map(fold).join("")}</ul>` : "";
        }).join("")}
        </div>
        ${related.length ? `<h2 class="section-title">${t("מי יכול לעזור עם זה")}</h2><div class="grid">${related.map(s => card(s, null, true)).join("")}</div>` : ""}
        <p class="note quiet" style="margin-top: 18px">${t("כל סעיף מקושר למקור שלו. זה לא ייעוץ משפטי.")}</p>
      </section>`;
    const intro = document.getElementById("g-intro");
    intro.onclick = () => intro.classList.remove("clamp-2");
    const kt = document.getElementById("key-text");
    const km = document.getElementById("key-more");
    if (kt) kt.onclick = km.onclick = () => { kt.classList.remove("clamp-2"); km.remove(); };
  }

  function viewHelp() {
    const lines = [
      { name: t("נפש אחת"), what: t("משרד הביטחון · 24/7 · גם בלי הכרה"), num: "*8944" },
      { name: t("ער״ן"), what: t("24/7 · אפשר גם בוואטסאפ"), num: "1201" },
      { name: t("נט״ל"), what: t("טראומה על רקע לאומי · 24/7"), num: "*3362" }
    ];
    $main.innerHTML = `
      <section class="help">
        <p class="note">${t("אף אחד לא רואה שנכנסת לכאן")}</p>
        <h1>${t("לא לבד. אפשר לדבר עכשיו.")}</h1>
        <p class="crisis-line">${t("יש מחשבות לפגוע בעצמך? מתקשרים עכשיו לער״ן {eran}, או במצב מסוכן ל-{mda}.", { eran: '<a href="tel:1201" dir="ltr">1201</a>', mda: '<a href="tel:101" dir="ltr">101</a>' })}</p>
                <ul class="lines">
          ${lines.map(l => `<li><a href="tel:${l.num}"><span><span class="name">${l.name}</span><span class="what">${l.what}</span></span><span class="num" dir="ltr">${l.num}</span></a></li>`).join("")}
        </ul>
        <p class="emergency">${t("אם יש סכנה מיידית: מד״א {mda} · משטרה {police}", { mda: '<a href="tel:101">101</a>', police: '<a href="tel:100">100</a>' })}</p>
        <p class="note">${t("לא נוח לדבר? ער״ן גם בצ'אט כתוב:")} <a class="link-u" href="https://www.eran.org.il/" target="_blank" rel="noopener">eran.org.il</a></p>
        <h2 class="section-title">${t("ובינתיים, נושמים ביחד")}</h2>
        <div class="calm-tabs" role="tablist">
          <button type="button" role="tab" class="active" data-tab="breath">${t("נשימה")}</button>
          <button type="button" role="tab" data-tab="ground">${t("5 חושים")}</button>
        </div>
        <div id="tab-breath">
          <div class="breath" aria-hidden="true">
            <span class="blob"></span>
            <svg viewBox="0 0 210 210" fill="none"><path d="M105 8 C 160 6, 204 48, 202 104 C 200 160, 158 204, 104 202 C 50 200, 8 158, 10 104 C 12 52, 54 10, 108 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            <span class="phase"><span id="phase">${t("שאיפה")}</span><span class="count" id="count-down">4</span></span>
          </div>
          <p class="breath-how" id="breath-how">${t("שואפים לאט דרך האף, הבטן מתמלאת")}</p>
          <p class="note" style="text-align: center">${t("ממשיכים כמה סבבים, עד שהנשימה נרגעת.")}</p>
        </div>
        <div id="tab-ground" hidden>
          <p class="lead">${t("כשהראש מוצף, מחזירים אותו לחדר. עוברים חוש אחרי חוש, לאט, ואפשר להגיד בקול.")}</p>
          <div class="ground" id="ground"></div>
        </div>
        <p class="actions"><a class="link-u" href="#/browse?cat=hotlines">${t("כל קווי הסיוע")}</a></p>
      </section>`;
    // הכיתוב מתחלף עם הנשימה (4 שאיפה, 4 עצירה, 6 נשיפה = 14 שניות, כמו האנימציה)
    // ספירה בתוך העיגול, כדי שיהיה למה להיצמד
    const el = document.getElementById("phase"), cd = document.getElementById("count-down"), how = document.getElementById("breath-how");
    const seq = [["שאיפה", 4, "שואפים לאט דרך האף, הבטן מתמלאת"], ["עצירה", 4, "מחזיקים רגע, הכתפיים רפויות"], ["נשיפה", 6, "נושפים לאט דרך הפה, כמו דרך קשית"]].map(([a, n, b]) => [t(a), n, t(b)]);
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
    ].map(([n, a, b]) => [n, t(a), t(b)]);
    let g = 0;
    const ground = document.getElementById("ground");
    const drawG = () => {
      ground.innerHTML = g < G.length ? `
        <div class="ground-step"><span class="ground-n">${G[g][0]}</span><div><strong>${G[g][1]}</strong><p>${G[g][2]}</p></div></div>
        <div class="ground-dots" aria-hidden="true">${G.map((_, k) => `<span class="${k <= g ? "on" : ""}"></span>`).join("")}</div>
        <button type="button" class="btn btn-ink" id="g-next">${g < G.length - 1 ? t("הבא") : t("סיימתי")}</button>` : `
        <p class="lead">${t("יפה. עכשיו נשימה אחת ארוכה. אם עדיין קשה, אפשר לדבר עם מישהו, כאן למטה.")}</p>
        <button type="button" class="link-u" id="g-next">${t("מההתחלה")}</button>`;
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
    const COSTS = { free: t("ללא עלות"), "mod-funded": t("במימון משרד הביטחון"), partial: t("השתתפות חלקית"), paid: t("בתשלום") };
    $main.innerHTML = `
      <section class="form-page add-page">
        <h1 class="page-title">${t("להוסיף מקום")}</h1>
        <p class="lead">${t("עמותה, חווה, קבוצה, מטפל/ת דרך גוף, פעילות, מענק. כל דבר שעזר לך או למישהו שאת/ה מכיר/ה. אנחנו בודקים ומוסיפים.")}</p>
        <form id="add" class="form" novalidate>
          <label class="big">${t("איך קוראים לזה? *")}<input name="name" required maxlength="120" autocomplete="off" placeholder="${t("למשל: חוות הגליל לוחמים")}"></label>
          <fieldset><legend>${t("באיזה תחום? אפשר לבחור כמה")}</legend>
            <div class="chips small">${cats.map(k => chip("category", k, SHORT_CAT[k] ? shortCat(k) : (k === "hotlines" ? t("קו סיוע") : catLabel(k)), pre[0] === k)).join("")}</div>
          </fieldset>
          <label>${t("מה עושים שם, במשפט או שניים")}<textarea name="what" rows="3" maxlength="800"></textarea></label>
          <fieldset><legend>${t("איפה?")}</legend>
            <div class="chips small">${Object.keys(T.regions).map(k => chip("regions", k, TX("regions", k))).join("")}</div>
          </fieldset>
          <fieldset><legend>${t("כמה זה עולה? אפשר לבחור כמה, או לדלג אם לא יודעים")}</legend>
            <div class="chips small">${Object.keys(COSTS).map(k => chip("cost", k, COSTS[k], false)).join("")}</div>
          </fieldset>
          <div class="row">
            <label>${t("אתר או עמוד")}<input name="website" maxlength="300" inputmode="url" placeholder="${t("קישור")}"></label>
            <label>${t("טלפון של הגוף")}<input name="phone" type="tel" maxlength="40"></label>
          </div>
          <fieldset><legend>${t("מה הקשר שלך למקום?")}</legend>
            <div class="chips small">${radioChip("relation", "used", t("הייתי שם / נעזרתי"), true)}${radioChip("relation", "staff", t("אני עובד/ת שם"))}${radioChip("relation", "heard", t("שמעתי עליו"))}</div>
          </fieldset>
          <label class="check star-check"><input type="checkbox" name="recommend"> ${STAR} ${t("אני ממליץ/ה בחום")}</label>
          <details class="fold more-fields"><summary>${t("עוד פרטים (לא חובה)")}</summary>
            <label>${t("למי זה מתאים, תנאים, איך נרשמים")}<textarea name="notes" rows="3" maxlength="800"></textarea></label>
            <label>${t("כתובת / יישוב")}<input name="location" maxlength="120"></label>
            <label>${t("אם נרצה לשאול משהו: טלפון או מייל שלך")}<input name="contact" maxlength="120"></label>
          </details>
          <div class="ts" id="add-ts"></div>
          <button class="btn btn-ink btn-wide" type="submit">${t("לשלוח")}</button>
          <p class="form-msg" id="add-msg" role="status"></p>
        </form>
        <p class="note quiet">${t("לא מפרסמים את הפרטים שלך. מה ששלחת נבדק לפני שמופיע במאגר.")} <a href="#/privacy">${t("פרטיות")}</a></p>
      </section>`;
    const f = document.getElementById("add");
    const msg = document.getElementById("add-msg");
    let token = () => "";
    captcha(document.getElementById("add-ts")).then(g => { token = g; });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f);
      const name = (fd.get("name") || "").trim();
      if (name.length < 2) { msg.textContent = t("צריך לפחות שם."); f.name.focus(); return; }
      // מרכז גדול: כמה תחומים וכמה מסלולי תשלום. הראשון נשמר כ"ראשי", וכולם נשלחים לבדיקה
      const data = { name, recommend: !!fd.get("recommend"), regions: fd.getAll("regions"), categories: fd.getAll("category"), costs: fd.getAll("cost"), lang: I18N.lang };
      data.category = data.categories[0] || ""; data.cost = data.costs.length === 1 ? data.costs[0] : "";
      ["what", "website", "phone", "relation", "notes", "location", "contact"].forEach(k => data[k] = (fd.get(k) || "").toString().trim());
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const r = await Store.submit("new", data, { token: token() });
        f.innerHTML = `<div class="sheet thanks"><h2>${t("תודה!")}</h2><p>${r.local ? t("נשמר במכשיר (מצב הדגמה, עוד אין שרת).") : t("קיבלנו. אחרי בדיקה קצרה זה יופיע במאגר לכולם.")}</p>
          <p class="actions"><a class="btn" href="#/add">${t("להוסיף עוד מקום")}</a> <a class="link-u" href="#/">${t("לדף הבית")}</a></p></div>`;
      } catch (err) {
        btn.disabled = false;
        msg.textContent = sendError(err);
      }
    });
  }

  // ---------- פרטיות ----------
  // למה אזימוט קיים: החזון, בכמה מילים
  function viewAbout() {
    $main.innerHTML = `
      <section class="form-page about">
        <h1 class="page-title">${t("למה אזימוט קיים")}</h1>
        <p class="lead">${t("יש הרבה עזרה, אבל קשה למצוא אותה. היא מפוזרת בין אתרים, קבוצות ושמועות, ולא תמיד ברור למי היא מיועדת וכמה מחכים.")}</p>
        <p>${t("אזימוט אוסף את כל מה שקיים למקום אחד, כדי שכל אחד ואחת ימצאו את הצעד הבא שמתאים להם.")}</p>
        <h2 class="section-title">${t("מה אנחנו בונים, יחד")}</h2>
        <ol class="about-list">
          <li class="glass-sm"><span class="st-node area-sea">1</span><span>${t("<strong>כל המקומות במקום אחד.</strong> טיפול, ים, חוות, קבוצות וזכויות.")}</span></li>
          <li class="glass-sm"><span class="st-node area-land">2</span><span>${t("<strong>מה זמין עכשיו.</strong> איפה מקבלים, כמה מחכים, ולמי זה פתוח.")}</span></li>
          <li class="glass-sm"><span class="st-node area-soul">3</span><span>${t("<strong>קבוצות של שווים,</strong> קרוב לבית.")}</span></li>
          <li class="glass-sm"><span class="st-node area-body">4</span><span>${t("<strong>מה עוד חסר, ואיפה,</strong> כדי שאפשר יהיה לבנות את זה.")}</span></li>
        </ol>
        <h2 class="section-title">${t("מי עומד מאחורי זה")}</h2>
        <p>${t("רק הרצון לעזור. אזימוט נבנה בהתנדבות. אין פרסומות, אין עלות, ואף אחד לא מרוויח מזה כסף. התשובות שלך נשארות אצלך בטלפון.")}</p>
        <p>${t("כל מה שיש כאן הגיע מאנשים שעברו את הדרך ורצו שגם אחרים ימצאו. ככה נמשיך לבנות.")}</p>
        <h2 class="section-title">${t("מי נכנס למאגר")}</h2>
        <p>${t("כל עמותה, תוכנית, קבוצה או שירות שעוזרים לנכי צה\"ל, ללוחמים, למילואימניקים, לשוטרים ולכוחות הביטחון או למשפחות שלהם, ושיש להם דרך פנייה. בודקים כל מקום מול האתר או המקור הרשמי שלו. אף אחד לא משלם כדי להופיע, ואין סדר מועדף בתשלום.")}</p>
        <p>${t("\"ספק בסל Shikum.Me\" הוא עסק פרטי (מכון כושר, סטודיו, בריכה) שמאושר בסל הטיפולים המשלימים של אגף השיקום, ולכן המימון למוכרים מגיע ממשרד הביטחון. ספקים כאלה מסומנים, ובהתאמה האישית מופיעים מעט מהם, ורק קרובים.")}</p>
        <h2 class="section-title">${t("יצירת קשר")}</h2>
        <p>${t("רוצים להצטרף, לשאול או להציע? אפשר לכתוב ישירות: <a class=\"link-u\" href=\"mailto:idomayraz@gmail.com\" dir=\"ltr\">idomayraz@gmail.com</a>")}</p>
        <p class="actions">${t("<a class=\"btn btn-ink\" href=\"#/pilot\">לקחת חלק</a> <a class=\"link-u\" href=\"#/match\">למצוא מה מתאים לי</a>")}</p>
      </section>`;
  }
  // ---------- "ההצעות מתאימות לך?": דירוג מהיר במקום שבו נוצרת הדעה ----------
  // שורה בתוך העמוד, לא חלון קופץ. לחיצה אחת שולחת. "חלקית" / "לא ממש" פותחות שאלה אחת עם בחירות.
  // נשאל פעם אחת לכל מצב (אותן תשובות בשאלון / אותו חיפוש), ו"לא עכשיו" לא חוזר.
  const RATED_KEY = "vh-rated";
  const ratedGet = () => { try { return JSON.parse(localStorage.getItem(RATED_KEY)) || {}; } catch (e) { return {}; } };
  const ratedSet = k => { try { const o = ratedGet(); o[k] = Date.now(); localStorage.setItem(RATED_KEY, JSON.stringify(o)); } catch (e) { /* storage blocked */ } };
  const hashStr = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
  const RATE_REASONS = {
    results: ["כבר מכיר/ה את רובם", "רחוק ממני", "לא מתאים למצב שלי", "חסר לי משהו ספציפי", "לא ברור מה עושים"],
    search: ["התוצאות לא קשורות", "חסר מקום שאני מכיר/ה", "רחוק ממני", "לא ברור מה עושים"]
  };
  function rateBox(el, where, key, ctx) {
    if (!el) return;
    if (ratedGet()[key]) { el.innerHTML = ""; return; }
    const q = where === "results" ? t("ההצעות האלה מתאימות לך?") : t("מצאת את מה שחיפשת?");
    const [good, mid, bad] = (where === "results" ? ["כן, מדויק", "חלקית", "לא ממש"] : ["כן", "חלקית", "לא"]).map(x => t(x));
    el.innerHTML = `<div class="rate-box" role="group" aria-labelledby="rq-${where}">
        <p class="rate-q" id="rq-${where}">${q}</p>
        <div class="rate-btns">
          <button type="button" data-r="good">${good}</button><button type="button" data-r="partial">${mid}</button><button type="button" data-r="bad">${bad}</button>
        </div>
        <form class="rate-more" hidden>
          <p class="rate-sub">${t("מה לא התאים? אפשר לבחור כמה")}</p>
          <div class="chips small">${RATE_REASONS[where].map(r => `<label class="chip"><input type="checkbox" name="r" value="${esc(r)}"><span>${esc(t(r))}</span></label>`).join("")}</div>
          <label class="rate-text">${t("מה חיפשת, או מה היה חסר? (לא חובה)")}<input name="txt" maxlength="300" autocomplete="off"></label>
          <button class="btn btn-ink" type="submit">${t("לשלוח")}</button>
        </form>
        <p class="rate-note">${t("בעילום שם. נשלח רק סוג ההתאמה, בלי פרטים מזהים.")} <button type="button" class="link-u" data-r="skip">${t("לא עכשיו")}</button></p>
        <p class="rate-msg" role="status" aria-live="polite"></p>
      </div>`;
    const box = el.querySelector(".rate-box"), more = box.querySelector(".rate-more"), msg = box.querySelector(".rate-msg");
    let rating = "";
    const send = async extra => {
      ratedSet(key);
      box.querySelectorAll("button,input").forEach(x => x.disabled = true);
      msg.textContent = t("תודה! זה בדיוק מה שעוזר לנו לדייק.");
      try { await Store.submit("rate", Object.assign({ where, rating, v: VERSION, lang: I18N.lang }, ctx(), extra || {})); }
      catch (e) { /* לא מטרידים את המשתמש: התודה כבר נאמרה */ }
      setTimeout(() => { more.hidden = true; }, 300);
    };
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-r]"); if (!b) return;
      if (b.dataset.r === "skip") { ratedSet(key); el.innerHTML = ""; return; }
      rating = b.dataset.r;
      box.querySelectorAll(".rate-btns button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (rating === "good") return send();
      more.hidden = false; more.querySelector("input").focus();
    });
    more.addEventListener("submit", e => {
      e.preventDefault();
      const fd = new FormData(more);
      send({ reasons: fd.getAll("r").join(" | "), text: (fd.get("txt") || "").trim() });
    });
  }
  const profileCtx = p => ({ ctx: [...p.statuses, ...p.regions, p.goal && "goal:" + p.goal, p.era, p.age, ...p.difficulties.map(d => "d:" + d), ...p.interests.map(i => "i:" + i)].filter(Boolean).join(",") });

  // גרסת ניסיון: למה זה קיים, מה עוד חסר, ומשוב בעילום שם
  function viewPilot() {
    const p = loadProfile();
    const q = (name, label, opts) => `<fieldset class="pilot-q"><legend>${t(label)}</legend><div class="chips">${opts.map(o =>
      `<label class="chip"><input type="radio" name="${name}" value="${esc(o)}"><span>${esc(t(o))}</span></label>`).join("")}</div></fieldset>`;
    $main.innerHTML = `
      <section class="form-page pilot">
        <h1 class="page-title">${t("גרסת ניסיון: בונים את זה יחד")}</h1>
        <p class="lead">${t("אזימוט נבנה מחוכמת ההמונים. המטרה היא לרכז במקום אחד את כל מה שאנשים יודעים: מה קיים, מה באמת עזר, כמה מחכים, ולמי זה פתוח בפועל.")}</p>
        <p>${t("המידע נאסף ממקורות רשמיים ונבדק מולם, אבל דברים משתנים מהר. מה שאתם יודעים מהשטח משלים את מה שאי אפשר למצוא באתרים.")}</p>

        <h2 class="section-title">${t("מה עוד חסר לנו")}</h2>
        <ul class="ticks plain">
          <li>${TICK}<span>${t("<strong>זמינות ורשימות המתנה.</strong> השירותים קיימים, אבל בחלק מהמקומות מחכים חודשים, ויש מקומות שקשה מאוד להתקבל אליהם. ברוב הכרטיסים עוד אין לנו את המידע הזה.")}</span></li>
          <li>${TICK}<span>${t("<strong>למי זה פתוח בפועל.</strong> למשל, שירותים שלא כתוב בהם אם הם פתוחים גם לשוטרים ולכוחות הביטחון. אלה מסומנים \"אולי מתאים\".")}</span></li>
          <li>${TICK}<span>${t("<strong>מקומות קטנים ומקומיים</strong> שלא מופיעים ברשימות מסודרות.")}</span></li>
        </ul>

        <h2 class="section-title">${t("לבודקים: מה לנסות")}</h2>
        <ol class="pilot-steps">
          <li>${t("למלא את <a href=\"#/match\">ההתאמה האישית</a>, כמו שאתם.")}</li>
          <li>${t("לפתוח את שלוש התחנות הראשונות. הייתם פונים אליהן?")}</li>
          <li>${t("לחפש מקום שאתם מכירים. הוא מופיע? הפרטים נכונים?")}</li>
          <li>${t("יודעים כמה מחכים במקום מסוים? בכל כרטיס יש \"יודעים כמה מחכים כאן?\".")}</li>
          <li>${t("חסר מקום? כפתור ה-+ למעלה.")}</li>
          <li>${t("ולסיום, המשוב כאן למטה.")}</li>
        </ol>

        <h2 class="section-title">${t("לאנשי מקצוע")}</h2>
        <ul class="ticks plain">
          <li>${TICK}<span>${t("<strong>עם מטופלים:</strong> אפשר למלא את ההתאמה יחד בפגישה, או לשלוח את הקישור. התשובות נשמרות רק בטלפון של מי שממלא.")}</span></li>
          <li>${TICK}<span>${t("<strong>מכירים מקום שחסר,</strong> או יודעים כמה מחכים במקום מסוים? זה הידע שהכי חסר לנו. כפתור ה-+ למעלה, או \"יודעים כמה מחכים כאן?\" בכל כרטיס.")}</span></li>
          <li>${TICK}<span>${t("<strong>רוצים לעזור יותר?</strong> לבדוק את המקומות באזור שלכם, או להצטרף לצוות. <a href=\"mailto:idomayraz@gmail.com\">idomayraz@gmail.com</a>")}</span></li>
        </ul>

        <h2 class="section-title">${t("משוב בעילום שם")}</h2>
        <p class="note">${t("<strong>בעילום שם:</strong> לא שואלים ולא שומרים שם, טלפון, מייל או כתובת IP. בבקשה לא לכתוב פרטים מזהים, לא שלכם ולא של אחרים. שמות של מקומות ותוכניות מצוינים.")}</p>
        <form id="pilot-fb" class="form">
          ${q("relevant", "ההצעות הראשונות שקיבלת רלוונטיות אליך?", ["כן", "חלקית", "לא", "לא מילאתי התאמה"])}
          ${q("would", "היית פונה לאחת מהן?", ["כבר פניתי", "כן, אפנה", "אולי", "לא"])}
          <label>${t("מה חסר? שירות, מקום או נושא שלא מצאת")}<textarea name="missing" rows="2" maxlength="800"></textarea></label>
          <label>${t("איפה נתקעת, או מה היה לא ברור?")}<textarea name="stuck" rows="2" maxlength="800"></textarea></label>
          <label>${t("מכירים מקום, קבוצה או יוזמה שעזרו לכם או למישהו שאתם מכירים? מה השם ואיך פונים")}<textarea name="add" rows="2" maxlength="800" placeholder="${t("רק שם המקום ופרטים ציבוריים, בלי שמות של אנשים")}"></textarea></label>
          <label>${t("מה ידוע לכם על המתנה וזמינות? איפה מחכים הרבה, איפה קל להיכנס")}<textarea name="wait" rows="2" maxlength="800"></textarea></label>
          <label>${t("עוד משהו?")}<textarea name="more" rows="2" maxlength="800"></textarea></label>
          ${p ? `<label class="check"><input type="checkbox" name="ctx" checked> ${t("לצרף את סוג ההתאמה בלבד (למשל: משטרה, מילואים, אזור), כדי שנבין למי ההצעות לא דייקו. בלי שום פרט מזהה.")}</label>` : ""}
          <div class="ts" id="pilot-ts"></div>
          <button class="btn btn-ink">${t("לשלוח משוב")}</button>
          <p class="form-msg" role="status"></p>
        </form>
        <p class="note quiet">${t("רוצים לשתף יותר, או שנחזור אליכם? אפשר דרך <a href=\"#/privacy\">טופס הפנייה</a> בעמוד הפרטיות.")}</p>
      </section>`;
    const f = document.getElementById("pilot-fb");
    let token = null;
    captcha(document.getElementById("pilot-ts")).then(g => { token = g; });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f);
      const msg = f.querySelector(".form-msg");
      const data = {};
      ["relevant", "would", "missing", "stuck", "add", "wait", "more"].forEach(k => data[k] = (fd.get(k) || "").trim());
      if (!Object.values(data).some(Boolean)) { msg.textContent = t("אפשר לענות רק על שאלה אחת, אבל צריך לפחות אחת."); return; }
      if (p && fd.get("ctx")) data.ctx = [...p.statuses, ...p.regions, p.era, p.age].filter(Boolean).join(",");
      data.more = [data.more, "v" + VERSION, isEn() ? "lang:en" : ""].filter(Boolean).join(" · ");
      try {
        const r = await Store.submit("feedback", data, { token: token ? token() : "" });
        f.innerHTML = `<p class="form-msg">${r && r.local ? t("אין חיבור לשרת כרגע, המשוב נשמר במכשיר וננסה שוב.") : t("תודה רבה! כל תשובה מדייקת את זה למי שיבוא אחריך.")}</p>`;
      } catch (err) { msg.textContent = sendError(err); }
    });
  }
  function viewPrivacy() {
    $main.innerHTML = `
      <section class="form-page privacy">
        <h1 class="page-title">${t("פרטיות")}</h1>
        <p class="lead">${t("בקצרה: אין הרשמה, אין פרסומות, ואין מעקב. אנחנו שומרים רק מה שבחרת לשלוח, ורק כדי שהאתר יעבוד.")}</p>

        <h2 class="section-title">${t("מה נשאר רק אצלך במכשיר")}</h2>
        <p>${t("התשובות לשאלון, הבחירה במצב עמום, ואילו שירותים המלצת עליהם. הכול נשמר בדפדפן או באפליקציה שלך בלבד, ולא נשלח אלינו. אפשר למחוק הכול בכל רגע בעמוד <a href=\"#/settings\">ההגדרות</a>.")}</p>

        <h2 class="section-title">${t("מה מגיע אלינו, ורק כשבחרת לשלוח")}</h2>
        <ul class="ticks plain">
          <li>${TICK}<span>${t("<strong>\"שיחזרו אליי\":</strong> השם, הטלפון או המייל, ומה שכתבת. משמש רק כדי שהגוף שבחרת יחזור אליך. אנחנו מעבירים לגוף הזה בלבד, ולא לאף אחד אחר.")}</span></li>
          <li>${TICK}<span>${t("<strong>הוספת מקום ותיקון פרטים:</strong> מה שכתבת בטופס. פרטי קשר שלך הם לא חובה, ומשמשים רק אם נצטרך לשאול משהו. לא מתפרסמים.")}</span></li>
          <li>${TICK}<span>${t("<strong>\"פנית? איך הלך?\":</strong> הטלפון שלך בלבד זוכר לאיזה מקום פנית (התקשרת, כתבת או ביקשת שיחזרו אליך), כדי לשאול אחרי שבועיים איך זה הלך. זה לא נשלח לשום מקום. אם בחרת לענות, נשלחים רק התשובה ושם המקום, בעילום שם.")}</span></li>
          <li>${TICK}<span>${t("<strong>משוב, דירוג מהיר (\"ההצעות מתאימות לך?\") ודיווח על המתנה:</strong> בעילום שם. בדירוג נשלחים גם סוג ההתאמה והמקומות שהוצעו, ובחיפוש בלי תוצאות נשלח החיפוש עצמו, רק אם לחצת \"לשלוח\". רק התשובות שבחרת, בלי שם, טלפון או מייל. אם סימנת, מצורף גם סוג ההתאמה (למשל \"משטרה, צפון\"), בלי שום פרט מזהה.")}</span></li>
          <li>${TICK}<span>${t("<strong>\"ממליץ/ה\":</strong> רק איזה שירות, וקוד אקראי של המכשיר כדי שלא ייספר פעמיים. בלי שם ובלי פרטים.")}</span></li>
        </ul>

        <h2 class="section-title">${t("מי רואה, ולכמה זמן")}</h2>
        <p>${t("רק מנהל/ת האתר, בעמוד ניהול שנעול בסיסמה. פניות \"שיחזרו אליי\" נמחקות אוטומטית אחרי חצי שנה. אנחנו לא מוכרים מידע, לא משתמשים בו לפרסום, ולא משתפים אותו.")}</p>

        <h2 class="section-title">${t("טכני")}</h2>
        <p>${t("האתר מתארח ב-Cloudflare, והמידע שנשלח נשמר שם. כתובת ה-IP לא נשמרת: לצורך הגבלת הודעות ספאם שומרים רק קוד מוצפן שמתחלף כל יום. בטפסים יש בדיקה של Cloudflare (Turnstile) שמוודאת שלא מדובר ברובוט. הגופנים נטענים מ-Google Fonts. אין כלי מדידה, אין עוגיות פרסום.")}</p>

        <h2 class="section-title">${t("חשוב לדעת")}</h2>
        <p>${t("המידע באתר נאסף ממקורות פתוחים ונבדק מול האתרים הרשמיים כשאפשר. הוא לא תחליף לייעוץ רפואי, נפשי או משפטי. כדאי לוודא תנאים ועלויות ישירות מול הגוף. אם יש סכנה מיידית: מד״א <a href=\"tel:101\">101</a>, משטרה <a href=\"tel:100\">100</a>, ובכל שעה <a href=\"#/help\">עזרה עכשיו</a>.")}</p>

        <h2 class="section-title">${t("לבקש מחיקה או לשאול")}</h2>
        <p>${t("שלחת פנייה ורוצה שנמחק אותה? כתבו כאן מה שלחתם ומתי (בערך), ואיך לחזור אליכם אם צריך.")}</p>
        <form id="contact" class="form">
          <label>${t("מה לבקש")}<textarea name="text" rows="3" maxlength="1000" required></textarea></label>
          <label>${t("טלפון או מייל (לא חובה)")}<input name="contact" maxlength="120"></label>
          <div class="ts" id="contact-ts"></div>
          <button class="btn btn-ink" type="submit">${t("לשלוח")}</button>
          <p class="form-msg" role="status"></p>
        </form>
        <p class="note quiet">${t("עודכן: אוקטובר 2026")}</p>
      </section>`;
    const f = document.getElementById("contact");
    let token = () => "";
    captcha(document.getElementById("contact-ts")).then(g => { token = g; });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f), msg = f.querySelector(".form-msg");
      const text = (fd.get("text") || "").trim();
      if (text.length < 3) { msg.textContent = t("כתבו כמה מילים."); return; }
      try {
        await Store.submit("fix", { text, contact: (fd.get("contact") || "").trim() }, { service_id: "_contact", token: token() });
        f.innerHTML = `<p class="form-msg">${t("התקבל. נטפל בזה בהקדם.")}</p>`;
      } catch (err) { msg.textContent = sendError(err); }
    });
  }

  // ---------- service card ----------
  // טלפונים ומיילים בתוך טקסט: לחיצים, ובכיוון שמאל-לימין כדי שלא יתהפכו או יישברו
  const linkify = t => esc(t)
    // טווח שעות ("09:00–17:00") בעברית מתהפך בלי בידוד כיוון
    .replace(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/g, m => `<span dir="ltr" class="nowrap">${m}</span>`)
    .replace(/(\*\d{3,5}|\b0\d{1,2}-?\d{3}-?\d{4}\b|\b1-?[78]00-?\d{2,3}-?\d{3,4}\b)/g, m => `<a href="tel:${m.replace(/[^\d*]/g, "")}" dir="ltr" class="nowrap">${m}</a>`)
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, m => `<a href="mailto:${m}" dir="ltr">${m}</a>`);
  const heDate = d => { const m = String(d || "").match(/^(\d{4})-(\d{2})/); return m ? `${+m[2]}/${m[1]}` : d; };
  const WAIT_OPTS = ["אין המתנה", "עד חודש", "1 עד 3 חודשים", "3 עד 6 חודשים", "חצי שנה ויותר", "לא מקבלים כרגע", "לא הצלחתי ליצור קשר"];
  // ---------- "פנית? איך הלך?": שאלת המשך אחרי שבועיים ----------
  // רק בטלפון: לאיזה מקום פנית ומתי (בלי שום שליחה). אחרי 14 יום שואלים פעם אחת בדף הבית. התשובה נשלחת רק אם בוחרים לענות.
  const CONTACT_KEY = "vh-contacted";
  const contactsGet = () => { try { return JSON.parse(localStorage.getItem(CONTACT_KEY)) || []; } catch (e) { return []; } };
  const contactsSet = l => { try { localStorage.setItem(CONTACT_KEY, JSON.stringify(l.slice(-12))); } catch (e) { /* storage blocked */ } };
  function rememberContact(id) {
    const s = SERVICES.find(x => x.id === id);
    if (!s || s.category === "hotlines") return;   // קו תמיכה: אין "התקבלת?"
    const l = contactsGet();
    if (l.some(c => c.id === id)) return;
    l.push({ id, at: Date.now() });
    contactsSet(l);
  }
  let openId = null;
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="tel:"], a[href*="wa.me"], a[href^="mailto:"], a[target="_blank"]');
    if (!a || a.closest(".footer") || a.closest(".card-help")) return;
    const modalOpen = !$modal.hidden;
    const host = a.closest("[data-sid], li");
    const id = modalOpen ? openId : host && (host.dataset.sid || (host.querySelector("[data-open]") || {}).dataset?.open);
    if (id) rememberContact(id);
  }, true);
  const DAY = 864e5;
  function followupDue() {
    return contactsGet().find(c => !c.asked && (!c.snooze || c.snooze < Date.now()) && Date.now() - c.at >= 14 * DAY && SERVICES.some(s => s.id === c.id));
  }
  function followupCard(el) {
    const c = followupDue();
    if (!el || !c) return;
    const s = SERVICES.find(x => x.id === c.id);
    const OUT = [["started", "התקבלתי / התחלתי"], ["waiting", "אני ברשימת המתנה"], ["no-answer", "לא חזרו אליי"], ["not-fit", "לא התאים לי"], ["not-yet", "עוד לא פניתי בפועל"]];
    el.innerHTML = `<div class="rate-box followup-box" role="group" aria-labelledby="fu-q">
        <p class="rate-q" id="fu-q">${t("לפני כשבועיים פנית ל{name}. איך זה הלך?", { name: `<strong lang="he" dir="rtl">${esc(splitName(s.name).main)}</strong>` })}</p>
        <div class="rate-btns">${OUT.map(([k, l]) => `<button type="button" data-o="${k}">${esc(t(l))}</button>`).join("")}</div>
        <form class="rate-more" hidden>
          <p class="rate-sub">${t("כמה זמן לקח מהפנייה? (לא חובה)")}</p>
          <div class="chips small">${WAIT_OPTS.slice(0, 5).map(w => `<label class="chip"><input type="radio" name="w" value="${esc(w)}"><span>${esc(t(w))}</span></label>`).join("")}</div>
          <label class="rate-text">${t("משהו שיעזור לבא אחריך? (לא חובה)")}<input name="txt" maxlength="300" autocomplete="off"></label>
          <button class="btn btn-ink" type="submit">${t("לשלוח")}</button>
        </form>
        <p class="rate-note">${t("בעילום שם. רק הטלפון שלך זוכר שפנית.")} <button type="button" class="link-u" data-o="later">${t("לא עכשיו")}</button> · <button type="button" class="link-u" data-o="never">${t("לא לשאול")}</button></p>
        <p class="rate-msg" role="status" aria-live="polite"></p>
      </div>`;
    const box = el.querySelector(".followup-box"), more = box.querySelector(".rate-more"), msg = box.querySelector(".rate-msg");
    const mark = patch => contactsSet(contactsGet().map(x => x.id === c.id ? Object.assign(x, patch) : x));
    let outcome = "";
    const send = async extra => {
      mark({ asked: true });
      box.querySelectorAll("button,input").forEach(x => x.disabled = true);
      msg.textContent = t("תודה! זה המידע הכי חשוב שיש לנו.");
      try { await Store.submit("rate", Object.assign({ where: "followup", rating: outcome, stations: c.id, v: VERSION, lang: I18N.lang }, extra || {})); } catch (e) { /* ignore */ }
      more.hidden = true;
    };
    box.addEventListener("click", e => {
      const b = e.target.closest("[data-o]"); if (!b) return;
      const o = b.dataset.o;
      if (o === "later") { mark({ snooze: Date.now() + 7 * DAY }); el.innerHTML = ""; return; }
      if (o === "never") { mark({ asked: true }); el.innerHTML = ""; return; }
      outcome = o;
      box.querySelectorAll(".rate-btns button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      more.hidden = false;
      more.querySelector(".rate-sub").hidden = more.querySelector(".chips").hidden = !(o === "started" || o === "waiting");
    });
    more.addEventListener("submit", e => {
      e.preventDefault();
      const fd = new FormData(more);
      send({ reasons: fd.get("w") || "", text: (fd.get("txt") || "").trim() });
    });
  }

  function openService(id) {
    openId = id;
    const s = SERVICES.find(x => x.id === id);
    if (!s) return;
    const prof = loadProfile();
    const links = [];
    if (s.phone && isMobile(s.phone)) links.push(`<a class="link-u" href="${waHref(s.phone)}" target="_blank" rel="noopener">${t("וואטסאפ")}</a>`);
    if (s.email) links.push(`<a class="link-u" href="mailto:${esc(s.email)}?subject=${encodeURIComponent("פנייה דרך אזימוט: " + s.name)}">${t("מייל")}</a>`);
    if (s.website) links.push(`<a class="link-u" href="${esc(safeUrl(s.website))}" target="_blank" rel="noopener">${t("לאתר")}</a>`);
    links.push(`<button class="link-u" type="button" id="lead-toggle">${t("שיחזרו אליי")}</button>`);
    const who = arr(s.eligibility).map(k => TX("eligibility", k)).filter(Boolean);
    const helps = arr(s.difficulties).map(k => TX("difficulties", k)).filter(Boolean);
    $modalBody.innerHTML = `
      <div class="svc">
        <div class="tag-row" style="margin-top: 12px">
          ${areaTag(s)}<span class="cost-tag">${esc(costLabel(s.cost))}</span>
          <span class="verify">${s.verified_at ? t("✓ נבדק מול המקור ב-{d}", { d: esc(heDate(s.verified_at)) }) : t("עוד לא נבדק. כדאי לוודא איתם.")}</span>
        </div>
        <h2 id="modal-title" lang="he" dir="rtl">${nameHtml(s.name)}</h2>
        ${isEn() ? `<p class="note quiet lang-note">${t("פרטי השירותים כתובים בעברית")}</p>` : ""}
        ${starred(s) ? `<p class="community">${STAR}<span><strong>${t("{n} המלצות בקבוצת הנכים והלוחמים", { n: s.community_recs })}</strong>${s.community_note ? ` · <span lang="he" dir="rtl">${esc(s.community_note)}</span>` : ""}</span></p>` : ""}
        <p class="desc clamp-3" id="svc-desc" lang="he" dir="rtl">${esc(s.description)}</p>
        ${(s.description || "").length > 150 ? `<button class="link-u read-more" type="button" id="svc-more">${t("לקרוא עוד")}</button>` : ""}
        ${s.cost_notes ? `<p class="desc" lang="he" dir="rtl"><span class="highlight area-${areaOf(s.category)}">${linkify(s.cost_notes)}</span></p>` : ""}
        ${prof && policeUnsure(s, prof.statuses) ? `<p class="callout maybe-callout"><strong>${esc(t("אולי מתאים, לא בטוח שפתוח {who}.", { who: forcesWord(prof.statuses) }))}</strong> ${prof.statuses.includes("police") ? t("לא כתוב כאן במפורש שגם שוטרים ושוטרות יכולים להצטרף. ייתכן שכן: כדאי לשאול כבר בשיחה הראשונה.") : t("לא כתוב כאן במפורש שגם אנשי כוחות הביטחון יכולים להצטרף. ייתכן שכן: כדאי לשאול כבר בשיחה הראשונה.")}</p>` : ""}
        <div class="avail-box">
          ${cycleLabel(s) ? `<p><strong>📅 ${esc(cycleLabel(s))}</strong></p>` : ""}
          ${s.avail ? `<p><strong>${t("⏳ זמינות והמתנה:")}</strong> <span lang="he" dir="rtl">${esc(s.avail)}</span> <span class="quiet">(${s.avail_src === "site" ? t("לפי האתר שלהם") : t("לפי דיווחים של אנשים בקהילה")})</span></p>`
            : `<p class="quiet">${t("אין לנו עדיין מידע על המתנה או על כמה קל להתקבל. כדאי לשאול בשיחה הראשונה.")}</p>`}
          <button class="link-u" type="button" id="wait-toggle">${t("יודעים כמה מחכים כאן? לשתף, בעילום שם")}</button>
          <form id="wait" class="form lead-form" hidden>
            <fieldset class="chips">${WAIT_OPTS.map((o, i) => `<label class="chip"><input type="radio" name="w" value="${esc(o)}"${i ? "" : " required"}><span>${esc(t(o))}</span></label>`).join("")}</fieldset>
            <label>${t("משהו שכדאי לדעת? (לא חובה)")}<textarea name="note" rows="2" maxlength="400" placeholder="${t("למשל: חזרו אליי אחרי שבוע, צריך הפניה מרופא")}"></textarea></label>
            <p class="note">${t("בעילום שם: לא שואלים ולא שומרים שם, טלפון או מייל. אחרי בדיקה זה יופיע כאן לכולם.")}</p>
            <div class="ts" id="wait-ts"></div>
            <button class="btn btn-ink">${t("לשתף")}</button>
            <p class="form-msg" role="status"></p>
          </form>
        </div>
        <div class="contact">
          ${s.phone ? `<a class="btn btn-ink btn-wide" href="${telHref(s.phone)}">${t("להתקשר")} <span dir="ltr">${esc(firstPhone(s.phone))}</span></a>` : ""}
          <div class="links">${links.join("")}</div>
          ${!s.phone && !s.email && !s.website ? `<p class="note">${t("אין לנו עדיין טלפון או אתר ישיר. אפשר לבקש שיחזרו אליך, או לחפש את השם ברשת. מכירים את הפרטים?")} <button class="link-u" type="button" id="fix-toggle2">${t("להוסיף")}</button></p>` : ""}
        </div>
        ${who.length ? `<p class="for-whom"><strong>${t("למי:")}</strong> ${esc(who.slice(0, 4).join(" · "))}${/לנשים/.test(s.name) ? " · " + t("לנשים בלבד") : ""}</p>` : ""}
        <div class="folds-svc">
          ${s.how_to_apply ? `<details class="fold" open><summary>${t("איך מתחילים")}</summary><p lang="he" dir="rtl">${linkify(s.how_to_apply)}</p></details>` : ""}
          ${helps.length ? `<details class="fold"><summary>${t("במה זה עוזר")}</summary><p>${esc(helps.join(" · "))}</p></details>` : ""}
          ${s.location || arr(s.regions).length ? `<details class="fold"><summary>${t("איפה")}</summary><p>${s.location ? `<span lang="he" dir="rtl">${esc(s.location)}</span>` : ""}${s.location && arr(s.regions).length ? " · " : ""}${esc(arr(s.regions).map(r => TX("regions", r)).join(", "))}</p></details>` : ""}
        </div>
        <div class="svc-community">
          <button class="chip-btn" type="button" id="rec-btn" aria-pressed="${Store.hasRecommended(s.id)}">${STAR}<span>${Store.hasRecommended(s.id) ? t("המלצת. תודה") : t("ממליץ/ה")}</span></button>
          <button class="chip-btn" type="button" id="fix-toggle">${t("משהו לא נכון? / להוסיף פרט")}</button>
        </div>
        <form id="fix" class="form lead-form" hidden>
          <label>${t("מה לא נכון, או מה כדאי להוסיף?")}<textarea name="text" rows="3" maxlength="1000" required placeholder="${t("למשל: הטלפון השתנה, יש המתנה של חודשיים, זה פתוח גם למי שלא מוכר")}"></textarea></label>
          <label>${t("אם נרצה לשאול משהו: טלפון או מייל (לא חובה)")}<input name="contact" maxlength="120"></label>
          <div class="ts" id="fix-ts"></div>
          <button class="btn btn-ink">${t("לשלוח")}</button>
          <p class="form-msg" role="status"></p>
        </form>
        <form id="lead" class="form lead-form" hidden>
          <p class="note">${t("נעביר לגוף, והם יחזרו אליך. לא חובה לספר יותר ממה שנוח.")}</p>
          <label>${t("שם")}<input name="name" required maxlength="80"></label>
          <label>${t("טלפון או מייל")}<input name="contact" required maxlength="120"></label>
          <label>${t("משהו שחשוב שידעו? (לא חובה)")}<textarea name="message" rows="2" maxlength="600"></textarea></label>
          <label class="check"><input type="checkbox" name="consent" required> ${t("אני מסכים/ה שהפרטים יועברו ל{name} רק כדי ליצור איתי קשר.", { name: `<span lang="he" dir="rtl">${esc(s.name)}</span>` })} <a href="#/privacy">${t("פרטיות")}</a></label>
          <button class="btn btn-ink">${t("לשלוח")}</button>
          <p class="form-msg" role="status"></p>
        </form>
        <p class="note quiet card-help">${t("קשה עכשיו?")} <a href="#/help">${t("עזרה עכשיו")}</a> · ${t("ער״ן")} <a href="tel:1201" dir="ltr">1201</a></p>
        ${s.source_url ? `<p class="source">${t("מקור:")} <a href="${esc(safeUrl(s.source_url))}" target="_blank" rel="noopener">${esc(s.source_url.replace(/^https?:\/\//, "").slice(0, 60))}</a></p>` : ""}
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
        rememberContact(s.id);
        msg.textContent = r && r.local ? t("לא הצלחנו לשלוח עכשיו (אין חיבור לשרת). הכי בטוח להתקשר או לכתוב להם ישירות.")
          : t("הפנייה נשלחה. אם לא חזרו אליך תוך כמה ימים, אפשר גם להתקשר ישירות.");
      } catch (err) {
        msg.textContent = sendError(err) + " " + t("אפשר גם להתקשר ישירות.");
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
        rec.querySelector("span").textContent = t("המלצת. תודה");
      } catch (err) { rec.querySelector("span").textContent = t("לא נשמר, נסו שוב"); }
      rec.disabled = false;
    };
    // תיקון או פרט נוסף
    const fx = document.getElementById("fix");
    let fixToken = null;
    const ft2 = document.getElementById("fix-toggle2");
    if (ft2) ft2.onclick = () => document.getElementById("fix-toggle").click();
    document.getElementById("fix-toggle").onclick = () => {
      fx.hidden = !fx.hidden;
      if (!fx.hidden) {
        fx.querySelector("textarea").focus();
        if (!fixToken) captcha(document.getElementById("fix-ts")).then(g => { fixToken = g; });
      }
    };
    // דיווח על זמינות והמתנה: בעילום שם, נכנס לתור הבדיקה
    const wf = document.getElementById("wait");
    let waitToken = null;
    document.getElementById("wait-toggle").onclick = () => {
      wf.hidden = !wf.hidden;
      if (!wf.hidden && !waitToken) captcha(document.getElementById("wait-ts")).then(g => { waitToken = g; });
    };
    wf.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(wf);
      const msg = wf.querySelector(".form-msg");
      const w = fd.get("w"), note = (fd.get("note") || "").trim();
      if (!w) { msg.textContent = t("בחרו אחת מהאפשרויות."); return; }
      try {
        await Store.submit("fix", { text: "זמינות: " + w + (note ? ". " + note : ""), avail: w }, { service_id: s.id, token: waitToken ? waitToken() : "" });
        wf.innerHTML = `<p class="form-msg">${t("תודה! זה עוזר לבא אחריך.")}</p>`;
      } catch (err) { msg.textContent = sendError(err); }
    });
    fx.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(fx);
      const msg = fx.querySelector(".form-msg");
      const text = (fd.get("text") || "").trim();
      if (text.length < 3) { msg.textContent = t("כתבו כמה מילים."); return; }
      try {
        await Store.submit("fix", { text, contact: (fd.get("contact") || "").trim() }, { service_id: s.id, token: fixToken ? fixToken() : "" });
        fx.innerHTML = `<p class="form-msg">${t("תודה! נבדוק ונעדכן.")}</p>`;
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
    const gear = document.getElementById("settings-btn");
    if (gear) { if (path === "/settings") gear.setAttribute("aria-current", "page"); else gear.removeAttribute("aria-current"); }
    await ensureLive();
    if (path === "/match") viewMatch();
    else if (path === "/results") viewResults();
    else if (path === "/browse") viewBrowse(params);
    else if (path === "/rights") viewRights(params);
    else if (path === "/area") viewArea(params);
    else if (path === "/explore") viewExplore();
    else if (path === "/help") viewHelp();
    else if (path === "/privacy") viewPrivacy();
    else if (path === "/pilot") viewPilot();
    else if (path === "/about") viewAbout();
    else if (path === "/need") viewNeed(params);
    else if (path === "/soon") viewSoon();
    else if (path === "/settings") viewSettings();
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
  // "light" / "dark", או null = לפי הגדרת המכשיר
  const setTheme = th => {
    savedTheme = th;
    applyTheme(th);
    try { if (th) localStorage.setItem(THEME_KEY, th); else localStorage.removeItem(THEME_KEY); } catch (e) { /* storage blocked */ }
  };
  if (dimBtn) dimBtn.onclick = () => setTheme(dimBtn.getAttribute("aria-pressed") === "true" ? "light" : "dark");

  // ---------- הגדרות ----------
  // שפה, תצוגה, הדגמה, ומחיקת כל מה שנשמר במכשיר. בלי חלונות קופצים: אישור המחיקה הוא שורה בתוך העמוד.
  function viewSettings() {
    const seg = (name, cur, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l, lang]) =>
      `<label><input type="radio" name="${name}" value="${v}" ${cur === v ? "checked" : ""}><span${lang ? ` lang="${lang}"` : ""}>${l}</span></label>`).join("")}</div>`;
    $main.innerHTML = `
      <section class="form-page settings">
        <h1 class="page-title">${t("הגדרות")}</h1>
        <fieldset class="set-row"><legend>${isEn() ? `Language · <span lang="he">שפה</span>` : `שפה · <span lang="en">Language</span>`}</legend>
          ${seg("lang", I18N.lang, [["he", "עברית", "he"], ["en", "English", "en"]])}
          <p class="note quiet">${t("שמות המקומות ופרטי השירותים כתובים בעברית, בכל שפה.")}</p>
        </fieldset>
        <fieldset class="set-row"><legend>${t("תצוגה")}</legend>
          ${seg("theme", savedTheme || "system", [["light", t("בהיר")], ["dark", t("עמום")], ["system", t("לפי המכשיר")]])}
        </fieldset>
        <div class="set-row">
          <h2 class="section-title">${t("איך משתמשים")}</h2>
          <p>${t("הדגמה קצרה של הכפתורים העיקריים, חצי דקה.")}</p>
          <p class="actions"><button class="btn" type="button" id="set-tour">${t("לראות שוב את ההדגמה")}</button></p>
        </div>
        <div class="set-row">
          <h2 class="section-title">${t("המידע שלך במכשיר")}</h2>
          <p>${t("התשובות לשאלון, ההמלצות שלך, המקומות שפנית אליהם ובחירת התצוגה נשמרים רק בטלפון הזה. אפשר למחוק הכול.")}</p>
          <p class="actions"><button class="btn" type="button" id="set-wipe">${t("למחוק את המידע שלי מהמכשיר")}</button></p>
          <div id="wipe-confirm" class="callout" hidden>
            <p><strong>${t("למחוק הכול?")}</strong> ${t("זה לא מוחק פניות שכבר שלחת. אפשר לבקש את זה בעמוד הפרטיות.")}</p>
            <p class="actions"><button class="btn btn-ink" type="button" id="wipe-yes">${t("כן, למחוק")}</button> <button class="link-u" type="button" id="wipe-no">${t("ביטול")}</button></p>
          </div>
          <p class="form-msg" id="wipe-msg" role="status" aria-live="polite"></p>
        </div>
        <p class="note quiet">${t("גרסה {v}", { v: VERSION })}</p>
      </section>`;
    $main.querySelectorAll('input[name="lang"]').forEach(i => i.onchange = () => { I18N.set(i.value); applyStatic(); route(); });
    $main.querySelectorAll('input[name="theme"]').forEach(i => i.onchange = () => setTheme(i.value === "system" ? null : i.value));
    document.getElementById("set-tour").onclick = () => { location.hash = "#/"; setTimeout(startTour, 80); };
    const conf = document.getElementById("wipe-confirm");
    document.getElementById("set-wipe").onclick = () => { conf.hidden = false; document.getElementById("wipe-no").focus(); };
    document.getElementById("wipe-no").onclick = () => { conf.hidden = true; document.getElementById("set-wipe").focus(); };
    document.getElementById("wipe-yes").onclick = () => {
      try { Object.keys(localStorage).filter(k => k.startsWith("vh-")).forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage blocked */ }
      // ההדגמה כבר נראתה, ושפת הממשק נשארת כמו שהיא: רק המידע האישי נמחק
      try { localStorage.setItem(TOUR_KEY, "1"); I18N.set(I18N.lang); } catch (e) { /* storage blocked */ }
      savedTheme = null; applyTheme(null);
      conf.hidden = true;
      document.getElementById("wipe-msg").textContent = t("נמחק. המכשיר נקי.");
      $main.querySelectorAll('input[name="theme"]').forEach(i => { i.checked = i.value === "system"; });
    };
  }

  // טקסטים קבועים ב-index.html: הטקסט העברי המקורי נשמר כמפתח, ומוחלף לפי השפה
  function applyStatic() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      if (el.dataset.he == null) el.dataset.he = el.innerHTML.trim();
      el.innerHTML = t(el.dataset.he);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      if (el.dataset.heAria == null) el.dataset.heAria = el.getAttribute("aria-label") || "";
      el.setAttribute("aria-label", t(el.dataset.heAria));
      if (el.title) el.title = t(el.dataset.heAria);
    });
    document.title = t("אזימוט · הכיוון הבא שלך");
    const stamp = document.getElementById("data-stamp");
    if (stamp) stamp.textContent = t("גרסה {v}", { v: VERSION }) + (window.SERVICES_UPDATED ? " · " + t("המאגר עודכן: {d}", { d: window.SERVICES_UPDATED }) : "");
    const mode = document.getElementById("store-mode");
    if (mode && mode.textContent) mode.textContent = Store.mode === "cloud" ? "" : t("מצב הדגמה: מה ששולחים נשמר רק במכשיר");
  }

  // ---------- הדגמת ניווט בפתיחה ראשונה ----------
  // כמה צעדים קצרים שמאירים את הכפתורים האמיתיים. מוצג פעם אחת (נשמר במכשיר), ואפשר לראות שוב מתחתית העמוד.
  const TOUR_KEY = "vh-tour-v1";
  const CONTACT_EMAIL = "idomayraz@gmail.com";
  const TOUR = [
    { title: "ברוכים הבאים לאזימוט", text: "כל המקומות שיכולים לעזור, במקום אחד. בלי הרשמה, והתשובות נשארות אצלך בטלפון. הדגמה קצרה, חצי דקה." },
    { sel: '.subnav [data-nav="match"]', title: "מה מתאים לי", text: "עונים על כמה שאלות קצרות, ומקבלים שלושה מקומות שמתאימים לך." },
    { sel: ".beta-strip", title: "משוב, בעילום שם", text: "כאן מספרים לנו מה עזר, מה חסר ואיפה נתקעת. בלי שם ובלי טלפון. ובכל כרטיס של מקום אפשר גם לשתף כמה מחכים שם, או לתקן פרט." },
    { sel: ".add-btn", title: "להוסיף מקום חדש", text: "מכירים מקום, קבוצה או יוזמה שעזרו לכם? לוחצים על הפלוס וממלאים כמה פרטים. אחרי בדיקה זה יופיע לכולם." },
    { sel: ".help-btn", title: "עזרה עכשיו", text: "כשקשה, כאן יש קווי תמיכה שעונים בכל שעה." },
    { sel: "#settings-btn", title: "הגדרות", text: "שפה (עברית או English), תצוגה בהירה או עמומה, ומחיקת המידע שלך מהמכשיר." },
    { title: "רוצים לדבר איתנו?", html: "אפשר לכתוב ישירות: {email}<br>את ההדגמה אפשר לראות שוב בתחתית כל עמוד." }
  ];
  function startTour() {
    if (document.querySelector(".tour")) return;
    const back = document.activeElement;
    const root = document.createElement("div");
    root.className = "tour";
    root.innerHTML = `<div class="tour-spot" aria-hidden="true"></div>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
        <p class="tour-count" aria-live="polite"></p>
        <h2 id="tour-title" class="tour-title"></h2>
        <p id="tour-text" class="tour-text"></p>
        <div class="tour-nav">
          <button class="btn btn-ink" type="button" data-t="next"></button>
          <button class="link-u" type="button" data-t="prev">${t("הקודם")}</button>
          <button class="link-u tour-skip" type="button" data-t="skip">${t("דלג")}</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const spot = root.querySelector(".tour-spot"), box = root.querySelector(".tour-card");
    let i = 0;
    const place = () => {
      const st = TOUR[i];
      const el = st.sel && document.querySelector(st.sel);
      const r = el && el.getBoundingClientRect();
      root.classList.toggle("centered", !r || !r.width);
      if (!r || !r.width) { spot.style.cssText = ""; box.style.cssText = ""; return; }
      const pad = 6;
      spot.style.cssText = `top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
      const below = r.bottom + 14, w = Math.min(360, innerWidth - 32);
      const left = Math.max(16, Math.min(innerWidth - w - 16, r.left + r.width / 2 - w / 2));
      box.style.cssText = `width:${w}px;left:${left}px;` + (below + 220 < innerHeight ? `top:${below}px` : `bottom:${innerHeight - r.top + 14}px`);
    };
    const show = n => {
      i = n;
      const st = TOUR[i];
      root.querySelector(".tour-count").textContent = t("{n} מתוך {m}", { n: i + 1, m: TOUR.length });
      root.querySelector("#tour-title").textContent = t(st.title);
      const tx = root.querySelector("#tour-text");
      if (st.html) tx.innerHTML = t(st.html, { email: `<a href="mailto:${CONTACT_EMAIL}" dir="ltr">${CONTACT_EMAIL}</a>` }); else tx.textContent = t(st.text);
      root.querySelector('[data-t="next"]').textContent = i === 0 ? t("בואו נתחיל") : i === TOUR.length - 1 ? t("סיום") : t("הבא");
      root.querySelector('[data-t="prev"]').hidden = i === 0;
      root.querySelector('[data-t="skip"]').hidden = i === TOUR.length - 1;
      window.scrollTo(0, 0);
      place();
      root.querySelector('[data-t="next"]').focus();
    };
    const end = () => {
      try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) { /* storage blocked */ }
      removeEventListener("resize", place); removeEventListener("keydown", key);
      root.remove();
      if (back && back.focus) back.focus();
    };
    const key = e => { if (e.key === "Escape") end(); };
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-t]");
      if (!b) return;
      if (b.dataset.t === "next") i === TOUR.length - 1 ? end() : show(i + 1);
      else if (b.dataset.t === "prev") show(i - 1);
      else end();
    });
    addEventListener("resize", place); addEventListener("keydown", key);
    show(0);
  }
  const tourAgain = document.getElementById("tour-again");
  if (tourAgain) tourAgain.onclick = e => { e.preventDefault(); if (!/^#\/?$/.test(location.hash) && location.hash) location.hash = "#/"; setTimeout(startTour, 50); };

  const bl = document.getElementById("brand-logo");
  if (bl) bl.innerHTML = LOGO(30, false);
  // מספר גרסה: כדי שמשוב יתייחס לגרסה מסוימת
  const VERSION = "0.9";
  applyStatic();
  // פתיחה מחדש של האפליקציה: הדפדפן משחזר את העמוד האחרון. עמודי שיטוט (תחומים, אזור) לא אמורים להיות נקודת הכניסה.
  if (/^#\/(?:explore|area)\b/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search + "#/");
  route().then(() => {
    // פעם ראשונה: הדגמה קצרה. לא בעמוד "עזרה עכשיו" (מי שמגיע לשם צריך עזרה, לא הדרכה)
    let seen = true;
    try { seen = !!localStorage.getItem(TOUR_KEY); } catch (e) { /* storage blocked: לא מציגים */ }
    if (!seen && !/^#\/help/.test(location.hash)) setTimeout(startTour, 400);
  });
})();
