// /api/admin/* — רק אחרי כניסה דרך Cloudflare Access, ורק למיילים שב-ADMIN_EMAILS
import { json, db, adminEmail } from "../../_lib.js";

export async function onRequest({ request, env, params }) {
  const who = await adminEmail(request, env);
  if (!who) return json({ error: "forbidden" }, 403);
  let d;
  try { d = await db(env); } catch (e) { return json({ error: "no-db" }, 503); }
  const path = (params.path || []).join("/");
  const now = Date.now();
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite).slice(0, 200) : [];
  const setStatus = status => ids.length
    ? d.prepare(`UPDATE submissions SET status = ? WHERE id IN (${ids.map(() => "?").join(",")})`).bind(status, ...ids).run()
    : null;

  if (request.method === "GET" && path === "queue") {
    const r = await d.prepare("SELECT id, kind, service_id, dedupe, data, created_at FROM submissions WHERE status = 'pending' AND kind != 'lead' ORDER BY created_at")
      .all();
    // הצעות על אותו מקום / תיקונים לאותו שירות מתאחדים לקבוצה אחת
    const groups = {};
    for (const s of r.results) {
      const k = s.dedupe || "id:" + s.id;
      (groups[k] = groups[k] || { key: k, kind: s.kind, service_id: s.service_id, items: [] })
        .items.push({ id: s.id, created_at: s.created_at, data: JSON.parse(s.data) });
    }
    return json({ who, groups: Object.values(groups).sort((a, b) => b.items.length - a.items.length) });
  }
  if (request.method === "GET" && path === "leads") {
    const r = await d.prepare("SELECT id, service_id, data, status, created_at FROM submissions WHERE kind = 'lead' ORDER BY created_at DESC LIMIT 500").all();
    return json({ leads: r.results.map(x => Object.assign({ id: x.id, service_id: x.service_id, status: x.status, created_at: x.created_at }, JSON.parse(x.data))) });
  }
  if (request.method === "GET" && path === "live") {
    const r = await d.prepare("SELECT id, data, created_at FROM live_services ORDER BY created_at DESC").all();
    return json({ services: r.results.map(x => Object.assign(JSON.parse(x.data), { id: x.id })) });
  }
  if (request.method === "POST" && path === "approve") {
    // מקום חדש שאושר: נשמר כמו שהמנהל ערך אותו, ומופיע מיד באפליקציה
    const s = body.service || {};
    if (!s.name || !s.category) return json({ error: "bad-input" }, 400);
    const id = "u-" + now.toString(36);
    s.source = "community"; s.approved_at = new Date(now).toISOString().slice(0, 10);
    await d.prepare("INSERT INTO live_services (id, data, created_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(s), now).run();
    await setStatus("approved");
    return json({ ok: true, id });
  }
  if (request.method === "POST" && path === "override") {
    // תיקון לשירות קיים: השדות שהמנהל שינה נשמרים ונדרסים על הנתונים באפליקציה
    const sid = String(body.service_id || "");
    const patch = body.patch || {};
    if (!sid) return json({ error: "bad-input" }, 400);
    if (Object.keys(patch).length) {
      const prev = await d.prepare("SELECT patch FROM overrides WHERE service_id = ?").bind(sid).first("patch");
      const merged = Object.assign(prev ? JSON.parse(prev) : {}, patch);
      await d.prepare("INSERT OR REPLACE INTO overrides (service_id, patch, updated_at) VALUES (?, ?, ?)").bind(sid, JSON.stringify(merged), now).run();
    }
    await setStatus("done");
    return json({ ok: true });
  }
  if (request.method === "POST" && path === "reject") { await setStatus("rejected"); return json({ ok: true }); }
  if (request.method === "POST" && path === "lead-status") { await setStatus(String(body.status || "handled").slice(0, 20)); return json({ ok: true }); }
  if (request.method === "POST" && path === "unpublish") {
    await d.prepare("DELETE FROM live_services WHERE id = ?").bind(String(body.id || "")).run();
    return json({ ok: true });
  }
  return json({ error: "not-found" }, 404);
}
