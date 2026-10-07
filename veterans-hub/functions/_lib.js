// עזרים משותפים לפונקציות השרת (Cloudflare Pages Functions + D1)
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS, extra)
  });
}

export const options = () => new Response(null, { status: 204, headers: CORS });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS submissions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     kind TEXT NOT NULL,            -- new | fix | lead
     service_id TEXT,               -- לתיקון ולפנייה: השירות שהם עליו
     dedupe TEXT,                   -- מפתח לאיחוד הצעות כפולות
     data TEXT NOT NULL,            -- JSON
     status TEXT NOT NULL DEFAULT 'pending',
     created_at INTEGER NOT NULL,
     ip_hash TEXT)`,
  `CREATE INDEX IF NOT EXISTS sub_status ON submissions(status, kind)`,
  `CREATE TABLE IF NOT EXISTS live_services (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS overrides (service_id TEXT PRIMARY KEY, patch TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS recs (service_id TEXT NOT NULL, device TEXT NOT NULL, ip_hash TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (service_id, device))`
];
let schemaReady = false;
export async function db(env) {
  if (!env.DB) throw new Error("no-db");
  if (!schemaReady) {
    await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
    schemaReady = true;
  }
  return env.DB;
}

export async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

// כתובת ה-IP לא נשמרת, רק גיבוב שלה עם מלח יומי — מספיק להגבלת קצב, לא מזהה אדם
export async function ipHash(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "0";
  return sha(ip + new Date().toISOString().slice(0, 10));
}

export async function turnstileOk(env, token, request) {
  if (!env.TURNSTILE_SECRET) return true;          // עוד לא הוגדר — לא חוסמים
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  body.append("remoteip", request.headers.get("CF-Connecting-IP") || "");
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

export function normKey(s) {
  return String(s || "").toLowerCase()
    .replace(/https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")
    .replace(/[\"״'׳\-–—.,:()]/g, " ").replace(/^(עמותת|עמותה|ארגון|חוות|חווה)\s+/, "")
    .replace(/\s+/g, " ").trim();
}

// מנקה אובייקט שמגיע מהדפדפן: רק שדות מוכרים, מחרוזות קצרות, רשימות קצרות
export function clean(obj, fields) {
  const out = {};
  for (const [k, max] of Object.entries(fields)) {
    const v = obj ? obj[k] : undefined;
    if (Array.isArray(max)) {
      out[k] = Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, max[0]).map(x => x.slice(0, 40)) : [];
    } else if (typeof v === "boolean") {
      out[k] = v;
    } else {
      out[k] = String(v == null ? "" : v).trim().slice(0, max);
    }
  }
  return out;
}

// כניסת מנהל: Cloudflare Access חותם על טוקן (Cf-Access-Jwt-Assertion). בודקים את החתימה מול
// המפתחות של הצוות (ACCESS_TEAM, למשל myteam.cloudflareaccess.com) ואת ה-AUD של האפליקציה (ACCESS_AUD),
// ורק אז את המייל מול ADMIN_EMAILS. כותרת מייל לבדה אפשר לזייף, ולכן לא סומכים עליה.
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let certCache = { at: 0, keys: [] };
async function accessKeys(team) {
  if (Date.now() - certCache.at < 3600e3 && certCache.keys.length) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  const j = await r.json();
  certCache = { at: Date.now(), keys: j.keys || [] };
  return certCache.keys;
}
export async function adminEmail(request, env) {
  const allowed = (env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (!allowed.length) return null;
  if (env.LOCAL_DEV_ADMIN === "yes-local-only") {            // רק לבדיקות מקומיות עם wrangler
    const e = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
    return allowed.includes(e) ? e : null;
  }
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || !env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  try {
    const [h, p, sig] = jwt.split(".");
    const head = JSON.parse(new TextDecoder().decode(b64u(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64u(p)));
    const jwk = (await accessKeys(env.ACCESS_TEAM)).find(k => k.kid === head.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!ok || !aud.includes(env.ACCESS_AUD) || claims.exp * 1000 < Date.now()) return null;
    const email = String(claims.email || "").toLowerCase();
    return allowed.includes(email) ? email : null;
  } catch (e) { return null; }
}
