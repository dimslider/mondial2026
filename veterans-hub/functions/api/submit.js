// POST /api/submit — כל מה שמשתמשים שולחים: מקום חדש, תיקון, המלצה, או בקשה שיחזרו אליהם
import { json, options, db, ipHash, turnstileOk, normKey, clean, sha } from "../_lib.js";

export const onRequestOptions = options;

const NEW_FIELDS = {
  name: 120, category: 40, what: 800, cost: 20, cost_notes: 200, location: 120,
  phone: 40, website: 300, relation: 20, recommend: true, notes: 800, contact: 120,
  regions: [9], eligibility: [11]
};
const FIX_FIELDS = { text: 1000, contact: 120 };
const LEAD_FIELDS = { name: 80, contact: 120, message: 600, consent: true, serviceName: 200 };
const LIMIT_PER_DAY = { new: 15, fix: 20, lead: 10, recommend: 60 };

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad-json" }, 400); }
  const kind = body && body.kind;
  if (!LIMIT_PER_DAY[kind]) return json({ error: "bad-kind" }, 400);

  let d;
  try { d = await db(env); } catch (e) { return json({ error: "unavailable" }, 503); }
  const ip = await ipHash(request);
  const now = Date.now();

  // המלצה: אחת לכל מכשיר לכל שירות. לא צריך בדיקת רובוט, רק הגבלת קצב.
  if (kind === "recommend") {
    const sid = String(body.service_id || "").slice(0, 80);
    const device = String(body.device || "").slice(0, 64);
    if (!sid || device.length < 8) return json({ error: "bad-input" }, 400);
    const n = await d.prepare("SELECT COUNT(*) AS n FROM recs WHERE ip_hash = ? AND created_at > ?")
      .bind(ip, now - 864e5).first("n");
    if (n >= LIMIT_PER_DAY.recommend) return json({ error: "rate" }, 429);
    await d.prepare("INSERT OR IGNORE INTO recs (service_id, device, ip_hash, created_at) VALUES (?, ?, ?, ?)")
      .bind(sid, await sha(device), ip, now).run();
    return json({ ok: true });
  }

  if (!(await turnstileOk(env, body.token, request))) return json({ error: "captcha" }, 403);
  const used = await d.prepare("SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND kind = ? AND created_at > ?")
    .bind(ip, kind, now - 864e5).first("n");
  if (used >= LIMIT_PER_DAY[kind]) return json({ error: "rate" }, 429);

  let data, sid = null, dedupe = null;
  if (kind === "new") {
    data = clean(body.data, NEW_FIELDS);
    if (data.name.length < 2) return json({ error: "name" }, 400);
    dedupe = "n:" + normKey(data.website || data.name);
  } else if (kind === "fix") {
    data = clean(body.data, FIX_FIELDS);
    sid = String(body.service_id || "").slice(0, 80);
    if (!sid || data.text.length < 3) return json({ error: "bad-input" }, 400);
    dedupe = "f:" + sid;
  } else {
    data = clean(body.data, LEAD_FIELDS);
    sid = String(body.service_id || "").slice(0, 80);
    if (!sid || !data.name || !data.contact || data.consent !== true) return json({ error: "bad-input" }, 400);
  }
  await d.prepare("INSERT INTO submissions (kind, service_id, dedupe, data, status, created_at, ip_hash) VALUES (?, ?, ?, ?, 'pending', ?, ?)")
    .bind(kind, sid, dedupe, JSON.stringify(data), now, ip).run();
  return json({ ok: true });
}
