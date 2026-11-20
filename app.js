/* justryuz-shell :: renders nav, carousel, post tables, live search.
   All text is inserted with textContent (no innerHTML) to avoid XSS. */
(function () {
  "use strict";

  var S = window.SITE;

  /** Small helper: create element with optional class and text. */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ---------- carousel ---------- */
  var slideBox = document.getElementById("slide");
  var idx = 0;
  var timer;

  function showSlide(i) {
    idx = (i + S.slides.length) % S.slides.length;
    var s = S.slides[idx];
    slideBox.textContent = "";
    slideBox.appendChild(el("h3", "", "> " + s.title));
    var ol = el("ol");
    s.body.forEach(function (line) { ol.appendChild(el("li", "", line)); });
    slideBox.appendChild(ol);
    var chips = el("div", "chips");
    s.chips.forEach(function (c, n) {
      chips.appendChild(el("span", "chip" + (n % 2 ? " dark" : ""), c));
    });
    slideBox.appendChild(chips);
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(function () { showSlide(idx + 1); }, 6000);
  }

  document.getElementById("prev").addEventListener("click", function () { showSlide(idx - 1); restart(); });
  document.getElementById("next").addEventListener("click", function () { showSlide(idx + 1); restart(); });
  showSlide(0);
  restart();

  /* ---------- tables ---------- */
  var tables = document.getElementById("tables");

  function difficultyBar(level) {
    var bar = el("span", "bar");
    bar.title = "level " + level + "/5";
    for (var i = 1; i <= 5; i++) {
      bar.appendChild(el("i", i <= level ? "on l" + level : ""));
    }
    return bar;
  }

  function buildTable(group, query) {
    var rows = group.posts.filter(function (p) {
      if (!query) return true;
      var hay = (p.title + " " + p.type + " " + (p.platform || "") + " " + (p.tags || []).join(" ") + " " + p.date).toLowerCase();
      return hay.indexOf(query) !== -1;
    });
    if (!rows.length) return null;

    var wrap = el("section", "group");
    wrap.id = group.id;
    wrap.appendChild(el("div", "group-title", group.title));

    var table = el("table");
    var head = el("tr");
    ["date", "description", "type", "hits", "level", "author"].forEach(function (h, i) {
      var th = el("th", i === 2 || i === 3 ? "col-hide" : "", h);
      head.appendChild(th);
    });
    table.appendChild(head);

    rows.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", "", p.date));

      var d = el("td", "desc");
      var a = el("a", "", p.title);
      a.href = "post.html?p=" + encodeURIComponent(p.slug);
      d.appendChild(a);
      tr.appendChild(d);

      tr.appendChild(el("td", "tag col-hide", p.type));
      tr.appendChild(el("td", "muted col-hide", p.hits.toLocaleString("en-US")));

      var lv = el("td");
      lv.appendChild(difficultyBar(p.level));
      tr.appendChild(lv);

      tr.appendChild(el("td", "tag", "justryuz"));
      table.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function render(query) {
    tables.textContent = "";
    var shown = 0;
    S.groups.forEach(function (g) {
      var t = buildTable(g, query);
      if (t) { tables.appendChild(t); shown += t.querySelectorAll("tr").length - 1; }
    });
    if (!shown) tables.appendChild(el("p", "empty", "Tiada hasil."));
    return shown;
  }

  var total = S.groups.reduce(function (n, g) { return n + g.posts.length; }, 0);
  document.getElementById("post-count").textContent = total;
  /* ---------- search ---------- */
  var q = document.getElementById("q");
  var initial = new URLSearchParams(location.search).get("q") || "";
  q.value = initial;
  render(initial.trim().toLowerCase());
  q.addEventListener("input", function () { render(q.value.trim().toLowerCase()); });
  document.getElementById("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    render(q.value.trim().toLowerCase());
  });
  document.getElementById("clear").addEventListener("click", function (e) {
    e.preventDefault();
    q.value = "";
    render("");
  });

  /* ---------- footer clock ---------- */
  var clock = document.getElementById("clock");
  function tick() { clock.textContent = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
  tick();
  setInterval(tick, 1000);
})();
