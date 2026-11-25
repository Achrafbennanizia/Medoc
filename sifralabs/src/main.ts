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

/* ---------- command menu ---------- */
const dialog = document.querySelector<HTMLDialogElement>("dialog.cmdk");
if (dialog) {
  const input = dialog.querySelector("input")!;
  const items = [...dialog.querySelectorAll<HTMLLIElement>(".cmdk-list li")];
  const empty = dialog.querySelector<HTMLElement>(".cmdk-empty")!;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  for (const el of document.querySelectorAll("[data-mod]")) el.textContent = isMac ? "⌘" : "Ctrl";

  const visible = () => items.filter((li) => !li.hidden).map((li) => li.querySelector("a")!);
  const open = () => {
    if (dialog.open) return;
    input.value = "";
    filter();
    dialog.showModal();
    input.focus();
  };
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    for (const li of items) li.hidden = !!q && !li.textContent!.toLowerCase().includes(q);
    empty.hidden = visible().length > 0;
  };

  input.addEventListener("input", filter);
  for (const b of document.querySelectorAll("[data-cmdk-open]")) b.addEventListener("click", open);
  // A click on the backdrop (outside the panel) closes the menu.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (e) => {
    const links = visible();
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % links.length : i <= 0 ? links.length - 1 : i - 1;
      links[next]?.focus();
    } else if (e.key === "Enter" && document.activeElement === input) {
      e.preventDefault();
      links[0]?.click();
    }
  });
  addEventListener("keydown", (e) => {
    const typing = e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]");
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      open();
    }
  });
}

/* ---------- contact form: prepares a structured e-mail in the visitor's own mail app ---------- */
for (const form of document.querySelectorAll<HTMLFormElement>("form.mail-form")) {
  const to = form.dataset.to!;
  const status = form.querySelector<HTMLElement>(".mail-sent")!;
  const copyBtn = form.querySelector<HTMLButtonElement>("[data-copy]")!;
  let prepared = "";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const line = (label: string, value: string) => `${label}: ${value || "–"}`;
    // Default subject: topic and organisation, so the inbox shows what and who at a glance.
    const subject = ["Sifra Labs", v("topic"), v("org")].filter(Boolean).join(" · ");
    const body = [
      "Hello Sifra Labs team,",
      "",
      `I'm writing about: ${v("topic")}.`,
      "",
      "— Contact —",
      line("Name", v("name")),
      line("Organisation", v("org")),
      line("E-mail", v("email")),
      line("Phone", v("phone")),
      "",
      "— Message —",
      v("message"),
      "",
      `Sent from sifralabs.com on ${new Date().toLocaleDateString("en-GB")}`,
      "",
      "Best regards,",
      v("name"),
    ].join("\n");
    prepared = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    status.hidden = false;
    copyBtn.textContent = "Copy the e-mail";
    location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prepared);
      copyBtn.textContent = "Copied";
    } catch {
      copyBtn.textContent = "Copy failed: write to contact@sifralabs.com";
    }
  });
}
