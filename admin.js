/* Admin panel: login, list, create, edit, delete posts.
   Talks to the Cloudflare Worker (CONFIG.API_URL). The token lives in sessionStorage
   (cleared when the tab closes). All text is rendered with textContent. */
(function () {
  "use strict";

  var C = window.CONFIG;
  var API = C.API_URL;
  var KEY = "jr_token";

  var $ = function (id) { return document.getElementById(id); };
  var token = sessionStorage.getItem(KEY);
  var posts = [];
  var editing = null;      // slug being edited, or null when creating
  var me = { user: "", role: "editor", root: false };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(id, text, kind) {
    var m = $(id);
    m.textContent = text || "";
    m.className = "msg" + (kind ? " " + kind : "");
  }

  /* ---------- API ---------- */
  async function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    var r = await fetch(API + path, { method: opts.method || "GET", cache: "no-store", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    var j = {};
    try { j = await r.json(); } catch (e) { /* non-JSON error */ }
    if (r.status === 401 && token) { logout("Sesi tamat. Login semula."); throw new Error("unauthorized"); }
    if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
    return j;
  }

  /* ---------- auth ---------- */
  function showLogin(msg) {
    me = { user: "", role: "editor", root: false };
    $("dash").hidden = true;
    $("login-box").hidden = false;
    $("who").textContent = "belum login";
    if (msg) say("login-msg", msg, "err");
    $("l-pass").value = "";
  }
  function logout(msg) {
    token = null;
    sessionStorage.removeItem(KEY);
    showLogin(msg);
  }
  async function enter() {
    me = await api("/admin/me");
    $("login-box").hidden = true;
    $("dash").hidden = false;
    $("who").textContent = me.user + "@" + me.role;
    $("tab-users").hidden = me.role !== "admin";
    $("acc-info").textContent = "User: " + me.user + "  |  Role: " + me.role +
      (me.root ? "  |  Akaun root: tukar password guna 'wrangler secret put PASSWORD'." : "");
    $("pw-form").hidden = me.root;
    showTab("posts");
    await refresh();
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ["posts", "users", "account"].forEach(function (t) { $("pane-" + t).hidden = t !== name; });
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
    $("editor").hidden = true;
    if (name === "users") loadUsers();
  }
  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () { showTab(b.dataset.tab); });
  });

  $("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button");
    btn.disabled = true;
    say("login-msg", "Menyemak...");
    try {
      var r = await fetch(API + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: $("l-user").value, password: $("l-pass").value })
      });
      var j = await r.json();
      if (r.status === 429) throw new Error("Terlalu banyak percubaan. Cuba lagi nanti.");
      if (!r.ok || !j.ok) throw new Error("User atau password salah.");
      token = j.token;
      sessionStorage.setItem(KEY, token);
      say("login-msg", "");
      await enter();
    } catch (err) {
      say("login-msg", err.message === "Failed to fetch" ? "Tidak dapat hubungi server." : err.message, "err");
    }
    $("l-pass").value = "";
    btn.disabled = false;
  });

  $("logout-btn").addEventListener("click", function () { logout(); });

  /* ---------- list ---------- */
  async function refresh() {
    say("dash-msg", "Memuat...");
    try {
      var j = await api("/posts");
      posts = j.posts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      $("import-btn").hidden = j.initialized || me.role !== "admin";
      renderList(j.initialized);
      say("dash-msg", "");
    } catch (err) { say("dash-msg", "Gagal memuat: " + err.message, "err"); }
  }

  function renderList(initialized) {
    var t = $("list");
    t.textContent = "";
    var head = el("tr");
    ["Tarikh", "Title", "Author", "Kumpulan", "Level", ""].forEach(function (h) { head.appendChild(el("th", "", h)); });
    t.appendChild(head);

    if (!initialized) {
      var tr0 = el("tr"), td0 = el("td", "", "Belum ada data di server. Klik 'Import post dari data.js' atau buat post baru.");
      td0.colSpan = 6; tr0.appendChild(td0); t.appendChild(tr0);
      return;
    }
    if (!posts.length) {
      var tr1 = el("tr"), td1 = el("td", "", "Tiada post."); td1.colSpan = 6; tr1.appendChild(td1); t.appendChild(tr1);
      return;
    }
    posts.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", "", p.date));
      var td = el("td");
      var a = el("a", "", p.title);
      a.href = "post.html?p=" + encodeURIComponent(p.slug);
      a.target = "_blank"; a.rel = "noopener";
      td.appendChild(a);
      tr.appendChild(td);
      tr.appendChild(el("td", "", p.author || "justryuz"));
      tr.appendChild(el("td", "", p.group));
      tr.appendChild(el("td", "", String(p.level)));

      var act = el("td", "act");
      var mine = me.role === "admin" || p.author === me.user;   // the server enforces this too
      if (!mine) { tr.appendChild(act); t.appendChild(tr); return; }
      var eb = el("button", "btn alt small", "Edit"); eb.type = "button";
      eb.addEventListener("click", function () { openEditor(p); });
      var db = el("button", "btn danger small", "Padam"); db.type = "button";
      db.style.marginLeft = "6px";
      db.addEventListener("click", function () { remove(p); });
      act.appendChild(eb); act.appendChild(db);
      tr.appendChild(act);
      t.appendChild(tr);
    });
  }

  async function remove(p) {
    if (!confirm("Padam post ini?\n\n" + p.title)) return;
    try { await api("/admin/posts/" + encodeURIComponent(p.slug), { method: "DELETE" }); say("dash-msg", "Dipadam.", "ok"); await refresh(); }
    catch (err) { say("dash-msg", "Gagal padam: " + err.message, "err"); }
  }

  $("import-btn").addEventListener("click", async function () {
    var seed = [];
    window.SITE.groups.forEach(function (g) {
      g.posts.forEach(function (p) { var c = JSON.parse(JSON.stringify(p)); c.group = g.id; seed.push(c); });
    });
    try { var j = await api("/admin/import", { method: "POST", body: { posts: seed } }); say("dash-msg", j.count + " post diimport.", "ok"); await refresh(); }
    catch (err) { say("dash-msg", "Import gagal: " + err.message, "err"); }
  });

  /* ---------- body <-> text ---------- */
  function bodyToText(body) {
    return (body || []).map(function (b) {
      if (b.t === "h") return "# " + b.x;
      if (b.t === "code") return "```\n" + b.x + "\n```";
      return b.x;
    }).join("\n\n");
  }
  function textToBody(text) {
    var blocks = [], lines = text.replace(/\r/g, "").split("\n"), para = [], code = null;
    function flush() { if (para.length) { blocks.push({ t: "p", x: para.join("\n") }); para = []; } }
    lines.forEach(function (ln) {
      if (code !== null) {
        if (ln.trim() === "```") { blocks.push({ t: "code", x: code.join("\n") }); code = null; }
        else code.push(ln);
      } else if (ln.trim() === "```") { flush(); code = []; }
      else if (/^# /.test(ln)) { flush(); blocks.push({ t: "h", x: ln.slice(2).trim() }); }
      else if (ln.trim() === "") flush();
      else para.push(ln);
    });
    if (code !== null) blocks.push({ t: "code", x: code.join("\n") });   // unclosed fence
    flush();
    return blocks;
  }

  /* ---------- editor ---------- */
  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  function openEditor(p) {
    editing = p ? p.slug : null;
    $("ed-title").textContent = p ? "Edit post" : "Post baru";
    $("f-title").value = p ? p.title : "";
    $("f-slug").value = p ? p.slug : "";
    $("f-slug").readOnly = !!p;          // slug is the post ID, fixed after creation
    $("f-date").value = p ? p.date : new Date().toISOString().slice(0, 10);
    $("f-group").value = p ? p.group : "blog";
    $("f-type").value = p ? p.type || "" : "";
    $("f-platform").value = p ? p.platform || "" : "";
    $("f-level").value = p ? p.level : 1;
    $("f-tested").value = p ? p.tested || "" : "";
    $("f-summary").value = p ? p.summary || "" : "";
    $("f-tags").value = p ? (p.tags || []).join(", ") : "";
    $("f-ref").value = p ? p.ref || "" : "";
    $("f-body").value = p ? bodyToText(p.body) : "";
    say("ed-msg", "");
    $("editor").hidden = false;
    $("editor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("new-btn").addEventListener("click", function () { openEditor(null); });
  $("cancel-btn").addEventListener("click", function () { $("editor").hidden = true; });
  $("f-title").addEventListener("input", function () {
    if (editing === null && !$("f-slug").dataset.touched) $("f-slug").value = slugify($("f-title").value);
  });
  $("f-slug").addEventListener("input", function () { $("f-slug").dataset.touched = "1"; });

  $("ed-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("save-btn");
    btn.disabled = true;
    say("ed-msg", "Menyimpan...");
    var post = {
      slug: $("f-slug").value.trim(),
      title: $("f-title").value.trim(),
      date: $("f-date").value,
      group: $("f-group").value,
      type: $("f-type").value.trim(),
      platform: $("f-platform").value.trim(),
      level: Number($("f-level").value),
      tested: $("f-tested").value.trim(),
      summary: $("f-summary").value.trim(),
      ref: $("f-ref").value.trim(),
      tags: $("f-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
      body: textToBody($("f-body").value)
    };
    try {
      await api("/admin/posts", { method: "PUT", body: { post: post, create: editing === null } });
      $("editor").hidden = true;
      $("f-slug").dataset.touched = "";
      say("dash-msg", "Disimpan. Paparan awam dikemas kini dalam ~20 saat.", "ok");
      await refresh();
    } catch (err) { say("ed-msg", "Gagal: " + err.message, "err"); }
    btn.disabled = false;
  });

  /* ---------- users (admin only) ---------- */
  async function loadUsers() {
    var t = $("ulist");
    t.textContent = "";
    try {
      var j = await api("/admin/users");
      var head = el("tr");
      ["Username", "Role", "Dibuat", ""].forEach(function (h) { head.appendChild(el("th", "", h)); });
      t.appendChild(head);

      var r0 = el("tr");
      r0.appendChild(el("td", "", j.root));
      var rtd = el("td"); rtd.appendChild(el("span", "role", "admin (root)")); r0.appendChild(rtd);
      r0.appendChild(el("td", "", "-"));
      r0.appendChild(el("td", "act", "ubah melalui wrangler"));
      t.appendChild(r0);

      j.users.forEach(function (u) {
        var tr = el("tr");
        tr.appendChild(el("td", "", u.username));
        var td = el("td");
        var sel = el("select");
        ["editor", "admin"].forEach(function (r) { var o = el("option", "", r); o.value = r; sel.appendChild(o); });
        sel.value = u.role;
        sel.disabled = u.username === me.user;
        sel.addEventListener("change", function () { updateUser(u.username, { role: sel.value }, "Role dikemas kini."); });
        td.appendChild(sel);
        tr.appendChild(td);
        tr.appendChild(el("td", "", u.created || "-"));

        var act = el("td", "act");
        var pb = el("button", "btn alt small", "Reset password"); pb.type = "button";
        pb.addEventListener("click", function () {
          var np = prompt("Password baru untuk " + u.username + " (min 10 aksara):");
          if (np) updateUser(u.username, { password: np }, "Password " + u.username + " ditukar.");
        });
        act.appendChild(pb);
        if (u.username !== me.user) {
          var db = el("button", "btn danger small", "Padam"); db.type = "button"; db.style.marginLeft = "6px";
          db.addEventListener("click", async function () {
            if (!confirm("Padam user " + u.username + "?")) return;
            try { await api("/admin/users/" + encodeURIComponent(u.username), { method: "DELETE" }); say("dash-msg", "User dipadam.", "ok"); loadUsers(); }
            catch (err) { say("dash-msg", "Gagal: " + err.message, "err"); }
          });
          act.appendChild(db);
        }
        tr.appendChild(act);
        t.appendChild(tr);
      });
    } catch (err) { say("dash-msg", "Gagal memuat user: " + err.message, "err"); }
  }

  async function updateUser(name, body, okMsg) {
    try { await api("/admin/users/" + encodeURIComponent(name), { method: "PUT", body: body }); say("dash-msg", okMsg, "ok"); }
    catch (err) { say("dash-msg", "Gagal: " + err.message, "err"); }
    loadUsers();
  }

  $("u-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      await api("/admin/users", { method: "POST", body: { username: $("u-name").value.trim(), password: $("u-pass").value, role: $("u-role").value } });
      say("u-msg", "User dicipta.", "ok");
      $("u-name").value = ""; $("u-pass").value = "";
      loadUsers();
    } catch (err) { say("u-msg", "Gagal: " + err.message, "err"); }
  });

  /* ---------- change own password ---------- */
  $("pw-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if ($("pw-new").value !== $("pw-new2").value) { say("pw-msg", "Password baru tidak sepadan.", "err"); return; }
    try {
      await api("/admin/password", { method: "POST", body: { current: $("pw-cur").value, password: $("pw-new").value } });
      say("pw-msg", "Password ditukar.", "ok");
      $("pw-form").reset();
    } catch (err) { say("pw-msg", "Gagal: " + err.message, "err"); }
  });

  /* ---------- start ---------- */
  if (!API) {
    showLogin("API_URL belum diisi dalam config.js. Deploy Worker dahulu (worker/README.md).");
    $("login-form").querySelector("button").disabled = true;
  } else if (token) {
    enter().catch(function () { /* logout() already shows the login box on 401 */ });
  } else {
    $("l-user").value = C.ownerUser;
    showLogin();
  }
  $("l-user").value = C.ownerUser;
})();
