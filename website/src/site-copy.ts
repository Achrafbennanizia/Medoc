import type { Lang } from "./i18n";
import type { LegalDocId } from "./legal/types";

/** Copy for What's new, the gallery of Moroccan documents, the legal pages and the cookie notice. */
type News = { date: string; title: string; text: string; href: string };
type Doc = { file: string; title: string; caption: string };

export type SiteCopy = {
  news: { title: string; lead: string; items: News[] };
  docs: {
    title: string;
    lead: string;
    sample: string;
    download: string;
    close: string;
    prev: string;
    next: string;
    items: Doc[];
  };
  legal: {
    contents: string;
    updated: string;
    back: string;
    titles: Record<LegalDocId, string>;
  };
  moreShots: (n: number) => string;
  looks: { title: string; lead: string; light: string; dark: string; accents: Record<"mint" | "ocean" | "plum" | "rose" | "amber", string>; caption: string };
  mobileDemo: string;
  /** The cookie notice: the site only sets the language, theme and notice cookies (src/prefs.ts). */
  cookie: { text: string; ok: string; more: string };
};

const DOC_FILES = {
  invFr: "ma-01-facture-fr",
  invAr: "ma-02-facture-ar",
  creditAr: "ma-03-avoir-ar",
  rxFr: "ma-04-ordonnance-fr",
  rxAr: "ma-05-ordonnance-ar",
  certFr: "ma-06-certificat-fr",
  certAr: "ma-07-certificat-ar",
};

