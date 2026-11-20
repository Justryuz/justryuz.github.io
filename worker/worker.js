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
      "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
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

      const user = String(body.user || "").trim().slice(0, 40);
      const pass = String(body.password || "").slice(0, 200);
      const acct = await authenticate(env, user, pass);

      if (!acct) {
        const n = (rec && rec.until > Date.now() ? rec.n : 0) + 1;
        fails.set(ip, { n, until: Date.now() + LOCK_MS });
        await new Promise((r) => setTimeout(r, 1000));   // slow down guessing
        return json({ ok: false, error: "denied" }, 401);
      }
      fails.delete(ip);
      const token = await sign({ u: acct.u, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL }, env.TOKEN_SECRET);
      return json({ ok: true, token, role: acct.r });
    }

    if (url.pathname === "/motd" && request.method === "GET") {
      const s = await getSession(env, request);
      if (!s) return json({ ok: false, error: "unauthorized" }, 401);
      return json({ ok: true, user: s.u, motd: env.PRIVATE_MOTD || "Welcome back." });
    }

    /* ---------- public: list posts ---------- */
    if (url.pathname === "/posts" && request.method === "GET") {
      const raw = env.POSTS ? await env.POSTS.get("posts") : null;
      const res = json({ ok: true, initialized: raw !== null, posts: raw ? JSON.parse(raw) : [] });
      res.headers.set("Cache-Control", "public, max-age=20");
      return res;
    }

    /* ---------- admin (Bearer token required) ---------- */
    if (url.pathname.startsWith("/admin/")) {
      if (!env.POSTS) return json({ ok: false, error: "KV binding POSTS missing" }, 500);
      // Role and existence are re-checked from KV on every call, so deleting a user
      // or changing a role takes effect immediately, even with a still-valid token.
      const me = await getSession(env, request);
      if (!me) return json({ ok: false, error: "unauthorized" }, 401);
      const isAdmin = me.r === "admin";

      if (url.pathname === "/admin/me" && request.method === "GET") return json({ ok: true, user: me.u, role: me.r, root: !!me.root });

      const load = async () => { const r = await env.POSTS.get("posts"); return r ? JSON.parse(r) : null; };
      const save = async (list) => {
        const s = JSON.stringify(list);
        if (s.length > 5_000_000) throw new Error("too large");
        await env.POSTS.put("posts", s);
      };
      const readBody = async () => {
        const text = await request.text();
        if (text.length > 300_000) throw new Error("too large");
        return JSON.parse(text);
      };

      try {
        // One-time import of the posts bundled in data.js
        if (url.pathname === "/admin/import" && request.method === "POST") {
          if (!isAdmin) return json({ ok: false, error: "admin sahaja" }, 403);
          if ((await load()) !== null) return json({ ok: false, error: "already initialized" }, 409);
          const body = await readBody();
          const list = [];
          for (const p of Array.isArray(body.posts) ? body.posts : []) {
            const c = cleanPost(p);
            if (c.error) return json({ ok: false, error: c.error, slug: p && p.slug }, 400);
            list.push(c.post);
          }
          await save(list);
          return json({ ok: true, count: list.length });
        }

        // Create (create:true) or update a post
        if (url.pathname === "/admin/posts" && request.method === "PUT") {
          const body = await readBody();
          const c = cleanPost(body.post);
          if (c.error) return json({ ok: false, error: c.error }, 400);
          const list = (await load()) || [];
          const i = list.findIndex((x) => x.slug === c.post.slug);
          if (body.create && i !== -1) return json({ ok: false, error: "slug sudah wujud" }, 409);
          if (!body.create && i === -1) return json({ ok: false, error: "post tidak dijumpai" }, 404);
          if (i !== -1 && !isAdmin && list[i].author !== me.u) return json({ ok: false, error: "bukan post anda" }, 403);
          if (i === -1) { c.post.author = me.u; list.push(c.post); }
          else {
            c.post.hits = list[i].hits;
            if (list[i].author) c.post.author = list[i].author;   // author never changes on edit
            list[i] = c.post;
          }
          await save(list);
          return json({ ok: true, slug: c.post.slug });
        }

        // Delete
        const m = /^\/admin\/posts\/([a-z0-9-]{1,80})$/.exec(url.pathname);
        if (m && request.method === "DELETE") {
          const list = (await load()) || [];
          const target = list.find((x) => x.slug === m[1]);
          if (!target) return json({ ok: false, error: "post tidak dijumpai" }, 404);
          if (!isAdmin && target.author !== me.u) return json({ ok: false, error: "bukan post anda" }, 403);
          await save(list.filter((x) => x.slug !== m[1]));
          return json({ ok: true });
        }

        /* ---------- change own password ---------- */
        if (url.pathname === "/admin/password" && request.method === "POST") {
          if (me.root) return json({ ok: false, error: "akaun root: guna 'wrangler secret put PASSWORD'" }, 400);
          const body = await readBody();
          const bad = passwordProblem(body.password);
          if (bad) return json({ ok: false, error: bad }, 400);
          if (!(await authenticate(env, me.u, String(body.current || "")))) return json({ ok: false, error: "password semasa salah" }, 403);
          const users = await loadUsers(env);
          users[me.u].salt = newSalt();
          users[me.u].hash = await hashPw(body.password, users[me.u].salt);
          await saveUsers(env, users);
          return json({ ok: true });
        }

        /* ---------- user management (admin only) ---------- */
        if (url.pathname.startsWith("/admin/users")) {
          if (!isAdmin) return json({ ok: false, error: "admin sahaja" }, 403);
          const root = env.USERNAME || "justryuz";
          const users = await loadUsers(env);

          if (url.pathname === "/admin/users" && request.method === "GET") {
            const list = Object.keys(users).sort().map((n) => ({ username: n, role: users[n].role, created: users[n].created }));
            return json({ ok: true, root, users: list });
          }

          if (url.pathname === "/admin/users" && request.method === "POST") {
            const body = await readBody();
            const name = String(body.username || "").trim();
            if (!USER_RE.test(name)) return json({ ok: false, error: "username: 3-20 huruf kecil, angka atau _" }, 400);
            if (name === root || users[name]) return json({ ok: false, error: "username sudah wujud" }, 409);
            if (!ROLES.includes(body.role)) return json({ ok: false, error: "role tidak sah" }, 400);
            const bad = passwordProblem(body.password);
            if (bad) return json({ ok: false, error: bad }, 400);
            const salt = newSalt();
            users[name] = { role: body.role, salt, hash: await hashPw(body.password, salt), created: new Date().toISOString().slice(0, 10) };
            await saveUsers(env, users);
            return json({ ok: true });
          }

          const um = /^\/admin\/users\/([a-z0-9_]{3,20})$/.exec(url.pathname);
          if (um && request.method === "PUT") {          // change role and/or reset password
            const name = um[1];
            if (!users[name]) return json({ ok: false, error: "user tidak dijumpai" }, 404);
            const body = await readBody();
            if (body.role !== undefined) {
              if (!ROLES.includes(body.role)) return json({ ok: false, error: "role tidak sah" }, 400);
              if (name === me.u && body.role !== users[name].role) return json({ ok: false, error: "tidak boleh tukar role sendiri" }, 400);
              users[name].role = body.role;
            }
            if (body.password !== undefined) {
              const bad = passwordProblem(body.password);
              if (bad) return json({ ok: false, error: bad }, 400);
              users[name].salt = newSalt();
              users[name].hash = await hashPw(body.password, users[name].salt);
            }
            await saveUsers(env, users);
            return json({ ok: true });
          }
          if (um && request.method === "DELETE") {
            if (um[1] === me.u) return json({ ok: false, error: "tidak boleh padam akaun sendiri" }, 400);
            if (!users[um[1]]) return json({ ok: false, error: "user tidak dijumpai" }, 404);
            delete users[um[1]];
            await saveUsers(env, users);
            return json({ ok: true });
          }
        }
      } catch (e) {
        return json({ ok: false, error: "bad request" }, 400);
      }
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

/* ---------- validation: never trust the client ---------- */
const GROUPS = ["blog", "writeups", "notes"];
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanPost(p) {
  if (!p || typeof p !== "object") return { error: "post tidak sah" };
  const slug = str(p.slug, 80);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: "slug: huruf kecil, angka dan '-' sahaja" };
  const title = str(p.title, 150);
  if (!title) return { error: "title wajib" };
  const date = str(p.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "date: format YYYY-MM-DD" };
  if (!GROUPS.includes(p.group)) return { error: "group tidak sah" };
  const level = Number(p.level);
  if (!Number.isInteger(level) || level < 1 || level > 5) return { error: "level: 1 hingga 5" };

  const body = [];
  for (const b of Array.isArray(p.body) ? p.body.slice(0, 200) : []) {
    if (!b || !["p", "h", "code"].includes(b.t)) return { error: "blok body tidak sah" };
    const x = typeof b.x === "string" ? b.x.slice(0, 20000) : "";
    if (x) body.push({ t: b.t, x });
  }
  const tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => str(t, 30)).filter(Boolean).slice(0, 12);

  return {
    post: {
      slug, title, date, group: p.group, level, body, tags,
      type: str(p.type, 40) || "misc",
      platform: str(p.platform, 40),
      summary: str(p.summary, 300),
      tested: str(p.tested, 100),
      ref: str(p.ref, 200),
      hits: Number.isFinite(p.hits) && p.hits >= 0 ? Math.floor(p.hits) : 0,
    },
  };
}
/* ---------- users and roles ----------
   Root account: env USERNAME + secret PASSWORD (always admin, cannot be deleted from the panel).
   Other accounts live in KV key "users" as { name: { role, salt, hash, created } }.
   Passwords are stored only as PBKDF2-SHA256 hashes (100k iterations, per-user random salt). */
