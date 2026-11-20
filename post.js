/* Renders one article page from data.js. Plain text only (textContent). */
window.SITE_READY.then(function () {
  "use strict";

  var S = window.SITE;
  var root = document.getElementById("post");

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function link(text, href, cls) {
    var a = el("a", cls || "", text);
    a.href = href;
    return a;
  }

  /* find post by slug */
  var slug = new URLSearchParams(location.search).get("p");
  var found = null, group = null;
  S.groups.forEach(function (g) {
    g.posts.forEach(function (p) { if (p.slug === slug) { found = p; group = g; } });
  });

  if (!found) {
    document.title = "justryuz :: not found";
    var nf = el("div", "box notfound");
    nf.appendChild(el("h2", "", "404 :: post tidak dijumpai"));
    nf.appendChild(link("kembali ke senarai", "index.html"));
    root.appendChild(nf);
    return;
  }
  document.title = "justryuz :: " + found.title;

  /* ---------- top row: status | meta | links ---------- */
  var top = el("section", "post-top");

  var status = el("table", "mini");
  [["Verified", "\u2713 Verified"], ["Warnings", "\u2713 0"], ["Rating", "\u25B2 0   \u25BC 0"]].forEach(function (r) {
    var tr = el("tr");
    tr.appendChild(el("th", "", r[0]));
    tr.appendChild(el("td", "ok", r[1]));
    status.appendChild(tr);
  });
  top.appendChild(status);

  var mid = el("div", "post-mid");
  var words = (found.body || []).reduce(function (n, b) { return n + b.x.split(/\s+/).length; }, 0);
  mid.appendChild(el("div", "readtime", Math.max(1, Math.round(words / 180)) + " min read"));
  var copy = el("button", "bigbtn", "Copy link");
  copy.type = "button";
  copy.addEventListener("click", function () {
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { copy.textContent = "Copied!"; });
  });
  mid.appendChild(copy);
  top.appendChild(mid);

  var links = el("ul", "side-links");
  [["How to ssh login?", "login.html"], ["Back to " + group.title, "index.html#" + group.id],
   ["Contact author", "mailto:" + S.author.email]].forEach(function (l) {
    var li = el("li");
    li.appendChild(link(l[0], l[1]));
    links.appendChild(li);
  });
  top.appendChild(links);
  root.appendChild(top);

  /* ---------- detailed information ---------- */
  root.appendChild(el("div", "sec-title", "Detailed Information"));
  var info = el("table", "info");

  function row(label, node) {
    var tr = el("tr");
    tr.appendChild(el("th", "", label));
    var td = el("td");
    if (typeof node === "string") td.textContent = node; else td.appendChild(node);
    tr.appendChild(td);
    info.appendChild(tr);
    return td;
  }

  row("Full title", found.title);
  row("Date add", found.date).className = "g";
  row("Category", link(found.type, "index.html?q=" + encodeURIComponent(found.type)));
  row("Platform", link(found.platform || "-", "index.html?q=" + encodeURIComponent(found.platform || "")));

  var bar = el("span", "bar");
  for (var i = 1; i <= 5; i++) bar.appendChild(el("i", i <= found.level ? "on l" + found.level : ""));
  row("Level", bar);

  /* description / body */
  var desc = el("div", "desc-body");
  var blocks = found.body && found.body.length ? found.body : [{ t: "p", x: found.summary || "" }];
  blocks.forEach(function (b) {
    if (b.t === "code") desc.appendChild(el("pre", "code", b.x));
    else if (b.t === "h") desc.appendChild(el("h4", "", b.x));
    else desc.appendChild(el("p", "", b.x));
  });
  row("Description", desc);

  if (found.ref) row("Reference", found.ref);
  row("Tested on", found.tested || "-");

  var tagBox = el("span");
  (found.tags || []).forEach(function (t, n) {
    if (n) tagBox.appendChild(document.createTextNode(",  "));
    tagBox.appendChild(link(t, "index.html?q=" + encodeURIComponent(t)));
  });
  row("Tags", tagBox);
  row("Comments", "0");
  row("Views", String(found.hits));
  root.appendChild(info);

  /* ---------- about author ---------- */
  root.appendChild(el("div", "sec-title", "About author"));
  var au = el("table", "info");
  var count = S.groups.reduce(function (n, g) { return n + g.posts.length; }, 0);
  [["Author", S.author.name], ["Level", S.author.level], ["Warnings", "\u2713 0"], ["Posts", String(count)], ["Contact", S.author.email]]
    .forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("th", "", r[0]));
      tr.appendChild(el("td", r[0] === "Author" ? "g" : "", r[1]));
      au.appendChild(tr);
    });
  root.appendChild(au);
});