export const SITE_COPY: Record<Lang, SiteCopy> = {
  fr: {
    news: {
      title: "Nouveautés",
      lead: "Ce qui a changé dans MeDoc Dentist ce mois-ci.",
      items: [
        { date: "2026-11-23", title: "Sauvegardes automatiques, plus petites", text: "Une sauvegarde chiffrée par jour, à moins d'un tiers de la taille de la base dans nos tests. Les 3 derniers jours, une de la semaine dernière et une du dernier semestre sont gardées. Pause, restauration et suppression dans Réglages, avec un motif.", href: "#settings" },
        { date: "2026-11-20", title: "Facture marocaine en français et en arabe", text: "ICE, IF, TP, RC, CNSS et INPE, total en toutes lettres et mention d'exonération de TVA (art. 91 CGI).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Ordonnances et certificats en arabe", text: "Mise en page de droite à gauche, dates au format 14/06/1990, adresses latines lisibles.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "Examen complet", text: "Plusieurs statuts par dent (couronne et carie), schéma mis à jour en direct, PSI par sextant, saignement, plaque, ATM, imagerie.", href: "#clinical" },
        { date: "2026-11-16", title: "Page Conformité", text: "État en direct des sauvegardes et du journal, liste de contrôle loi 09-08 avec qui a coché quoi et quand.", href: "#trust" },
        { date: "2026-11-12", title: "Allergies signalées sur l'ordonnance", text: "MeDoc Dentist signale un médicament qui correspond à une allergie déjà notée dans l'anamnèse.", href: "#papers" },
      ],
    },
    docs: {
      title: "Les documents que MeDoc Dentist imprime",
      lead: "Exemples réels sortis du logiciel, au format marocain : ICE, IF et INPE, mentions légales, en français ou en arabe. Patients et cabinets fictifs.",
      sample: "Exemple, données fictives",
      download: "Télécharger le PDF",
      close: "Fermer",
      prev: "Précédent",
      next: "Suivant",
      items: [
        { file: DOC_FILES.invFr, title: "Facture", caption: "Mentions de l'art. 145 CGI, total en lettres, exonération de TVA." },
        { file: DOC_FILES.invAr, title: "Facture en arabe", caption: "La même facture, de droite à gauche, montants alignés." },
        { file: DOC_FILES.creditAr, title: "Avoir", caption: "Une facture n'est jamais effacée : l'avoir l'annule et la cite." },
        { file: DOC_FILES.rxFr, title: "Ordonnance", caption: "Médicament, forme, quantité, posologie et durée, avec numéro." },
        { file: DOC_FILES.rxAr, title: "Ordonnance en arabe", caption: "Noms des médicaments en caractères latins, le reste en arabe." },
        { file: DOC_FILES.certFr, title: "Certificat d'arrêt de travail", caption: "Identité du patient reprise du dossier, jamais retapée." },
        { file: DOC_FILES.certAr, title: "Certificat en arabe", caption: "Mention du secret professionnel et de la loi 09-08 en pied de page." },
      ],
    },
    legal: {
      contents: "Sommaire",
      updated: "Mis à jour le",
      back: "Retour au site",
      titles: { "legal-notice": "Mentions légales", "privacy-notice": "Avis de confidentialité", "privacy-policy": "Politique de confidentialité", terms: "Conditions générales de vente" },
    },
    looks: {
      title: "Votre cabinet, vos couleurs",
      lead: "Clair, sombre, ou comme l'ordinateur, et cinq couleurs d'accent. Chaque poste garde son réglage. Le site suit aussi votre thème : passez-le en sombre pour voir les écrans en sombre.",
      light: "Clair",
      dark: "Sombre",
      accents: { mint: "Menthe", ocean: "Océan", plum: "Prune", rose: "Rose", amber: "Ambre" },
      caption: "Le même tableau de bord, données fictives.",
    },
    moreShots: (n) => `Voir ${n} autre${n > 1 ? "s" : ""} écran${n > 1 ? "s" : ""}`,
    mobileDemo: "Réserver une démo",
    cookie: {
      text: "Ce site n'utilise que des cookies nécessaires : ils retiennent votre langue et votre thème quand vous les choisissez, et que vous avez fermé ce message. Aucune mesure d'audience, aucun traceur.",
      ok: "Compris",
      more: "En savoir plus",
    },
  },
  ar: {
    news: {
      title: "الجديد",
      lead: "ما تغيّر في MeDoc Dentist هذا الشهر.",
      items: [
        { date: "2026-11-23", title: "نسخ احتياطية تلقائية وأصغر", text: "نسخة مشفّرة كل يوم، بأقل من ثلث حجم قاعدة البيانات في اختباراتنا. يُحتفظ بآخر 3 أيام، ونسخة من الأسبوع الماضي، ونسخة من آخر نصف سنة. الإيقاف والاستعادة والحذف من الإعدادات، مع سبب.", href: "#settings" },
        { date: "2026-11-20", title: "فاتورة مغربية بالفرنسية والعربية", text: "ICE وIF وTP وRC وCNSS وINPE، المبلغ بالحروف، وإشارة الإعفاء من الضريبة على القيمة المضافة (المادة 91).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "وصفات وشهادات بالعربية", text: "تخطيط من اليمين إلى اليسار، تواريخ بصيغة 14/06/1990، وعناوين لاتينية مقروءة.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "فحص كامل", text: "عدة حالات للسن الواحدة (تاج وتسوّس)، مخطط يتحدّث مباشرة، PSI لكل سدس، نزيف، لويحة، المفصل الصدغي الفكي، والتصوير.", href: "#clinical" },
        { date: "2026-11-16", title: "صفحة المطابقة", text: "حالة النسخ الاحتياطية والسجل مباشرة، وقائمة مراجعة القانون 09-08 مع من أشّر على ماذا ومتى.", href: "#trust" },
        { date: "2026-11-12", title: "تنبيه الحساسية في الوصفة", text: "ينبّه MeDoc Dentist إلى دواء يطابق حساسية مسجّلة سابقًا في السوابق المرضية.", href: "#papers" },
      ],
    },
    docs: {
      title: "الوثائق التي يطبعها MeDoc Dentist",
      lead: "أمثلة حقيقية خرجت من البرنامج، بالصيغة المغربية: ICE وIF وINPE والبيانات القانونية، بالعربية أو الفرنسية. المرضى والعيادات وهميّون.",
      sample: "مثال، بيانات وهمية",
      download: "تنزيل PDF",
      close: "إغلاق",
      prev: "السابق",
      next: "التالي",
      items: [
        { file: DOC_FILES.invAr, title: "فاتورة بالعربية", caption: "البيانات المنصوص عليها في المادة 145، المبلغ بالحروف، الإعفاء من الضريبة." },
        { file: DOC_FILES.invFr, title: "فاتورة بالفرنسية", caption: "نفس الفاتورة بالفرنسية." },
        { file: DOC_FILES.creditAr, title: "فاتورة تصحيحية", caption: "لا تُحذف الفاتورة أبدًا: الفاتورة التصحيحية تلغيها وتذكر رقمها." },
        { file: DOC_FILES.rxAr, title: "وصفة طبية", caption: "أسماء الأدوية بالحروف اللاتينية، والباقي بالعربية." },
        { file: DOC_FILES.rxFr, title: "وصفة بالفرنسية", caption: "الدواء، الشكل، الكمية، طريقة الاستعمال والمدة، مع رقم." },
        { file: DOC_FILES.certAr, title: "شهادة التوقف عن العمل", caption: "هوية المريض مأخوذة من الملف، لا تُكتب من جديد." },
        { file: DOC_FILES.certFr, title: "شهادة بالفرنسية", caption: "نفس الشهادة بالفرنسية." },
      ],
    },
    legal: {
      contents: "المحتويات",
      updated: "آخر تحديث",
      back: "العودة إلى الموقع",
      titles: { "legal-notice": "البيانات القانونية", "privacy-notice": "إشعار الخصوصية", "privacy-policy": "سياسة الخصوصية", terms: "الشروط العامة للبيع" },
    },
    looks: {
      title: "عيادتك بألوانك",
      lead: "فاتح أو داكن أو حسب الحاسوب، وخمسة ألوان مميزة. كل جهاز يحتفظ بإعداده. الموقع يتبع مظهرك أيضًا: اجعله داكنًا لترى الشاشات داكنة.",
      light: "فاتح",
      dark: "داكن",
      accents: { mint: "نعناعي", ocean: "محيطي", plum: "برقوقي", rose: "وردي", amber: "كهرماني" },
      caption: "لوحة التحكم نفسها، ببيانات وهمية.",
    },
    moreShots: (n) => `عرض ${n} شاشات أخرى`,
    mobileDemo: "احجز عرضًا",
    cookie: {
      text: "لا يستعمل هذا الموقع سوى ملفات تعريف الارتباط الضرورية: تحفظ لغتك ومظهرك حين تختارهما، وأنك أغلقت هذا الإشعار. لا قياس للجمهور ولا تتبع.",
      ok: "فهمت",
      more: "اعرف المزيد",
    },
  },
  en: {
    news: {
      title: "What's new",
      lead: "What changed in MeDoc Dentist this month.",
      items: [
        { date: "2026-11-23", title: "Automatic backups, much smaller", text: "One encrypted backup a day, under a third of the database size in our tests. The last 3 days, one from last week and one from the last half-year are kept. Pause, restore and delete in Settings, each with a reason.", href: "#settings" },
        { date: "2026-11-20", title: "Moroccan invoice in French and Arabic", text: "ICE, IF, TP, RC, CNSS and INPE, amount in words and the VAT-exemption note (CGI art. 91).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Prescriptions and certificates in Arabic", text: "Right-to-left layout, dates as 14/06/1990, Latin addresses kept readable.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "Full examination", text: "Several statuses per tooth (crown and caries), live chart, PSI per sextant, bleeding, plaque, TMJ, imaging.", href: "#clinical" },
        { date: "2026-11-16", title: "Compliance page", text: "Live state of backups and the audit log, plus a Law 09-08 checklist that records who ticked what, and when.", href: "#trust" },
        { date: "2026-11-12", title: "Allergies flagged on prescriptions", text: "MeDoc Dentist flags a drug that matches an allergy already noted in the medical history.", href: "#papers" },
      ],
    },
    docs: {
      title: "The documents MeDoc Dentist prints",
      lead: "Real output from the software, in the Moroccan format: ICE, IF and INPE, legal wording, in French or Arabic. Patients and practices are fictitious.",
      sample: "Sample, fictitious data",
      download: "Download the PDF",
      close: "Close",
      prev: "Previous",
      next: "Next",
      items: [
        { file: DOC_FILES.invFr, title: "Invoice (French)", caption: "The mentions required by CGI art. 145, amount in words, VAT exemption." },
        { file: DOC_FILES.invAr, title: "Invoice (Arabic)", caption: "The same invoice, right to left, amounts aligned." },
        { file: DOC_FILES.creditAr, title: "Credit note", caption: "An invoice is never deleted: the credit note cancels it and quotes it." },
        { file: DOC_FILES.rxFr, title: "Prescription", caption: "Drug, form, quantity, dosage and duration, with a number." },
        { file: DOC_FILES.rxAr, title: "Prescription (Arabic)", caption: "Drug names in Latin script, the rest in Arabic." },
        { file: DOC_FILES.certFr, title: "Sick-leave certificate", caption: "Patient identity comes from the record, never retyped." },
        { file: DOC_FILES.certAr, title: "Certificate (Arabic)", caption: "Professional secrecy and Law 09-08 in the footer." },
      ],
    },
    legal: {
      contents: "Contents",
      updated: "Last updated",
      back: "Back to the site",
      titles: { "legal-notice": "Legal notice", "privacy-notice": "Privacy notice", "privacy-policy": "Privacy policy", terms: "Terms of sale" },
    },
    looks: {
      title: "Your practice, your colours",
      lead: "Light, dark, or follow the computer, and five accent colours. Each workstation keeps its own setting. This site follows your theme too: switch it to dark to see the screens in dark.",
      light: "Light",
      dark: "Dark",
      accents: { mint: "Mint", ocean: "Ocean", plum: "Plum", rose: "Rose", amber: "Amber" },
      caption: "The same dashboard, fictitious data.",
    },
    moreShots: (n) => `Show ${n} more screen${n > 1 ? "s" : ""}`,
    mobileDemo: "Book a demo",
    cookie: {
      text: "This site only uses necessary cookies: they remember your language and theme when you choose them, and that you closed this notice. No analytics, no tracking.",
      ok: "Got it",
      more: "Learn more",
    },
  },
};
