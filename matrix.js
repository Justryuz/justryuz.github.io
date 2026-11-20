/* Matrix effect for the header:
   1) falling characters on a <canvas> behind the header content
   2) the logo text decodes from random glyphs into the real word (and re-scrambles now and then)
   Respects prefers-reduced-motion. */
(function () {
  "use strict";

  var header = document.querySelector(".header");
  var logo = document.querySelector(".logo-text");
  if (!header || !logo) return;

  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789:.=*+-<>";

  function rnd() { return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length)); }

  /* ---------- 1) rain ---------- */
  var canvas = document.createElement("canvas");
  canvas.className = "matrix-bg";
  canvas.setAttribute("aria-hidden", "true");
  header.insertBefore(canvas, header.firstChild);
  var ctx = canvas.getContext("2d");
  var size = 14, cols, drops, w, h;

  function resize() {
    var r = header.getBoundingClientRect();
    w = canvas.width = Math.floor(r.width);
    h = canvas.height = Math.floor(r.height);
    cols = Math.ceil(w / size);
    drops = [];
    for (var i = 0; i < cols; i++) drops[i] = Math.random() * -30;
  }

  function frame() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.09)";   // fade trail
    ctx.fillRect(0, 0, w, h);
    ctx.font = size + "px monospace";
    for (var i = 0; i < cols; i++) {
      var y = drops[i] * size;
      ctx.fillStyle = Math.random() > 0.96 ? "#d8ffd8" : "#1fbf1f";
      ctx.fillText(rnd(), i * size, y);
      if (y > h && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.6;
    }
  }

  resize();
  window.addEventListener("resize", resize);
  if (reduce) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); }
  else setInterval(frame, 50);

  /* ---------- 2) decoding logo text ---------- */
  var word = logo.textContent;
  var running = false;

  function decode() {
    if (running) return;
    running = true;
    var step = 0, total = word.length * 6;
    var t = setInterval(function () {
      var settled = Math.floor(step / 6);
      var s = "";
      for (var i = 0; i < word.length; i++) s += i < settled ? word.charAt(i) : rnd();
      logo.textContent = s;
      if (++step > total) {
        clearInterval(t);
        logo.textContent = word;
        running = false;
      }
    }, 60);
  }

  if (!reduce) {
    decode();
    setInterval(decode, 9000);
    logo.addEventListener("mouseenter", decode);
  }
})();
