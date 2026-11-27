import "@fontsource/ibm-plex-serif/300.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./site.css";
import "./components.css";

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

/* ---------- contact form: sends through /api/contact; falls back to the visitor's mail app ---------- */
// Form messages in the page's language (pages are generated per language from i18n/*.json).
const UI = {
  en: {
    sent: "Thank you. Your message is on its way to contact@sifralabs.com, and we reply within 24 hours on working days.",
    fallback: "We couldn't send it from the website just now, so your e-mail app is opening with the message ready: press Send there. Nothing opened? Copy the e-mail and send it to contact@sifralabs.com.",
    sending: "Sending…", send: "Send message", copy: "Copy the e-mail", copied: "Copied", copyFailed: "Copy failed: write to contact@sifralabs.com",
  },
  fr: {
    sent: "Merci. Votre message est en route vers contact@sifralabs.com, et nous répondons sous 24 heures, jours ouvrés.",
    fallback: "L'envoi depuis le site n'a pas abouti : votre messagerie s'ouvre avec le message prêt, cliquez sur Envoyer. Rien ne s'est ouvert ? Copiez l'e-mail et envoyez-le à contact@sifralabs.com.",
    sending: "Envoi…", send: "Envoyer le message", copy: "Copier l'e-mail", copied: "Copié", copyFailed: "Copie impossible : écrivez à contact@sifralabs.com",
  },
  ar: {
    sent: "شكرًا. رسالتكم في طريقها إلى contact@sifralabs.com، وسنرد خلال 24 ساعة في أيام العمل.",
    fallback: "تعذّر الإرسال من الموقع الآن، لذلك يُفتح تطبيق البريد لديكم والرسالة جاهزة: اضغطوا إرسال. لم يُفتح شيء؟ انسخوا الرسالة وأرسلوها إلى contact@sifralabs.com.",
    sending: "جارٍ الإرسال…", send: "إرسال الرسالة", copy: "نسخ الرسالة", copied: "تم النسخ", copyFailed: "تعذّر النسخ: راسلونا على contact@sifralabs.com",
  },
};
const ui = UI[(document.documentElement.lang as keyof typeof UI) || "en"] ?? UI.en;

for (const form of document.querySelectorAll<HTMLFormElement>("form.mail-form")) {
  const to = form.dataset.to!;
  const api = form.dataset.api!;
  const status = form.querySelector<HTMLElement>(".mail-sent")!;
  const msg = status.querySelector<HTMLElement>("[data-msg]")!;
  const copyBtn = form.querySelector<HTMLButtonElement>("[data-copy]")!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const shownAt = Date.now();
  // One key per message: a double click or a retry is delivered once (the Worker remembers it for 10 minutes).
  let key = crypto.randomUUID();
  let prepared = "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const subject = ["Sifra Labs", v("topic"), v("org")].filter(Boolean).join(" · ");
    const line = (label: string, value: string) => `${label}: ${value || "–"}`;
    const body = [
      "Hello Sifra Labs team,", "",
      `I'm writing about: ${v("topic")}.`, "",
      "— Contact —", line("Name", v("name")), line("Organisation", v("org")), line("E-mail", v("email")), line("Phone", v("phone")), "",
      "— Message —", v("message"), "",
      `Sent from sifralabs.com on ${new Date().toLocaleDateString("en-GB")}`, "",
      "Best regards,", v("name"),
    ].join("\n");
    prepared = `To: ${to}\nSubject: ${subject}\n\n${body}`;

    submit.disabled = true;
    submit.textContent = ui.sending;
    let ok = false;
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          form: "sifra", name: v("name"), email: v("email"), phone: v("phone"), org: v("org"),
          topic: v("topic"), message: v("message"), lang: document.documentElement.lang, country: "",
          website: v("website"), elapsed: Date.now() - shownAt,
        }),
      });
      ok = res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
    } catch {
      ok = false;
    }
    submit.disabled = false;
    submit.textContent = ui.send;
    status.hidden = false;
    if (ok) {
      msg.textContent = ui.sent;
      copyBtn.hidden = true;
      form.reset();
      key = crypto.randomUUID();
    } else {
      msg.textContent = ui.fallback;
      copyBtn.hidden = false;
      copyBtn.textContent = ui.copy;
      location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prepared);
      copyBtn.textContent = ui.copied;
    } catch {
      copyBtn.textContent = ui.copyFailed;
    }
  });
}
