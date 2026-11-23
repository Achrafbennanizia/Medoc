import type { Lang } from "./i18n";
import type { Country } from "./prefs";

/** "Ready for your country" block for France, Germany and the EU (Morocco has its own section). */
type Ready = { title: string; lead: string; nowTitle: string; now: string[]; notTitle: string; not: string[] };

export type CountryCopy = {
  label: string;
  names: Record<Country, string>;
  /** Gallery: show the documents of every country, not only the selected one. */
  allDocs: string;
  onlyDocs: (country: string) => string;
  ready: Record<Exclude<Country, "MA">, Ready>;
  cookie: { text: string; ok: string; more: string };
};

export const COUNTRY_COPY: Record<Lang, CountryCopy> = {
  fr: {
    label: "Pays",
    names: { MA: "Maroc", FR: "France", DE: "Allemagne", EU: "Union européenne" },
    allDocs: "Voir les documents de tous les pays",
    onlyDocs: (c) => `Voir seulement : ${c}`,
    ready: {
      FR: {
        title: "Prêt pour un cabinet en France",
        lead: "Des documents au format français et des outils RGPD. La télétransmission à l'Assurance Maladie n'est pas incluse.",
        nowTitle: "Disponible",
        now: [
          "Interface en français",
          "Factures avec SIRET et exonération de TVA (art. 261-4-1° CGI)",
          "Ordonnances avec RPPS, sexe et âge du patient (art. R.5132-3 CSP)",
          "Dates au format JJ/MM/AAAA, montants en euros",
          "Export et effacement des données patient, journal d'audit : des outils pour vos obligations RGPD",
          "Fonctionne pendant les coupures internet",
        ],
        notTitle: "Non inclus",
        not: ["Feuilles de soins électroniques (SESAM-Vitale)", "Avis d'arrêt de travail sur CERFA sécurisé"],
      },
      DE: {
        title: "Prêt pour un cabinet en Allemagne",
        lead: "Des documents selon les règles allemandes et des outils RGPD. La facturation aux caisses (KZV) n'est pas incluse.",
        nowTitle: "Disponible",
        now: [
          "Interface en allemand",
          "Facture GOZ avec BSNR et ZANR",
          "Ordonnance privée (AMVV § 2), certificat d'arrêt avec exemplaire patient et employeur",
          "Dates au format JJ.MM.AAAA, montants en euros",
          "Export et effacement des données patient, journal d'audit : des outils pour vos obligations RGPD",
          "Fonctionne pendant les coupures internet",
        ],
        notTitle: "Non inclus",
        not: ["Facturation aux caisses via la KZV (BEMA)", "Télématique (eRezept, eAU)"],
      },
      EU: {
        title: "Prêt pour un cabinet dans l'Union européenne",
        lead: "Des documents neutres et des outils RGPD. La facturation aux assurances nationales n'est pas incluse.",
        nowTitle: "Disponible",
        now: [
          "Interface en français, anglais, allemand ou arabe",
          "Factures avec votre n° de TVA et l'exonération des soins (directive 2006/112/CE, art. 132)",
          "Ordonnances et certificats à votre en-tête",
          "Montants en euros ou dans votre devise",
          "Export et effacement des données patient, journal d'audit : des outils pour vos obligations RGPD",
          "Fonctionne pendant les coupures internet",
        ],
        notTitle: "Non inclus",
        not: ["Assurances maladie et ordonnances électroniques nationales", "Identifiants propres à un pays autre que le Maroc, la France ou l'Allemagne"],
      },
    },
    cookie: {
      text: "Ce site n'utilise que des cookies nécessaires : ils retiennent votre langue, votre thème et votre pays quand vous les choisissez. Aucune mesure d'audience, aucun traceur.",
      ok: "Compris",
      more: "En savoir plus",
    },
  },
  ar: {
    label: "البلد",
    names: { MA: "المغرب", FR: "فرنسا", DE: "ألمانيا", EU: "الاتحاد الأوروبي" },
    allDocs: "عرض وثائق كل البلدان",
    onlyDocs: (c) => `عرض وثائق ${c} فقط`,
    ready: {
      FR: {
        title: "جاهز لعيادة في فرنسا",
        lead: "وثائق بالصيغة الفرنسية وأدوات للائحة العامة لحماية البيانات. الإرسال الإلكتروني إلى التأمين الصحي الفرنسي غير مشمول.",
        nowTitle: "متوفر",
        now: [
          "واجهة بالفرنسية",
          "فواتير مع SIRET والإعفاء من الضريبة (المادة 261-4-1° من المدونة الفرنسية)",
          "وصفات مع رقم RPPS وجنس المريض وعمره (المادة R.5132-3)",
          "تواريخ بصيغة يوم/شهر/سنة، ومبالغ باليورو",
          "تصدير بيانات المريض ومحوها، وسجل تدقيق: أدوات لالتزاماتك وفق اللائحة الأوروبية",
          "يعمل أثناء انقطاع الإنترنت",
        ],
        notTitle: "غير مشمول",
        not: ["أوراق العلاج الإلكترونية (SESAM-Vitale)", "إشعار التوقف عن العمل على استمارة CERFA المؤمَّنة"],
      },
      DE: {
        title: "جاهز لعيادة في ألمانيا",
        lead: "وثائق وفق القواعد الألمانية وأدوات للائحة الأوروبية. الفوترة لصناديق التأمين (KZV) غير مشمولة.",
        nowTitle: "متوفر",
        now: [
          "واجهة بالألمانية",
          "فاتورة GOZ مع BSNR وZANR",
          "وصفة خاصة (AMVV § 2)، وشهادة توقف بنسخة للمريض وأخرى للمشغّل",
          "تواريخ بصيغة يوم.شهر.سنة، ومبالغ باليورو",
          "تصدير بيانات المريض ومحوها، وسجل تدقيق: أدوات لالتزاماتك وفق اللائحة الأوروبية",
          "يعمل أثناء انقطاع الإنترنت",
        ],
        notTitle: "غير مشمول",
        not: ["الفوترة لصناديق التأمين عبر KZV (BEMA)", "البنية التحتية الرقمية الألمانية (eRezept، eAU)"],
      },
      EU: {
        title: "جاهز لعيادة في الاتحاد الأوروبي",
        lead: "وثائق محايدة وأدوات للائحة العامة لحماية البيانات. الفوترة للتأمينات الوطنية غير مشمولة.",
        nowTitle: "متوفر",
        now: [
          "واجهة بالفرنسية أو الإنجليزية أو الألمانية أو العربية",
          "فواتير مع رقم الضريبة والإعفاء الطبي (التوجيه 2006/112، المادة 132)",
          "وصفات وشهادات بترويسة عيادتك",
          "مبالغ باليورو أو بعملتك",
          "تصدير بيانات المريض ومحوها، وسجل تدقيق: أدوات لالتزاماتك وفق اللائحة الأوروبية",
          "يعمل أثناء انقطاع الإنترنت",
        ],
        notTitle: "غير مشمول",
        not: ["التأمينات الصحية والوصفات الإلكترونية الوطنية", "معرّفات خاصة ببلدان غير المغرب وفرنسا وألمانيا"],
      },
    },
    cookie: {
      text: "لا يستعمل هذا الموقع سوى ملفات تعريف الارتباط الضرورية: تحفظ لغتك ومظهرك وبلدك حين تختارها. لا قياس للجمهور ولا تتبع.",
      ok: "فهمت",
      more: "اعرف المزيد",
    },
  },
  en: {
    label: "Country",
    names: { MA: "Morocco", FR: "France", DE: "Germany", EU: "European Union" },
    allDocs: "Show documents for every country",
    onlyDocs: (c) => `Show only: ${c}`,
    ready: {
      FR: {
        title: "Ready for a practice in France",
        lead: "French-format documents and GDPR tools. Electronic claims to the French health insurance are not included.",
        nowTitle: "Available",
        now: [
          "French interface",
          "Invoices with SIRET and the VAT exemption (CGI art. 261-4-1°)",
          "Prescriptions with RPPS, the patient's sex and age (art. R.5132-3 CSP)",
          "Dates as DD/MM/YYYY, amounts in euros",
          "Patient export and erasure, audit trail: tools for your GDPR duties",
          "Works through internet cuts",
        ],
        notTitle: "Not included",
        not: ["Electronic claims (SESAM-Vitale)", "Sick-leave notice on the secure CERFA form"],
      },
      DE: {
        title: "Ready for a practice in Germany",
        lead: "Documents to German rules and GDPR tools. Statutory insurance billing (KZV) is not included.",
        nowTitle: "Available",
        now: [
          "German interface",
          "GOZ invoice with BSNR and ZANR",
          "Private prescription (AMVV § 2), sick note with patient and employer copies",
          "Dates as DD.MM.YYYY, amounts in euros",
          "Patient export and erasure, audit trail: tools for your GDPR duties",
          "Works through internet cuts",
        ],
        notTitle: "Not included",
        not: ["Statutory billing through the KZV (BEMA)", "Telematics infrastructure (eRezept, eAU)"],
      },
      EU: {
        title: "Ready for a practice in the EU",
        lead: "Neutral documents and GDPR tools. National insurance billing is not included.",
        nowTitle: "Available",
        now: [
          "Interface in English, French, German or Arabic",
          "Invoices with your VAT ID and the medical VAT exemption (Directive 2006/112/EC, art. 132)",
          "Prescriptions and certificates on your letterhead",
          "Amounts in euros or your own currency",
          "Patient export and erasure, audit trail: tools for your GDPR duties",
          "Works through internet cuts",
        ],
        notTitle: "Not included",
        not: ["National health-insurance and e-prescription systems", "Country-specific ids outside Morocco, France and Germany"],
      },
    },
    cookie: {
      text: "This site only uses necessary cookies: they remember your language, theme and country when you choose them. No analytics, no tracking.",
      ok: "Got it",
      more: "Learn more",
    },
  },
  de: {
    label: "Land",
    names: { MA: "Marokko", FR: "Frankreich", DE: "Deutschland", EU: "Europäische Union" },
    allDocs: "Dokumente aller Länder zeigen",
    onlyDocs: (c) => `Nur ${c} zeigen`,
    ready: {
      FR: {
        title: "Bereit für eine Praxis in Frankreich",
        lead: "Dokumente im französischen Format und DSGVO-Werkzeuge. Die elektronische Abrechnung mit der französischen Krankenversicherung ist nicht enthalten.",
        nowTitle: "Verfügbar",
        now: [
          "Französische Oberfläche",
          "Rechnungen mit SIRET und MwSt.-Befreiung (Art. 261-4-1° CGI)",
          "Rezepte mit RPPS, Geschlecht und Alter (Art. R.5132-3 CSP)",
          "Datum TT/MM/JJJJ, Beträge in Euro",
          "Export und Löschung von Patientendaten, Audit-Protokoll: Werkzeuge für Ihre DSGVO-Pflichten",
          "Läuft bei Internetausfall weiter",
        ],
        notTitle: "Nicht enthalten",
        not: ["Elektronische Abrechnung (SESAM-Vitale)", "Arbeitsunfähigkeitsmeldung auf dem gesicherten CERFA-Formular"],
      },
      DE: {
        title: "Bereit für eine Praxis in Deutschland",
        lead: "Dokumente nach deutschen Vorgaben und DSGVO-Werkzeuge. Die Kassenabrechnung über die KZV ist nicht enthalten.",
        nowTitle: "Verfügbar",
        now: [
          "Deutsche Oberfläche",
          "Rechnung nach GOZ mit BSNR und ZANR",
          "Privatrezept (AMVV § 2), AU-Bescheinigung mit Patienten- und Arbeitgeberexemplar",
          "Datum TT.MM.JJJJ, Beträge in Euro",
          "Export und Löschung von Patientendaten, Audit-Protokoll: Werkzeuge für Ihre DSGVO-Pflichten",
          "Läuft bei Internetausfall weiter",
        ],
        notTitle: "Nicht enthalten",
        not: ["Kassenabrechnung über die KZV (BEMA)", "Telematikinfrastruktur (eRezept, eAU)"],
      },
      EU: {
        title: "Bereit für eine Praxis in der EU",
        lead: "Neutrale Dokumente und DSGVO-Werkzeuge. Die Abrechnung mit nationalen Versicherungen ist nicht enthalten.",
        nowTitle: "Verfügbar",
        now: [
          "Oberfläche auf Deutsch, Englisch, Französisch oder Arabisch",
          "Rechnungen mit Ihrer USt-IdNr. und der Befreiung für Heilbehandlungen (Richtlinie 2006/112/EG, Art. 132)",
          "Rezepte und Bescheinigungen mit Ihrem Briefkopf",
          "Beträge in Euro oder Ihrer Währung",
          "Export und Löschung von Patientendaten, Audit-Protokoll: Werkzeuge für Ihre DSGVO-Pflichten",
          "Läuft bei Internetausfall weiter",
        ],
        notTitle: "Nicht enthalten",
        not: ["Nationale Krankenversicherungs- und E-Rezept-Systeme", "Länderspezifische Kennungen außer Marokko, Frankreich und Deutschland"],
      },
    },
    cookie: {
      text: "Diese Website verwendet nur notwendige Cookies: Sie speichern Sprache, Design und Land, wenn Sie diese wählen. Keine Reichweitenmessung, kein Tracking.",
      ok: "Verstanden",
      more: "Mehr erfahren",
    },
  },
};
