// עמוד הניהול: תור ההצעות של הקהילה. מוגן ע"י Cloudflare Access (רק המיילים שהוגדרו).
(function () {
  const T = window.TAXONOMY, S = window.SERVICES || [];
  const $m = document.getElementById("main");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const day = t => new Date(t).toLocaleDateString("he-IL");
  const opts = (obj, cur, lab) => Object.keys(obj).map(k => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(lab ? lab(obj[k]) : obj[k])}</option>`).join("");
  const checks = (name, obj, cur) => `<div class="chips small">${Object.keys(obj).map(k =>
    `<label class="chip"><input type="checkbox" name="${name}" value="${k}" ${cur.includes(k) ? "checked" : ""}><span>${esc(obj[k])}</span></label>`).join("")}</div>`;
  const norm = s => String(s || "").toLowerCase().replace(/[\"״'׳\-–—.,:()]/g, " ").replace(/\s+/g, " ").trim();

  async function api(path, body) {
    const r = await fetch("../api/admin/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" } : { credentials: "include" });
    if (r.status === 403) throw new Error("forbidden");
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }

  // שירות קיים עם שם דומה, כדי לא להוסיף כפילות
  function similar(name) {
    const n = norm(name);
    if (n.length < 3) return [];
    return S.filter(s => { const m = norm(s.name); return m.includes(n) || n.includes(m.split(" – ")[0]) || m.split(" ").filter(w => w.length > 2 && n.includes(w)).length >= 2; }).slice(0, 3);
  }
  const first = (items, k) => (items.find(i => i.data[k]) || { data: {} }).data[k] || "";

  function newCard(g) {
    const it = g.items, d = k => first(it, k);
    const recs = it.filter(i => i.data.recommend).length;
    const rel = { used: "נעזר/ה", staff: "עובד/ת שם", heard: "שמע/ה" };
    const dups = similar(d("name"));
    const regions = [...new Set(it.flatMap(i => i.data.regions || []))];
    const desc = [d("what"), d("notes")].filter(Boolean).join("\n");
    return `<article class="adm-card" data-key="${esc(g.key)}">
      <h2>${esc(d("name"))}</h2>
      <p class="adm-meta">${it.length} הצעות · ${recs} ממליצים · ${it.map(i => rel[i.data.relation] || "").filter(Boolean).join(", ")} · ${day(it[0].created_at)}</p>
      ${it.map(i => i.data.what || i.data.notes ? `<p class="adm-quote">${esc([i.data.what, i.data.notes].filter(Boolean).join("\n"))}${i.data.contact ? `\n— ליצירת קשר: ${esc(i.data.contact)}` : ""}</p>` : "").join("")}
      ${dups.length ? `<p class="adm-dup">אולי כבר קיים: ${dups.map(s => esc(s.name)).join(" · ")}</p>` : ""}
      <form class="form">
        <label>שם<input name="name" value="${esc(d("name"))}"></label>
        <div class="two">
          <label>תחום<select name="category">${opts(T.categories, d("category") || "peer-support", v => v.label)}</select></label>
          <label>עלות<select name="cost"><option value="">לא ידוע</option>${opts(T.cost, d("cost"), v => v.label)}</select></label>
        </div>
        <label>תיאור (מה עושים שם)<textarea name="description" rows="3">${esc(desc)}</textarea></label>
        <fieldset><legend>אזור</legend>${checks("regions", T.regions, regions)}</fieldset>
        <fieldset><legend>למי</legend>${checks("eligibility", T.eligibility, [])}</fieldset>
        <div class="two">
          <label>טלפון<input name="phone" value="${esc(d("phone"))}"></label>
          <label>אתר<input name="website" value="${esc(d("website"))}"></label>
        </div>
        <div class="two">
          <label>מיקום<input name="location" value="${esc(d("location"))}"></label>
          <label>פירוט עלות<input name="cost_notes"></label>
        </div>
        <label>איך מתחילים<input name="how_to_apply"></label>
        <div class="adm-actions">
          <button class="btn btn-ink" data-act="approve" type="button">לאשר ולפרסם</button>
          <button class="btn" data-act="reject" type="button">לדחות${dups.length ? " (כפול)" : ""}</button>
        </div>
      </form>
    </article>`;
  }

  const FIX_FIELDS = { phone: "טלפון", website: "אתר", cost_notes: "פירוט עלות", how_to_apply: "איך מתחילים", location: "מיקום", description: "תיאור" };
  function fixCard(g) {
    if (g.service_id === "_contact") return `<article class="adm-card" data-key="${esc(g.key)}" data-sid="_contact">
      <h2>פנייה כללית / בקשת פרטיות</h2>
      ${g.items.map(i => `<p class="adm-quote">${esc(i.data.text)}${i.data.contact ? `\n— ליצירת קשר: ${esc(i.data.contact)}` : ""}\n(${day(i.created_at)})</p>`).join("")}
      <form class="form"><div class="adm-actions"><button class="btn btn-ink" data-act="close" type="button">טופל</button></div></form></article>`;
    const s = S.find(x => x.id === g.service_id) || { name: "(שירות שנוסף ע״י הקהילה) " + g.service_id };
    return `<article class="adm-card" data-key="${esc(g.key)}" data-sid="${esc(g.service_id)}">
      <h2>${esc(s.name)}</h2>
      <p class="adm-meta">${g.items.length} הודעות · ${day(g.items[0].created_at)}</p>
      ${g.items.map(i => `<p class="adm-quote">${esc(i.data.text)}${i.data.contact ? `\n— ליצירת קשר: ${esc(i.data.contact)}` : ""}</p>`).join("")}
      <form class="form">
        <p class="note">לשנות רק מה שצריך. מה שמשתנה כאן מתעדכן אצל כולם.</p>
        <label>עלות<select name="cost"><option value="">לא ידוע</option>${opts(T.cost, s.cost || "", v => v.label)}</select></label>
        ${Object.entries(FIX_FIELDS).map(([k, l]) => k === "description"
          ? `<label>${l}<textarea name="${k}" rows="4">${esc(s[k] || "")}</textarea></label>`
          : `<label>${l}<input name="${k}" value="${esc(s[k] || "")}"></label>`).join("")}
        <div class="adm-actions">
          <button class="btn btn-ink" data-act="override" type="button">לשמור תיקון</button>
          <button class="btn" data-act="close" type="button">לסגור בלי שינוי</button>
        </div>
      </form>
    </article>`;
  }

  let Q = { groups: [] };
  async function load() {
    try {
      Q = await api("queue");
      document.getElementById("who").innerHTML = `${esc(Q.who || "")} · <a href="#" id="logout">יציאה</a>`;
      document.getElementById("logout").onclick = async ev => { ev.preventDefault(); await fetch("../api/admin/logout", { credentials: "include" }); loginForm(); };
    } catch (e) {
      if (e.message === "forbidden") return loginForm();
      $m.innerHTML = `<div class="callout">השרת לא זמין (${esc(e.message)}). בדקו שה-D1 מחובר בשם DB.</div>`;
      return;
    }
    const nNew = Q.groups.filter(g => g.kind === "new").length, nFix = Q.groups.filter(g => g.kind === "fix").length;
    document.getElementById("n-new").textContent = nNew || "";
    document.getElementById("n-fix").textContent = nFix || "";
    render();
  }

  function loginForm() {
    $m.innerHTML = `<section class="form-page"><h1 class="page-title">כניסה לניהול</h1>
      <form class="form" id="login"><label>סיסמה<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn btn-ink" type="submit">כניסה</button><p class="form-msg" id="login-msg" role="status"></p></form></section>`;
    const f = document.getElementById("login");
    f.querySelector("input").focus();
    f.onsubmit = async e => {
      e.preventDefault();
      const r = await fetch("../api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ password: new FormData(f).get("password") }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return load();
      document.getElementById("login-msg").textContent = j.error === "rate" ? "יותר מדי ניסיונות. לנסות שוב בעוד שעה."
        : j.error === "no-password-set" ? "עוד לא הוגדרה סיסמה (ADMIN_PASSWORD ב-Cloudflare)." : "סיסמה שגויה.";
    };
  }

  async function render() {
    const tab = (location.hash || "#new").slice(1);
    document.querySelectorAll("[data-tab]").forEach(a => a.classList.toggle("active", a.dataset.tab === tab));
    if (tab === "leads") return renderLeads();
    if (tab === "live") return renderLive();
    const gs = Q.groups.filter(g => g.kind === tab);
    $m.innerHTML = gs.length ? gs.map(tab === "new" ? newCard : fixCard).join("") : `<p class="empty">אין כרגע מה לבדוק.</p>`;
    $m.querySelectorAll("[data-act]").forEach(b => b.onclick = () => act(b));
  }

  async function act(b) {
    const card = b.closest(".adm-card"), f = card.querySelector("form");
    const g = Q.groups.find(x => x.key === card.dataset.key);
    const ids = g.items.map(i => i.id);
    const fd = new FormData(f);
    b.disabled = true;
    try {
      if (b.dataset.act === "approve") {
        const svc = {};
        ["name", "category", "cost", "description", "phone", "website", "location", "cost_notes", "how_to_apply"].forEach(k => svc[k] = (fd.get(k) || "").trim());
        svc.regions = fd.getAll("regions"); svc.eligibility = fd.getAll("eligibility");
        svc.difficulties = []; svc.interests = []; svc.provider_type = "ngo";
        const recs = g.items.filter(i => i.data.recommend).length;
        if (recs) svc.community_recs = recs;
        await api("approve", { ids, service: svc });
      } else if (b.dataset.act === "override") {
        const s = S.find(x => x.id === g.service_id) || {};
        const patch = {};
        ["cost", ...Object.keys(FIX_FIELDS)].forEach(k => { const v = (fd.get(k) || "").trim(); if (v !== (s[k] || "")) patch[k] = v; });
        await api("override", { ids, service_id: g.service_id, patch });
      } else if (b.dataset.act === "close") {
        await api("override", { ids, service_id: g.service_id, patch: {} });
      } else {
        await api("reject", { ids });
      }
      Q.groups = Q.groups.filter(x => x !== g);
      card.remove();
    } catch (e) { b.disabled = false; alert("לא נשמר: " + e.message); }
  }

  async function renderLeads() {
    const { leads } = await api("leads");
    document.getElementById("n-leads").textContent = leads.filter(l => l.status === "pending").length || "";
    const name = id => (S.find(s => s.id === id) || {}).name || "";
    $m.innerHTML = `<p class="note">אנשים שביקשו שגוף יחזור אליהם. להעביר לגוף ולסמן "טופל". המידע רגיש: לא לשמור מחוץ למערכת.</p>
      <p><button class="btn" id="csv" type="button">ייצוא CSV</button></p>
      <table class="adm-table"><tr><th>תאריך</th><th>שירות</th><th>שם</th><th>קשר</th><th>הודעה</th><th>מצב</th></tr>
      ${leads.map(l => `<tr><td>${day(l.created_at)}</td><td>${esc(name(l.service_id) || l.serviceName)}</td><td>${esc(l.name)}</td><td dir="ltr">${esc(l.contact)}</td><td>${esc(l.message)}</td>
        <td><select data-id="${l.id}">${["pending", "handled", "rejected"].map(s => `<option value="${s}" ${l.status === s ? "selected" : ""}>${{ pending: "חדש", handled: "טופל", rejected: "לא רלוונטי" }[s]}</option>`).join("")}</select></td></tr>`).join("")}
      </table>`;
    $m.querySelectorAll("select[data-id]").forEach(sel => sel.onchange = () => api("lead-status", { ids: [sel.dataset.id], status: sel.value }));
    document.getElementById("csv").onclick = () => {
      const rows = [["date", "service", "name", "contact", "message", "status"], ...leads.map(l => [day(l.created_at), name(l.service_id) || l.serviceName, l.name, l.contact, l.message, l.status])];
      const csv = "﻿" + rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "leads.csv"; a.click();
    };
  }

  async function renderLive() {
    const { services } = await api("live");
    $m.innerHTML = services.length ? services.map(s => `<article class="adm-card"><h2>${esc(s.name)}</h2>
      <p class="adm-meta">${esc((T.categories[s.category] || {}).label || "")} · אושר ${esc(s.approved_at || "")}</p>
      <div class="adm-actions"><button class="btn" data-id="${esc(s.id)}" type="button">להוריד מהאתר</button></div></article>`).join("")
      : `<p class="empty">עוד לא אושרו מקומות מהקהילה.</p>`;
    $m.querySelectorAll("button[data-id]").forEach(b => b.onclick = async () => {
      if (!confirm("להוריד מהאתר?")) return;
      await api("unpublish", { id: b.dataset.id }); b.closest(".adm-card").remove();
    });
  }

  window.addEventListener("hashchange", render);
  load();
})();
