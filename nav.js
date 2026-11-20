/* Shared top navigation (used by every page). Needs data.js loaded first. */
(function () {
  "use strict";
  var ul = document.getElementById("nav-links");
  if (!ul || !window.SITE) return;
  window.SITE.nav.forEach(function (n) {
    var li = document.createElement("li");
    if (n.hot) li.className = "hot";
    var a = document.createElement("a");
    a.textContent = n.label;
    a.href = n.href;
    li.appendChild(a);
    ul.appendChild(li);
  });
})();
