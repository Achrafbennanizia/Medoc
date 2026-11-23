import type { Lang } from "./i18n";
import type { LegalDocId } from "./legal/types";

/** Copy for the sections added in November 2026: What's new, the documents gallery, the legal pages. */
type News = { date: string; title: string; text: string; href: string };
type Country = "MA" | "FR" | "DE";
type Doc = { file: string; title: string; caption: string; lang: "fr" | "ar" | "de"; country: Country };

export type SiteCopy = {
  news: { title: string; lead: string; items: News[] };
  docs: {
    title: string;
    lead: string;
    sample: string;
    countries: Record<Country, string>;
    open: string;
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
};

const DOC_FILES = {
  invFr: "ma-01-facture-fr",
  invAr: "ma-02-facture-ar",
  creditAr: "ma-03-avoir-ar",
  rxFr: "ma-04-ordonnance-fr",
  rxAr: "ma-05-ordonnance-ar",
  certFr: "ma-06-certificat-fr",
  certAr: "ma-07-certificat-ar",
  frInv: "fr-01-facture",
  frRx: "fr-02-ordonnance",
  deInv: "de-01-rechnung",
  deRx: "de-02-privatrezept",
};

export const SITE_COPY: Record<Lang, SiteCopy> = {
  fr: {
    news: {
      title: "Nouveautés",
      lead: "Ce qui a changé dans MeDoc ce mois-ci.",
      items: [
        { date: "2026-11-23", title: "Sauvegardes automatiques, plus petites", text: "Une sauvegarde chiffrée par jour, à 13 % de la taille d'avant. 3 jours, la semaine dernière et le dernier semestre sont gardés. Pause, restauration et suppression dans Réglages, avec un motif.", href: "#settings" },
        { date: "2026-11-22", title: "Des documents conformes au pays du cabinet", text: "Choisissez Maroc, France, Allemagne ou UE : en-tête, identifiants (ICE, RPPS, BSNR…), mentions légales et format de date suivent. Aussi dans la configuration initiale.", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Facture marocaine en français et en arabe", text: "ICE, IF, TP, RC, CNSS et INPE, total en toutes lettres et mention d'exonération de TVA (art. 91 CGI).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Ordonnances et certificats en arabe", text: "Mise en page de droite à gauche, dates au format 14/06/1990, adresses latines lisibles.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "Examen complet", text: "Plusieurs statuts par dent (couronne et carie), schéma mis à jour en direct, PSI par sextant, saignement, plaque, ATM, imagerie.", href: "#clinical" },
        { date: "2026-11-16", title: "Page Conformité", text: "État en direct des sauvegardes et du journal, liste de contrôle loi 09-08 ou RGPD avec qui a coché quoi et quand.", href: "#trust" },
        { date: "2026-11-12", title: "Allergies signalées sur l'ordonnance", text: "MeDoc signale un médicament qui correspond à une allergie déjà notée dans l'anamnèse.", href: "#papers" },
      ],
    },
    docs: {
      title: "Les documents que MeDoc imprime",
      lead: "Exemples réels sortis du logiciel. Chaque document suit le pays du cabinet : identifiants, mentions légales et format de date. Patients et cabinets fictifs.",
      countries: { MA: "Maroc", FR: "France", DE: "Allemagne" },
      sample: "Exemple, données fictives",
      open: "Agrandir",
      download: "Télécharger le PDF",
      close: "Fermer",
      prev: "Précédent",
      next: "Suivant",
      items: [
        { file: DOC_FILES.invFr, country: "MA", lang: "fr", title: "Facture", caption: "Mentions de l'art. 145 CGI, total en lettres, exonération de TVA." },
        { file: DOC_FILES.invAr, country: "MA", lang: "ar", title: "Facture en arabe", caption: "La même facture, de droite à gauche, montants alignés." },
        { file: DOC_FILES.creditAr, country: "MA", lang: "ar", title: "Avoir", caption: "Une facture n'est jamais effacée : l'avoir l'annule et la cite." },
        { file: DOC_FILES.rxFr, country: "MA", lang: "fr", title: "Ordonnance", caption: "Médicament, forme, quantité, posologie et durée, avec numéro." },
        { file: DOC_FILES.rxAr, country: "MA", lang: "ar", title: "Ordonnance en arabe", caption: "Noms des médicaments en caractères latins, le reste en arabe." },
        { file: DOC_FILES.certFr, country: "MA", lang: "fr", title: "Certificat d'arrêt de travail", caption: "Identité du patient reprise du dossier, jamais retapée." },
        { file: DOC_FILES.certAr, country: "MA", lang: "ar", title: "Certificat en arabe", caption: "Mention du secret professionnel et de la loi 09-08 en pied de page." },
        { file: DOC_FILES.frInv, lang: "fr", country: "FR", title: "Facture", caption: "SIRET et RPPS, exonération de TVA (art. 261-4-1° CGI), dates au format français." },
        { file: DOC_FILES.frRx, lang: "fr", country: "FR", title: "Ordonnance", caption: "RPPS du prescripteur, sexe et âge du patient (art. R.5132-3 CSP), sans numéro de sécurité sociale." },
        { file: DOC_FILES.deInv, lang: "de", country: "DE", title: "Facture GOZ", caption: "Barème dentaire allemand, avec BSNR et ZANR." },
        { file: DOC_FILES.deRx, lang: "de", country: "DE", title: "Ordonnance privée", caption: "Mentions de l'AMVV § 2." },
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
  },
  ar: {
    news: {
      title: "الجديد",
      lead: "ما تغيّر في MeDoc هذا الشهر.",
      items: [
        { date: "2026-11-23", title: "نسخ احتياطية تلقائية وأصغر", text: "نسخة مشفّرة كل يوم، بحجم 13 % مما كانت عليه. يُحتفظ بـ 3 أيام والأسبوع الماضي وآخر نصف سنة. الإيقاف والاستعادة والحذف من الإعدادات، مع سبب.", href: "#settings" },
        { date: "2026-11-22", title: "وثائق تتبع بلد العيادة", text: "اختر المغرب أو فرنسا أو ألمانيا أو الاتحاد الأوروبي: رأس الوثيقة والمعرّفات (ICE وRPPS وBSNR…) والبيانات القانونية وصيغة التاريخ تتبع اختيارك. متاح أيضًا عند الإعداد الأول.", href: "#documents-gallery" },
        { date: "2026-11-20", title: "فاتورة مغربية بالفرنسية والعربية", text: "ICE وIF وTP وRC وCNSS وINPE، المبلغ بالحروف، وإشارة الإعفاء من الضريبة على القيمة المضافة (المادة 91).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "وصفات وشهادات بالعربية", text: "تخطيط من اليمين إلى اليسار، تواريخ بصيغة 14/06/1990، وعناوين لاتينية مقروءة.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "فحص كامل", text: "عدة حالات للسن الواحدة (تاج وتسوّس)، مخطط يتحدّث مباشرة، PSI لكل سدس، نزيف، لويحة، المفصل الصدغي الفكي، والتصوير.", href: "#clinical" },
        { date: "2026-11-16", title: "صفحة المطابقة", text: "حالة النسخ الاحتياطية والسجل مباشرة، وقائمة مراجعة القانون 09-08 مع من أشّر على ماذا ومتى.", href: "#trust" },
        { date: "2026-11-12", title: "تنبيه الحساسية في الوصفة", text: "ينبّه MeDoc إلى دواء يطابق حساسية مسجّلة سابقًا في السوابق المرضية.", href: "#papers" },
      ],
    },
    docs: {
      title: "الوثائق التي يطبعها MeDoc",
      lead: "أمثلة حقيقية خرجت من البرنامج. كل وثيقة تتبع بلد العيادة: المعرّفات، البيانات القانونية وصيغة التاريخ. المرضى والعيادات وهميّون.",
      countries: { MA: "المغرب", FR: "فرنسا", DE: "ألمانيا" },
      sample: "مثال، بيانات وهمية",
      open: "تكبير",
      download: "تنزيل PDF",
      close: "إغلاق",
      prev: "السابق",
      next: "التالي",
      items: [
        { file: DOC_FILES.invAr, country: "MA", lang: "ar", title: "فاتورة بالعربية", caption: "البيانات المنصوص عليها في المادة 145، المبلغ بالحروف، الإعفاء من الضريبة." },
        { file: DOC_FILES.invFr, country: "MA", lang: "fr", title: "فاتورة بالفرنسية", caption: "نفس الفاتورة بالفرنسية." },
        { file: DOC_FILES.creditAr, country: "MA", lang: "ar", title: "فاتورة تصحيحية", caption: "لا تُحذف الفاتورة أبدًا: الفاتورة التصحيحية تلغيها وتذكر رقمها." },
        { file: DOC_FILES.rxAr, country: "MA", lang: "ar", title: "وصفة طبية", caption: "أسماء الأدوية بالحروف اللاتينية، والباقي بالعربية." },
        { file: DOC_FILES.rxFr, country: "MA", lang: "fr", title: "وصفة بالفرنسية", caption: "الدواء، الشكل، الكمية، طريقة الاستعمال والمدة، مع رقم." },
        { file: DOC_FILES.certAr, country: "MA", lang: "ar", title: "شهادة التوقف عن العمل", caption: "هوية المريض مأخوذة من الملف، لا تُكتب من جديد." },
        { file: DOC_FILES.certFr, country: "MA", lang: "fr", title: "شهادة بالفرنسية", caption: "نفس الشهادة بالفرنسية." },
        { file: DOC_FILES.frInv, lang: "fr", country: "FR", title: "فاتورة فرنسية", caption: "SIRET وRPPS، والإعفاء من الضريبة (المادة 261-4-1° من المدونة الفرنسية)." },
        { file: DOC_FILES.frRx, lang: "fr", country: "FR", title: "وصفة فرنسية", caption: "رقم RPPS للطبيب، جنس المريض وعمره، دون رقم الضمان الاجتماعي." },
        { file: DOC_FILES.deInv, lang: "de", country: "DE", title: "فاتورة ألمانية GOZ", caption: "جدول الأتعاب الألماني، مع BSNR وZANR." },
        { file: DOC_FILES.deRx, lang: "de", country: "DE", title: "وصفة ألمانية خاصة", caption: "البيانات المطلوبة في AMVV § 2." },
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
  },
  en: {
    news: {
      title: "What's new",
      lead: "What changed in MeDoc this month.",
      items: [
        { date: "2026-11-23", title: "Automatic backups, much smaller", text: "One encrypted backup a day, 13% of the old size. The last 3 days, last week and last half-year are kept. Pause, restore and delete in Settings, each with a reason.", href: "#settings" },
        { date: "2026-11-22", title: "Documents that follow your country", text: "Pick Morocco, France, Germany or the EU: header, ids (ICE, RPPS, BSNR…), legal wording and date format follow. Also part of the first-run setup.", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Moroccan invoice in French and Arabic", text: "ICE, IF, TP, RC, CNSS and INPE, amount in words and the VAT-exemption note (CGI art. 91).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Prescriptions and certificates in Arabic", text: "Right-to-left layout, dates as 14/06/1990, Latin addresses kept readable.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "Full examination", text: "Several statuses per tooth (crown and caries), live chart, PSI per sextant, bleeding, plaque, TMJ, imaging.", href: "#clinical" },
        { date: "2026-11-16", title: "Compliance page", text: "Live state of backups and the audit log, plus a GDPR or Law 09-08 checklist that records who ticked what, and when.", href: "#trust" },
        { date: "2026-11-12", title: "Allergies flagged on prescriptions", text: "MeDoc flags a drug that matches an allergy already noted in the medical history.", href: "#papers" },
      ],
    },
    docs: {
      title: "The documents MeDoc prints",
      lead: "Real output from the software. Each document follows the practice's country: ids, legal wording and date format. Patients and practices are fictitious.",
      countries: { MA: "Morocco", FR: "France", DE: "Germany" },
      sample: "Sample, fictitious data",
      open: "Enlarge",
      download: "Download the PDF",
      close: "Close",
      prev: "Previous",
      next: "Next",
      items: [
        { file: DOC_FILES.invFr, country: "MA", lang: "fr", title: "Invoice (French)", caption: "The mentions required by CGI art. 145, amount in words, VAT exemption." },
        { file: DOC_FILES.invAr, country: "MA", lang: "ar", title: "Invoice (Arabic)", caption: "The same invoice, right to left, amounts aligned." },
        { file: DOC_FILES.creditAr, country: "MA", lang: "ar", title: "Credit note", caption: "An invoice is never deleted: the credit note cancels it and quotes it." },
        { file: DOC_FILES.rxFr, country: "MA", lang: "fr", title: "Prescription", caption: "Drug, form, quantity, dosage and duration, with a number." },
        { file: DOC_FILES.rxAr, country: "MA", lang: "ar", title: "Prescription (Arabic)", caption: "Drug names in Latin script, the rest in Arabic." },
        { file: DOC_FILES.certFr, country: "MA", lang: "fr", title: "Sick-leave certificate", caption: "Patient identity comes from the record, never retyped." },
        { file: DOC_FILES.certAr, country: "MA", lang: "ar", title: "Certificate (Arabic)", caption: "Professional secrecy and Law 09-08 in the footer." },
        { file: DOC_FILES.frInv, lang: "fr", country: "FR", title: "Invoice (France)", caption: "SIRET and RPPS, VAT exemption (CGI art. 261-4-1°), French date format." },
        { file: DOC_FILES.frRx, lang: "fr", country: "FR", title: "Prescription (France)", caption: "Prescriber's RPPS, patient's sex and age (art. R.5132-3 CSP), no social-security number." },
        { file: DOC_FILES.deInv, lang: "de", country: "DE", title: "GOZ invoice (Germany)", caption: "German dental fee schedule, with BSNR and ZANR." },
        { file: DOC_FILES.deRx, lang: "de", country: "DE", title: "Private prescription (Germany)", caption: "The mentions required by AMVV § 2." },
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
  },
  de: {
    news: {
      title: "Neu in MeDoc",
      lead: "Was sich in diesem Monat geändert hat.",
      items: [
        { date: "2026-11-23", title: "Automatische Sicherung, viel kleiner", text: "Jeden Tag eine verschlüsselte Sicherung, 13 % der bisherigen Größe. Aufbewahrt: 3 Tage, die Vorwoche und das letzte Halbjahr. Pausieren, Wiederherstellen und Löschen in den Einstellungen, jeweils mit Grund.", href: "#settings" },
        { date: "2026-11-22", title: "Dokumente nach dem Land der Praxis", text: "Wählen Sie Marokko, Frankreich, Deutschland oder die EU: Briefkopf, Kennungen (ICE, RPPS, BSNR …), Rechtstexte und Datumsformat folgen. Auch Teil der Ersteinrichtung.", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Marokkanische Rechnung auf Französisch und Arabisch", text: "ICE, IF, TP, RC, CNSS und INPE, Betrag in Worten und Hinweis auf die MwSt.-Befreiung (Art. 91 CGI).", href: "#documents-gallery" },
        { date: "2026-11-20", title: "Rezepte und Bescheinigungen auf Arabisch", text: "Layout von rechts nach links, Datum als 14/06/1990, lateinische Adressen bleiben lesbar.", href: "#documents-gallery" },
        { date: "2026-11-18", title: "Vollständiger Befund", text: "Mehrere Befunde je Zahn (Krone und Karies), Zahnschema in Echtzeit, PSI je Sextant, Blutung, Plaque, Kiefergelenk, Bildgebung.", href: "#clinical" },
        { date: "2026-11-16", title: "Seite „Datenschutz & Nachweise“", text: "Live-Status von Sicherungen und Protokoll, dazu eine DSGVO-Checkliste, die festhält, wer was wann abgehakt hat.", href: "#trust" },
        { date: "2026-11-12", title: "Allergiehinweis beim Rezept", text: "MeDoc weist auf ein Medikament hin, das zu einer bereits in der Anamnese erfassten Allergie passt.", href: "#papers" },
      ],
    },
    docs: {
      title: "Dokumente aus MeDoc",
      lead: "Echte Ausgaben der Software. Jedes Dokument folgt dem Land der Praxis: Kennungen, Rechtstexte und Datumsformat. Patienten und Praxen sind erfunden.",
      countries: { MA: "Marokko", FR: "Frankreich", DE: "Deutschland" },
      sample: "Muster, erfundene Daten",
      open: "Vergrößern",
      download: "PDF herunterladen",
      close: "Schließen",
      prev: "Zurück",
      next: "Weiter",
      items: [
        { file: DOC_FILES.invFr, country: "MA", lang: "fr", title: "Rechnung (Französisch)", caption: "Pflichtangaben nach Art. 145 CGI, Betrag in Worten, MwSt.-Befreiung." },
        { file: DOC_FILES.invAr, country: "MA", lang: "ar", title: "Rechnung (Arabisch)", caption: "Dieselbe Rechnung, von rechts nach links, Beträge bündig." },
        { file: DOC_FILES.creditAr, country: "MA", lang: "ar", title: "Gutschrift", caption: "Eine Rechnung wird nie gelöscht: die Gutschrift storniert sie und nennt sie." },
        { file: DOC_FILES.rxFr, country: "MA", lang: "fr", title: "Rezept", caption: "Arzneimittel, Form, Menge, Dosierung und Dauer, mit Nummer." },
        { file: DOC_FILES.rxAr, country: "MA", lang: "ar", title: "Rezept (Arabisch)", caption: "Arzneimittelnamen in lateinischer Schrift, der Rest auf Arabisch." },
        { file: DOC_FILES.certFr, country: "MA", lang: "fr", title: "Arbeitsunfähigkeitsbescheinigung", caption: "Patientendaten kommen aus der Akte, nie neu getippt." },
        { file: DOC_FILES.certAr, country: "MA", lang: "ar", title: "Bescheinigung (Arabisch)", caption: "Schweigepflicht und Gesetz 09-08 in der Fußzeile." },
        { file: DOC_FILES.frInv, lang: "fr", country: "FR", title: "Rechnung (Frankreich)", caption: "SIRET und RPPS, MwSt.-Befreiung (Art. 261-4-1° CGI), französisches Datumsformat." },
        { file: DOC_FILES.frRx, lang: "fr", country: "FR", title: "Rezept (Frankreich)", caption: "RPPS des Verordners, Geschlecht und Alter (Art. R.5132-3 CSP), ohne Sozialversicherungsnummer." },
        { file: DOC_FILES.deInv, lang: "de", country: "DE", title: "GOZ-Rechnung", caption: "Gebührenordnung für Zahnärzte, mit BSNR und ZANR." },
        { file: DOC_FILES.deRx, lang: "de", country: "DE", title: "Privatrezept", caption: "Pflichtangaben nach AMVV § 2." },
      ],
    },
    legal: {
      contents: "Inhalt",
      updated: "Stand",
      back: "Zurück zur Website",
      titles: { "legal-notice": "Impressum", "privacy-notice": "Datenschutzhinweis", "privacy-policy": "Datenschutzerklärung", terms: "Allgemeine Verkaufsbedingungen" },
    },
    looks: {
      title: "Ihre Praxis, Ihre Farben",
      lead: "Hell, dunkel oder wie der Rechner, und fünf Akzentfarben. Jeder Arbeitsplatz behält seine Einstellung. Diese Seite folgt Ihrem Design auch: auf dunkel stellen, um die Bildschirme dunkel zu sehen.",
      light: "Hell",
      dark: "Dunkel",
      accents: { mint: "Minze", ocean: "Ozean", plum: "Pflaume", rose: "Rosé", amber: "Bernstein" },
      caption: "Dasselbe Dashboard, fiktive Daten.",
    },
    moreShots: (n) => `${n} weitere Ansicht${n > 1 ? "en" : ""} zeigen`,
    mobileDemo: "Demo buchen",
  },
};