const USER_RE = /^[a-z0-9_]{3,20}$/;
const ROLES = ["admin", "editor"];
const DUMMY_SALT = "0000000000000000000000";   // used to keep timing similar for unknown users

function passwordProblem(p) {
  if (typeof p !== "string" || p.length < 10) return "password minimum 10 aksara";
  if (p.length > 128) return "password terlalu panjang";
  return "";
}

function newSalt() {
  return b64u(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashPw(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return b64u(bits);
}

async function loadUsers(env) {
  const raw = env.POSTS ? await env.POSTS.get("users") : null;
  return raw ? JSON.parse(raw) : {};
}
async function saveUsers(env, users) {
  await env.POSTS.put("users", JSON.stringify(users));
}

/** Returns { u, r, root? } when the credentials are valid, else null. */
async function authenticate(env, user, pass) {
  const rootName = env.USERNAME || "justryuz";
  const isRoot = await safeEqual(user, rootName);
  const okRoot = await safeEqual(pass, env.PASSWORD || "");
  if (isRoot) return env.PASSWORD && okRoot ? { u: rootName, r: "admin", root: true } : null;

  if (!env.POSTS || !USER_RE.test(user)) { await hashPw(pass, DUMMY_SALT); return null; }
  const rec = (await loadUsers(env))[user];
  const h = await hashPw(pass, rec ? rec.salt : DUMMY_SALT);
  if (rec && (await safeEqual(h, rec.hash))) return { u: user, r: rec.role };
  return null;
}

/** Valid token + account still exists. Role comes from KV, never from the token. */
async function getSession(env, request) {
  const auth = request.headers.get("Authorization") || "";
  const payload = await verify(auth.replace(/^Bearer /, ""), env.TOKEN_SECRET);
  if (!payload) return null;
  if (payload.u === (env.USERNAME || "justryuz")) return { u: payload.u, r: "admin", root: true };
  const rec = (await loadUsers(env))[payload.u];
  return rec ? { u: payload.u, r: rec.role } : null;
}
