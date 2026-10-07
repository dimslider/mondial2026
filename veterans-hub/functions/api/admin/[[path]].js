// /api/admin/* — רק אחרי כניסה: סיסמת מנהל (ADMIN_PASSWORD) או Cloudflare Access למיילים שב-ADMIN_EMAILS
import { json, db, adminEmail, ipHash, sameSecret, sessionCookie, sessionOk } from "../../_lib.js";

export async function onRequest({ request, env, params }) {
  let d;
  try { d = await db(env); } catch (e) { return json({ error: "no-db" }, 503); }
  const path = (params.path || []).join("/");

  // כניסה בסיסמה: עד 8 ניסיונות בשעה לכל רשת
  if (path === "login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD) return json({ error: "no-password-set" }, 503);
    const ip = await ipHash(request), now = Date.now();
    const tries = await d.prepare("SELECT COUNT(*) AS n FROM logins WHERE ip_hash = ? AND at > ?").bind(ip, now - 3600e3).first("n");
    if (tries >= 8) return json({ error: "rate" }, 429);
    const { password } = await request.json().catch(() => ({}));
    if (!(await sameSecret(password || "", env.ADMIN_PASSWORD))) {
      await d.prepare("INSERT INTO logins (ip_hash, at) VALUES (?, ?)").bind(ip, now).run();
      return json({ error: "wrong-password" }, 403);
    }
    return json({ ok: true }, 200, { "Set-Cookie": await sessionCookie(env) });
  }
  if (path === "logout") return json({ ok: true }, 200, { "Set-Cookie": "adm=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });

  const who = (await adminEmail(request, env)) || ((await sessionOk(request, env)) ? "סיסמה" : null);
  if (!who) return json({ error: "forbidden" }, 403);
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
