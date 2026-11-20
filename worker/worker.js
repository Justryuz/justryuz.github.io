/* Cloudflare Worker: auth gateway for the ssh-style login.
   Secrets (set with `wrangler secret put`, never in git):
     PASSWORD      the real login password
     TOKEN_SECRET  random string used to sign session tokens
     PRIVATE_MOTD  (optional) text shown in the private shell
   Vars (wrangler.toml): ALLOWED_ORIGIN, USERNAME */

const enc = new TextEncoder();
const fails = new Map();          // ip -> { n, until }  (best effort, per isolate)
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const TOKEN_TTL = 60 * 60;        // seconds

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim());
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    // Refuse browsers from other origins.
    if (origin && !allowed.includes(origin)) return json({ ok: false, error: "forbidden" }, 403);

    const url = new URL(request.url);

    if (url.pathname === "/login" && request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const rec = fails.get(ip);
      if (rec && rec.until > Date.now() && rec.n >= MAX_FAILS) return json({ ok: false, error: "locked" }, 429);

      let body;
      try {
        const text = await request.text();
        if (text.length > 1024) return json({ ok: false, error: "too large" }, 413);
        body = JSON.parse(text);
      } catch { return json({ ok: false, error: "bad request" }, 400); }

      const user = String(body.user || "");
      const pass = String(body.password || "");
      const okUser = await safeEqual(user, env.USERNAME || "justryuz");
      const okPass = await safeEqual(pass, env.PASSWORD || "");

      if (!env.PASSWORD || !okUser || !okPass) {
        const n = (rec && rec.until > Date.now() ? rec.n : 0) + 1;
        fails.set(ip, { n, until: Date.now() + LOCK_MS });
        await new Promise((r) => setTimeout(r, 1000));   // slow down guessing
        return json({ ok: false, error: "denied" }, 401);
      }
      fails.delete(ip);
      const token = await sign({ u: user, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL }, env.TOKEN_SECRET);
      return json({ ok: true, token });
    }

    if (url.pathname === "/motd" && request.method === "GET") {
      const auth = request.headers.get("Authorization") || "";
      const payload = await verify(auth.replace(/^Bearer /, ""), env.TOKEN_SECRET);
      if (!payload) return json({ ok: false, error: "unauthorized" }, 401);
      return json({ ok: true, user: payload.u, motd: env.PRIVATE_MOTD || "Welcome back." });
    }

    return json({ ok: false, error: "not found" }, 404);
  },
};

/* Constant-time string compare: hash both sides, then XOR the digests. */
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hmacKey = (secret) => crypto.subtle.importKey("raw", enc.encode(secret || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

async function sign(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return body + "." + b64u(sig);
}

async function verify(token, secret) {
  if (!secret) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expect = b64u(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  if (!(await safeEqual(sig, expect))) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch { return null; }
}
