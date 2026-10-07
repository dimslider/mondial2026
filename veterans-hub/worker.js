// נקודת הכניסה של Cloudflare Worker: /api/* מטופל בקוד, כל השאר הם קבצי האתר (dist).
import * as live from "./functions/api/live.js";
import * as submit from "./functions/api/submit.js";
import * as admin from "./functions/api/admin/[[path]].js";
import { json, options } from "./functions/_lib.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const ctx = { request, env, params: {} };
    if (pathname.startsWith("/api/") && request.method === "OPTIONS") return options();
    if (pathname === "/api/live" && request.method === "GET") return live.onRequestGet(ctx);
    if (pathname === "/api/submit" && request.method === "POST") return submit.onRequestPost(ctx);
    if (pathname.startsWith("/api/admin/")) {
      ctx.params.path = pathname.slice("/api/admin/".length).split("/").filter(Boolean);
      return admin.onRequest(ctx);
    }
    if (pathname.startsWith("/api/")) return json({ error: "not-found" }, 404);
    return env.ASSETS.fetch(request);
  }
};
