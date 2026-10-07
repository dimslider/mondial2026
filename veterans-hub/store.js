// שכבת אחסון: השרת של האתר (Cloudflare Pages Functions + D1) אם הוא זמין, אחרת מצב הדגמה במכשיר.
//   live()       — מה שאושר: מקומות חדשים, תיקונים, ספירת המלצות
//   submit()     — מקום חדש / תיקון / בקשה שיחזרו אליי. נכנס לתור של המנהל
//   recommend()  — "ממליץ/ה": אחת לכל מכשיר לכל שירות
(function () {
  const C = window.APP_CONFIG || {};
  const onWeb = /^https?:$/.test(location.protocol);
  const base = C.apiBase ? C.apiBase.replace(/\/$/, "") : (onWeb ? "" : null);
  const LS = "vh-store-v2";
  const read = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const write = s => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { /* storage blocked */ } };
  const device = () => {
    const s = read();
    if (!s.device) { s.device = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); write(s); }
    return s.device;
  };
  const EMPTY = { services: [], overrides: {}, recs: {} };

  async function api(path, body) {
    const r = await fetch(base + "/api/" + path, body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    } : undefined);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "http-" + r.status), { code: j.error || r.status });
    return j;
  }

  const Store = {
    mode: base === null ? "local" : "unknown",
    async live() {
      if (base === null) return EMPTY;
      try { const j = await api("live"); Store.mode = "cloud"; return Object.assign({}, EMPTY, j); }
      catch (e) { Store.mode = "local"; return EMPTY; }
    },
    // kind: new | fix | lead
    async submit(kind, data, extra) {
      const payload = Object.assign({ kind, data }, extra || {});
      // תמיד מנסים את השרת (גם אם בטעינה הוא לא ענה). רק כשאין שרת בכלל, או שאין רשת, שומרים במכשיר.
      if (base !== null) {
        try { const r = await api("submit", payload); Store.mode = "cloud"; return r; }
        catch (e) { if (typeof e.code === "string" && e.code !== "unavailable") throw e; }   // השרת ענה עם שגיאה מוכרת (ספאם, הגבלה): מציגים אותה
      }
      const s = read();
      (s.outbox = s.outbox || []).push(Object.assign({ at: Date.now() }, payload));
      write(s);
      return { ok: true, local: true };
    },
    hasRecommended: id => !!(read().recommended || {})[id],
    async recommend(id) {
      const s = read();
      if ((s.recommended || {})[id]) return { ok: true, already: true };
      if (base !== null) await api("submit", { kind: "recommend", service_id: id, device: device() }).catch(e => { if (typeof e.code === "string" && e.code !== "unavailable") throw e; });
      const s2 = read();
      (s2.recommended = s2.recommended || {})[id] = Date.now();
      write(s2);
      return { ok: true };
    }
  };
  window.Store = Store;
})();
