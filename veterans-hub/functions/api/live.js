// GET /api/live — מה שהאפליקציה טוענת בכל פתיחה: שירותים שאושרו, תיקונים שאושרו, וספירת המלצות
import { json, options, db } from "../_lib.js";

export const onRequestOptions = options;

export async function onRequestGet({ env }) {
  try {
    const d = await db(env);
    const [svc, ov, rc] = await d.batch([
      d.prepare("SELECT id, data FROM live_services ORDER BY created_at"),
      d.prepare("SELECT service_id, patch FROM overrides"),
      d.prepare("SELECT service_id, COUNT(*) AS n FROM recs GROUP BY service_id")
    ]);
    return json({
      services: svc.results.map(r => Object.assign(JSON.parse(r.data), { id: r.id })),
      overrides: Object.fromEntries(ov.results.map(r => [r.service_id, JSON.parse(r.patch)])),
      recs: Object.fromEntries(rc.results.map(r => [r.service_id, r.n]))
    }, 200, { "Cache-Control": "public, max-age=10" });
  } catch (e) {
    return json({ error: "unavailable" }, 503);
  }
}
