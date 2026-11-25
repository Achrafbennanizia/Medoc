import "@fontsource/ibm-plex-serif/300.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./site.css";

// Mark the nav link for the current section.
const section = "/" + (location.pathname.split("/")[1] ?? "");
for (const a of document.querySelectorAll<HTMLAnchorElement>(".nav-links a")) {
  if (section !== "/" && a.pathname.startsWith(section)) a.setAttribute("aria-current", "page");
}
for (const el of document.querySelectorAll("[data-year]")) {
  el.textContent = String(new Date().getFullYear());
}
