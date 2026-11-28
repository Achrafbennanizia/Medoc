import "@fontsource/ibm-plex-serif/300.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-mono/400.css";
// Styles, in cascade order: base site rules, then the components added in the 2026-11 rebuild.
import "./styles/01-tokens-base-nav.css";
import "./styles/02-sections-status.css";
import "./styles/03-subpages-products-security.css";
import "./styles/04-hero-figures.css";
import "./styles/05-paths-cta-photo.css";
import "./styles/06-cmdk-details-form.css";
import "./styles/07-advantages-brand-hero.css";
import "./styles/08-steps-news.css";
import "./styles/09-hero-tech-stack-pillars.css";
import "./styles/10-timeline-packages-values.css";
import "./styles/11-articles-final-cta.css";

// Mark the nav link for the current section.
// Strip the deploy base (/Medoc/ on GitHub Pages) and the language prefix before comparing.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const local = (path: string) => (path.startsWith(`${base}/`) ? path.slice(base.length) : path).replace(/^\/(fr|ar)(?=\/)/, "");
const section = "/" + (local(location.pathname).split("/")[1] ?? "");
for (const a of document.querySelectorAll<HTMLAnchorElement>(".nav-links a")) {
  if (section !== "/" && local(a.pathname).startsWith(section)) a.setAttribute("aria-current", "page");
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

/* ---------- contact form: Turnstile → Worker → CONTACT_TO; mailto only if API is unreachable ---------- */
const UI = {
  en: {
    sent: "Thank you. Your message is on its way to our team. We reply within 24 hours on working days.",
    fallback: "We couldn't send it from the website just now, so your e-mail app is opening with the message ready: press Send there. Nothing opened? Copy the e-mail and send it to contact@sifralabs.com.",
    needCheck: "Complete the security check above, then press Send again.",
    rate: "Too many tries from this network. Wait about an hour, then try again — or write to contact@sifralabs.com.",
    blocked: "The form could not be sent (security check). Refresh the page, complete the check, and try once more.",
    sending: "Sending…", send: "Send message", copy: "Copy the e-mail", copied: "Copied", copyFailed: "Copy failed: write to contact@sifralabs.com",
  },
  fr: {
    sent: "Merci. Votre message est en route vers notre équipe. Nous répondons sous 24 heures, jours ouvrés.",
    fallback: "L'envoi depuis le site n'a pas abouti : votre messagerie s'ouvre avec le message prêt, cliquez sur Envoyer. Rien ne s'est ouvert ? Copiez l'e-mail et envoyez-le à contact@sifralabs.com.",
    needCheck: "Terminez le contrôle de sécurité ci-dessus, puis renvoyez.",
    rate: "Trop d'essais depuis ce réseau. Attendez environ une heure, puis réessayez — ou écrivez à contact@sifralabs.com.",
    blocked: "Envoi bloqué (contrôle de sécurité). Rechargez la page, validez le contrôle, puis réessayez une fois.",
    sending: "Envoi…", send: "Envoyer le message", copy: "Copier l'e-mail", copied: "Copié", copyFailed: "Copie impossible : écrivez à contact@sifralabs.com",
  },
  ar: {
    sent: "شكرًا. رسالتكم في طريقها إلى فريقنا. نردّ خلال 24 ساعة في أيام العمل.",
    fallback: "تعذّر الإرسال من الموقع الآن، لذلك يُفتح تطبيق البريد لديكم والرسالة جاهزة: اضغطوا إرسال. لم يُفتح شيء؟ انسخوا الرسالة وأرسلوها إلى contact@sifralabs.com.",
    needCheck: "أكملوا التحقق الأمني أعلاه ثم اضغطوا إرسال مرة أخرى.",
    rate: "محاولات كثيرة من هذه الشبكة. انتظروا حوالي ساعة ثم أعيدوا المحاولة — أو راسلوا contact@sifralabs.com.",
    blocked: "تعذّر الإرسال (التحقق الأمني). حدّثوا الصفحة، أكملوا التحقق، ثم حاولوا مرة واحدة.",
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
  let key = crypto.randomUUID();
  let prepared = "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    // Widget may sit outside FormData's reach; read the hidden input directly.
    const turnstile =
      (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value?.trim() ||
      "";
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

    status.hidden = false;
    copyBtn.hidden = true;
    if (!turnstile) {
      msg.textContent = ui.needCheck;
      return;
    }

    submit.disabled = true;
    submit.textContent = ui.sending;
    // Worker silently drops (200 pending) if elapsed < 4000 — wait so a fast fill still delivers.
    let elapsed = Date.now() - shownAt;
    if (elapsed < 4000) {
      await new Promise((r) => setTimeout(r, 4000 - elapsed));
      elapsed = Date.now() - shownAt;
    }
    let ok = false;
    let err = "";
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          form: "sifra", name: v("name"), email: v("email"), phone: v("phone"), org: v("org"),
          topic: v("topic"), message: v("message"), lang: document.documentElement.lang, country: "",
          website: v("website"), elapsed, turnstile,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      ok = res.ok && data.ok === true;
      err = data.error ?? "";
    } catch {
      ok = false;
      err = "network";
    }
    submit.disabled = false;
    submit.textContent = ui.send;
    if (ok) {
      msg.textContent = ui.sent;
      form.reset();
      key = crypto.randomUUID();
      const w = window as Window & { turnstile?: { reset: () => void } };
      w.turnstile?.reset();
    } else if (err === "turnstile" || err === "origin") {
      // Do not mailto — retries would also burn the IP rate limit.
      msg.textContent = ui.blocked;
      const w = window as Window & { turnstile?: { reset: () => void } };
      w.turnstile?.reset();
    } else if (err === "rate") {
      msg.textContent = ui.rate;
    } else if (err === "network" || err === "send") {
      msg.textContent = ui.fallback;
      copyBtn.hidden = false;
      copyBtn.textContent = ui.copy;
      location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      msg.textContent = ui.fallback;
      copyBtn.hidden = false;
      copyBtn.textContent = ui.copy;
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
