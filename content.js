/* Loads posts for public pages.
   - Seed posts come from data.js (works with no backend).
   - When CONFIG.API_URL is set and the admin has initialized the store,
     the posts from the Worker (Cloudflare KV) replace the seed list.
   Pages wait on window.SITE_READY before rendering. */
(function () {
  "use strict";

  var S = window.SITE;
  var API = window.CONFIG && window.CONFIG.API_URL;

  /** Group a flat post list into the groups defined in data.js (same order/titles). */
  function regroup(posts) {
    var defs = S.groups.map(function (g) { return { id: g.id, title: g.title, posts: [] }; });
    posts.forEach(function (p) {
      var g = defs.filter(function (d) { return d.id === p.group; })[0] || defs[0];
      g.posts.push(p);
    });
    defs.forEach(function (g) {
      g.posts.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    });
    return defs;
  }

  window.SITE_READY = (async function () {
    if (!API) return;
    try {
      var ctl = new AbortController();
      var timer = setTimeout(function () { ctl.abort(); }, 4000);
      var r = await fetch(API + "/posts", { signal: ctl.signal });
      clearTimeout(timer);
      var j = await r.json();
      if (r.ok && j.ok && j.initialized) S.groups = regroup(j.posts);
    } catch (e) { /* offline or Worker down: keep the seed posts from data.js */ }
  })();
})();
