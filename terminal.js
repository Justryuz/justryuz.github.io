/* justryuz-shell :: SSH-style terminal.
   - ssh guest@host   -> puzzle shell (wargame levels, hashed passwords from config.js)
   - ssh justryuz@host -> real login, password verified by the Worker (CONFIG.API_URL)
   All output uses textContent (no innerHTML). */
(function () {
  "use strict";

  var C = window.CONFIG;
  var out = document.getElementById("out");
  var input = document.getElementById("input");
  var promptEl = document.getElementById("prompt");
  var screen = document.getElementById("screen");
  var titleEl = document.querySelector(".term-title");

  var state = {
    user: "",            // logged-in real account
    view: "local",       // local | guest | owner
    modeName: "short",
    level: 0,
    cwd: [],             // path parts below the level home
    ask: null,           // pending password prompt: { label, done(fn) }
    tries: 0,
    token: null,
    history: [], hIdx: 0,
    busy: false
  };

  /* ---------- output helpers ---------- */
  function print(text, cls) {
    String(text).split("\n").forEach(function (l) {
      var d = document.createElement("div");
      if (cls) d.className = cls;
      d.textContent = l === "" ? "\u00a0" : l;
      out.appendChild(d);
    });
    screen.scrollTop = screen.scrollHeight;
  }
  function echoCmd(text, secret) {
    var d = document.createElement("div");
    d.className = "cmd";
    var p = document.createElement("span");
    p.className = "p";
    p.textContent = promptEl.textContent + " ";
    d.appendChild(p);
    d.appendChild(document.createTextNode(secret ? "" : text));
    out.appendChild(d);
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- prompt ---------- */
  function homePath() { return "/home/level" + state.level; }
  function setPrompt() {
    var p;
    if (state.ask) p = state.ask.label;
    else if (state.view === "guest") p = "level" + state.level + "@git:~" + (state.cwd.length ? "/" + state.cwd.join("/") : "") + "$";
    else if (state.view === "owner") p = state.user + "@git:~#";
    else p = "visitor@local:~$";
    promptEl.textContent = p;
    input.type = state.ask ? "password" : "text";
    input.classList.toggle("secret", !!state.ask);
    if (!state.ask) titleEl.textContent = p.replace(/[$#]$/, "");
  }

  /* ---------- crypto ---------- */
  async function sha256(s) {
    if (!window.crypto || !crypto.subtle) throw new Error("crypto.subtle tidak tersedia (guna HTTPS).");
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  /* ---------- virtual filesystem ---------- */
  function fsRoot() { return C.levels[state.level].fs; }
  function walk(parts) {
    var node = fsRoot();
    for (var i = 0; i < parts.length; i++) {
      if (typeof node !== "object" || !Object.prototype.hasOwnProperty.call(node, parts[i])) return undefined;
      node = node[parts[i]];
    }
    return node;
  }
  /** Resolve a user path to parts under the level home; null when it escapes home. */
  function resolve(p) {
    var parts = state.cwd.slice();
    if (p === "~" || p.indexOf("~/") === 0) { parts = []; p = p.slice(2); }
    else if (p.indexOf(homePath()) === 0) { parts = []; p = p.slice(homePath().length); }
    else if (p.charAt(0) === "/") return null;
    var segs = p.split("/");
    for (var i = 0; i < segs.length; i++) {
      if (segs[i] === "" || segs[i] === ".") continue;
      if (segs[i] === "..") { if (!parts.length) return null; parts.pop(); }
      else parts.push(segs[i]);
    }
    return parts;
  }

  /* ---------- guest commands ---------- */
  function tokenize(s) {
    var m = s.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    return m.map(function (t) { return /^["'].*["']$/.test(t) ? t.slice(1, -1) : t; });
  }
  function readFile(arg, cmd) {
    var parts = resolve(arg);
    if (!parts) throw new Error(cmd + ": " + arg + ": Permission denied");
    var node = walk(parts);
    if (node === undefined) throw new Error(cmd + ": " + arg + ": No such file or directory");
    if (typeof node === "object") throw new Error(cmd + ": " + arg + ": Is a directory");
    return node;
  }
  function textIn(args, stdin, cmd) {
    if (args.length) return readFile(args[0], cmd);
    if (stdin !== null) return stdin;
    throw new Error(cmd + ": tiada input");
  }
  function rot13(s) {
    return s.replace(/[a-z]/gi, function (c) {
      var b = c <= "Z" ? 65 : 97;
      return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b);
    });
  }

  var COMMANDS = {
    pwd: function () { return homePath() + (state.cwd.length ? "/" + state.cwd.join("/") : "") + "\n"; },
    whoami: function () { return "level" + state.level + "\n"; },
    echo: function (a) { return a.join(" ") + "\n"; },
    ls: function (a) {
      var all = a.indexOf("-a") !== -1 || a.indexOf("-la") !== -1 || a.indexOf("-al") !== -1;
      var rest = a.filter(function (x) { return x.charAt(0) !== "-"; });
      var parts = rest.length ? resolve(rest[0]) : state.cwd;
      if (!parts) throw new Error("ls: Permission denied");
      var node = walk(parts);
      if (node === undefined) throw new Error("ls: " + rest[0] + ": No such file or directory");
      if (typeof node !== "object") return rest[0] + "\n";
      var names = Object.keys(node).filter(function (n) { return all || n.charAt(0) !== "."; }).sort();
      return names.map(function (n) { return typeof node[n] === "object" ? n + "/" : n; }).join("  ") + "\n";
    },
    cat: function (a, stdin) { return textIn(a, stdin, "cat"); },
    cd: function (a) {
      var parts = a.length ? resolve(a[0]) : [];
      if (!parts) throw new Error("cd: Permission denied");
      var node = walk(parts);
      if (node === undefined) throw new Error("cd: " + a[0] + ": No such file or directory");
      if (typeof node !== "object") throw new Error("cd: " + a[0] + ": Not a directory");
      state.cwd = parts;
      return "";
    },
    grep: function (a, stdin) {
      var icase = a.indexOf("-i") !== -1;
      var rest = a.filter(function (x) { return x !== "-i"; });
      if (!rest.length) throw new Error("grep: tiada pattern");
      var pat = icase ? rest[0].toLowerCase() : rest[0];
      var text = textIn(rest.slice(1), stdin, "grep");
      var hit = text.split("\n").filter(function (l) {
        return (icase ? l.toLowerCase() : l).indexOf(pat) !== -1;
      });
      return hit.length ? hit.join("\n") + "\n" : "";
    },
    base64: function (a, stdin) {
      var args = a.filter(function (x) { return x !== "-d" && x !== "--decode"; });
      if (args.length === a.length) throw new Error("base64: guna -d untuk decode");
      try { return atob(textIn(args, stdin, "base64").trim()) + "\n"; }
      catch (e) { if (e.message.indexOf("base64:") === 0) throw e; throw new Error("base64: input tidak sah"); }
    },
    rot13: function (a, stdin) { return rot13(textIn(a, stdin, "rot13")); },
    unhex: function (a, stdin) {
      var h = textIn(a, stdin, "unhex").replace(/\s+/g, "");
      if (!/^([0-9a-fA-F]{2})+$/.test(h)) throw new Error("unhex: input tidak sah");
      var s = "";
      for (var i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16));
      return s + "\n";
    },
    hint: function () { return "hint: " + C.levels[state.level].hint + "\n"; },
    goal: function () { return C.levels[state.level].goal + "\n"; }
  };

  function guestHelp() {
    return [
      "Perintah: ls [-a], cat, cd, pwd, grep [-i], base64 -d, rot13, unhex, echo, whoami",
      "Paip (|) disokong, contoh: cat fail | rot13",
      "su <user>   tukar ke level lain (perlu password)",
      "goal        matlamat level ini",
      "hint        petunjuk",
      "exit        keluar"
    ].join("\n") + "\n";
  }

  function enterLevel(k) {
    state.level = k; state.cwd = [];
    print("");
    print("== Level " + k + " / " + (modeN() - 1) + " ==", "sys");
    print(C.levels[k].goal, "sys");
  }
  function modeN() { return C.modes[state.modeName]; }

  async function guestExec(line) {
    var stages = line.split("|").map(function (s) { return tokenize(s.trim()); });
    var first = stages[0];
    if (!first.length) return;
    var cmd = first[0];

    if (stages.length === 1) {
      if (cmd === "help") return print(guestHelp());
      if (cmd === "clear") { out.textContent = ""; return; }
      if (cmd === "exit" || cmd === "logout") { state.view = "local"; print("logout\nConnection to " + C.host + " closed."); return; }
      if (cmd === "su") return startSu(first[1]);
    }

    var data = null;
    try {
      for (var i = 0; i < stages.length; i++) {
        var t = stages[i];
        if (!t.length) throw new Error("syntax error near '|'");
        var fn = Object.prototype.hasOwnProperty.call(COMMANDS, t[0]) ? COMMANDS[t[0]] : null;
        if (!fn) throw new Error(t[0] + ": command not found");
        data = fn(t.slice(1), i === 0 ? null : data);
      }
      if (data) print(data.replace(/\n$/, ""));
    } catch (e) { print(e.message, "err"); }
  }

  function startSu(target) {
    if (!target) return print("su: guna 'su <user>'", "err");
    var n = modeN();
    var hashKey;
    var m = /^level(\d+)$/.exec(target);
    if (m && +m[1] >= 1 && +m[1] < n) hashKey = +m[1];
    else if (target === "victor") hashKey = n;
    else return askPassword("Password: ", function () { print("su: Authentication failure", "err"); });

    askPassword("Password: ", async function (pw) {
      var h = await sha256(pw);
      if (h !== C.hashes[hashKey]) return print("su: Authentication failure", "err");
      if (target === "victor") {
        print("");
        print("Tahniah! Semua level selesai (" + state.modeName + ").", "sys");
        print(C.flag, "sys");
        if (state.modeName === "short") print("Cuba mode lebih sukar: ketik 'exit', kemudian 'mode medium'.", "dim");
        state.view = "local";
        return;
      }
      enterLevel(hashKey);
    });
  }

  /* ---------- password prompt ---------- */
  function askPassword(label, done) { state.ask = { label: label, done: done }; }

  /* ---------- local (pre-login) commands ---------- */
  async function localExec(line) {
    var t = tokenize(line);
    if (!t.length) return;
    switch (t[0]) {
      case "help":
        return print([
          "Perintah:",
          "  ssh <user>@" + C.host + "   log masuk",
          "  mode short|medium          pilih kesukaran puzzle (sekarang: " + state.modeName + ")",
          "  clear                      kosongkan skrin",
          "",
          "Guest: ssh guest@" + C.host + "  (password: guest)"
        ].join("\n"));
      case "clear": out.textContent = ""; return;
      case "mode":
        if (!t[1]) return print("mode: " + state.modeName + " (" + modeN() + " level). Pilihan: " + Object.keys(C.modes).join(", "));
        if (!Object.prototype.hasOwnProperty.call(C.modes, t[1])) return print("mode: tidak dikenali '" + t[1] + "'", "err");
        state.modeName = t[1];
        return print("mode " + t[1] + ": " + C.modes[t[1]] + " level.");
      case "ssh": return startSsh(t[1]);
      default: print(t[0] + ": command not found. Taip 'help'.", "err");
    }
  }

  function startSsh(target) {
    if (!target) return print("usage: ssh user@" + C.host, "err");
    var user = target, host = C.host;
    if (target.indexOf("@") !== -1) { user = target.split("@")[0]; host = target.split("@")[1]; }
    if (host !== C.host && C.hostAliases.indexOf(host) === -1) return print("ssh: Could not resolve hostname " + host, "err");
    state.tries = 0;
    attempt(user, host);
  }

  function attempt(user, host) {
    askPassword(user + "@" + host + "'s password: ", async function (pw) {
      var ok = false;
      if (user === "guest") ok = (await sha256(pw)) === C.guestHash;
      else ok = await ownerLogin(user, pw);

      if (ok) {
        state.tries = 0;
        if (user === "guest") {
          state.view = "guest";
          print("Welcome to justryuz-shell (guest). Mode: " + state.modeName + " (" + modeN() + " level). Taip 'help'.", "sys");
          enterLevel(0);
        } else {
          state.view = "owner";
          state.user = user;
          await showMotd();
        }
        return;
      }
      state.tries++;
      if (state.tries >= 3) {
        print(user + "@" + host + ": Permission denied (publickey,password).", "err");
        return;
      }
      print("Permission denied, please try again.", "err");
      attempt(user, host);
    });
  }

  async function ownerLogin(user, pw) {
    if (!C.API_URL) { print("Auth server belum dikonfigurasi (CONFIG.API_URL kosong).", "err"); state.tries = 3; return false; }
    try {
      var r = await fetch(C.API_URL + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user, password: pw })
      });
      if (r.status === 429) { print("Too many attempts. Cuba lagi nanti.", "err"); state.tries = 3; return false; }
      var j = await r.json();
      if (r.ok && j.ok) { state.token = j.token; sessionStorage.setItem("jr_token", j.token); return true; }
    } catch (e) { print("ssh: connect to host " + C.host + " failed (network).", "err"); state.tries = 3; }
    return false;
  }

  async function showMotd() {
    print("Welcome, " + state.user + ".", "sys");
    try {
      var r = await fetch(C.API_URL + "/motd", { headers: { Authorization: "Bearer " + state.token } });
      var j = await r.json();
      if (r.ok && j.ok) print(j.motd);
    } catch (e) { /* motd is optional */ }
    print("Taip 'admin' untuk urus post, atau 'help'.", "dim");
  }

  /* ---------- owner (private) shell ---------- */
  async function ownerExec(line) {
    var t = tokenize(line);
    if (!t.length) return;
    switch (t[0]) {
      case "help": return print("Perintah: admin, whoami, id, uname, date, motd, clear, logout");
      case "admin": print("Membuka panel admin..."); location.href = "admin.html"; return;
      case "whoami": return print(state.user);
      case "id": return print("uid=1000(" + state.user + ") gid=1000(" + state.user + ") groups=1000(" + state.user + ")");
      case "uname": return print("Linux git 6.1.0-justryuz x86_64 GNU/Linux");
      case "date": return print(new Date().toString());
      case "motd": return showMotd();
      case "clear": out.textContent = ""; return;
      case "exit": case "logout":
        state.token = null; sessionStorage.removeItem("jr_token"); state.view = "local";
        return print("logout\nConnection to " + C.host + " closed.");
      default: print(t[0] + ": command not found", "err");
    }
  }

  /* ---------- input loop ---------- */
  async function submit() {
    var value = input.value;
    input.value = "";
    if (state.busy) return;

    if (state.ask) {
      var a = state.ask;
      echoCmd("", true);
      state.ask = null;
      state.busy = true;
      try { await a.done(value); } catch (e) { print(e.message, "err"); }
      state.busy = false;
      setPrompt();
      return;
    }

    echoCmd(value);
    var line = value.trim();
    if (line) { state.history.push(line); state.hIdx = state.history.length; }
    state.busy = true;
    try {
      if (state.view === "guest") await guestExec(line);
      else if (state.view === "owner") await ownerExec(line);
      else await localExec(line);
    } catch (e) { print(e.message, "err"); }
    state.busy = false;
    setPrompt();
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "ArrowUp" && !state.ask) {
      e.preventDefault();
      if (state.hIdx > 0) input.value = state.history[--state.hIdx];
    } else if (e.key === "ArrowDown" && !state.ask) {
      e.preventDefault();
      state.hIdx = Math.min(state.hIdx + 1, state.history.length);
      input.value = state.history[state.hIdx] || "";
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault(); out.textContent = "";
    } else if (e.key === "c" && e.ctrlKey && state.ask) {
      e.preventDefault(); state.ask = null; input.value = ""; print("^C"); setPrompt();
    }
  });
  screen.addEventListener("click", function () {
    if (!window.getSelection().toString()) input.focus();
  });

  /* ---------- boot ---------- */
  async function boot() {
    state.busy = true;
    var lines = [
      ["justryuz-shell 1.0 (tty1)", "dim"],
      ["[  OK  ] network up: " + C.host, "dim"],
      ["[  OK  ] sshd listening on :22", "dim"],
      ["", ""],
      ["Taip 'help' untuk mula. Cuba: ssh guest@" + C.host + "  (password: guest)", "sys"]
    ];
    for (var i = 0; i < lines.length; i++) {
      print(lines[i][0], lines[i][1]);
      if (!reduce) await sleep(180);
    }
    state.busy = false;
    setPrompt();
    input.focus();
  }
  setPrompt();
  boot();
})();
