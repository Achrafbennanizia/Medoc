// Apply theme and text direction before first paint (no flash). Loaded as a classic,
// blocking script so the company CSP (script-src 'self') allows it without 'unsafe-inline'.
(function () {
  var d = document.documentElement, t = null, l = null;
  // Preferences live in first-party cookies (see src/prefs.ts).
  var c = function (n) { var m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
  try { t = c("medoc_theme"); l = c("medoc_lang"); } catch (e) {}
  var q = new URLSearchParams(location.search).get("lang");
  if (q) l = q;
  if (t === "light" || t === "dark") d.dataset.theme = t;
  else if (matchMedia("(prefers-color-scheme: dark)").matches) d.dataset.theme = "dark";
  if (l === "ar") { d.lang = "ar"; d.dir = "rtl"; } else if (l === "en" || l === "fr") d.lang = l;
})();
