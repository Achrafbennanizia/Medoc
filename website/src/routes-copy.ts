import type { Lang } from "./i18n";

/**
 * Copy for the goal pages (#/pricing, #/morocco, #/faq, #/demo) and the home sections that sell
 * the product: "digitize everything", the page explorer and the closing call to action. Every item
 * in `everything` is a feature of the current release; an item that is not in all three editions
 * names its editions.
 */
export type GoalPage = "pricing" | "morocco" | "faq" | "demo";
type Head = { kicker: string; title: string; lead: string };
type Item = { t: string; d: string };
export type RoutesCopy = {
  /** Menu and tab-title labels, also for the editions and Europe pages. */
  nav: Record<GoalPage | "editions" | "europe", string>;
  /** Europe is a coming-soon page; its body lives in digital-copy. */
  heads: Record<GoalPage | "europe", Head>;
  everything: { kicker: string; title: string; lead: string; items: Item[]; cta: string; note: string };
  explore: { title: string; lead: string; cards: Record<"features" | GoalPage | "security", Item> };
  final: { title: string; text: string; cta: string; second: string };
};

const en: RoutesCopy = {
  nav: { editions: "Editions", pricing: "Prices", morocco: "Morocco", europe: "Europe", faq: "Questions", demo: "Book a demo" },
  heads: {
    pricing: {
      kicker: "Prices",
      title: "One licence, yours for good. No surprise fees.",
      lead: "Pay the licence once, choose a service plan if you want one, and know exactly what you pay. Installation and training come with every licence.",
    },
    morocco: {
      kicker: "Morocco",
      title: "Digital Morocco 2030, Bill 52-26 and Law 09-08: what they mean for your practice",
      lead: "What is changing for dental practices in Morocco, in plain words, and how MeDoc Dentist gets you ready.",
    },
    faq: {
      kicker: "Questions",
      title: "Straight answers before you decide",
      lead: "Data, internet, law, prices, support: what dentists ask us most, answered plainly.",
    },
    demo: {
      kicker: "Free demo",
      title: "See your own practice in MeDoc Dentist, in 30 minutes",
      lead: "A real day, live: patient, tooth chart, appointment, prescription and payment, plus the day close if you are looking at Cabinet or Cabinet+. Free, no commitment, in your language.",
    },
    europe: {
      kicker: "Europe",
      title: "Coming soon",
      lead: "MeDoc Dentist is sold in Morocco today.",
    },
  },
  everything: {
    kicker: "Digitize everything",
    title: "Every paper, every appointment, every payment. One program.",
    lead: "MeDoc Dentist replaces the binders, the appointment book, the receipt pad and the spreadsheet. Everything your practice writes down today goes into one encrypted place.",
    items: [
      { t: "Patient files", d: "Identity, medical history and allergies, found with one search." },
      { t: "Tooth chart", d: "Findings and treatments on an FDI chart, tooth by tooth." },
      { t: "Appointments", d: "Month, week and day views. In Cabinet and Cabinet+, the whole team shares them." },
      { t: "Prescriptions", d: "Printed, numbered, with an allergy warning." },
      { t: "Certificates", d: "Patient identity taken from the record, never retyped." },
      { t: "Invoices", d: "In the Moroccan format, in French or Arabic." },
      { t: "Cash desk", d: "Every payment recorded. In Cabinet and Cabinet+, the day is closed against the cash drawer." },
      { t: "X-rays and letters", d: "Scans and documents attached to the patient." },
      { t: "Team hours", d: "Cabinet and Cabinet+: working time, and tasks between dentist and reception." },
      { t: "Statistics", d: "Activity and revenue, computed on your own computers." },
    ],
    cta: "See it live in a free demo",
    note: "Everything listed is in the current release.",
  },
  explore: {
    title: "Find what matters to you",
    lead: "Each page answers one question.",
    cards: {
      features: { t: "Features", d: "A tour of the real program, screen by screen." },
      pricing: { t: "Prices", d: "Licences, service plans and set-ups." },
      morocco: { t: "Morocco", d: "Digital Morocco 2030, Bill 52-26 and Law 09-08, explained." },
      security: { t: "Security", d: "Where your data lives and who can see it." },
      faq: { t: "Questions", d: "Straight answers before you decide." },
      demo: { t: "Book a demo", d: "30 minutes, free, in your language." },
    },
  },
  final: {
    title: "Ready to leave paper behind?",
    text: "Book a free 30-minute demo. We'll show you your own day in MeDoc Dentist and tell you honestly what it takes to switch.",
    cta: "Book a free demo",
    second: "See prices",
  },
};

const fr: RoutesCopy = {
  nav: { editions: "Éditions", pricing: "Tarifs", morocco: "Maroc", europe: "Europe", faq: "Questions", demo: "Réserver une démo" },
  heads: {
    pricing: {
      kicker: "Tarifs",
      title: "Une licence, à vous pour toujours. Aucun frais surprise.",
      lead: "Payez la licence une fois, choisissez un forfait de service si vous le souhaitez, et sachez exactement ce que vous payez. Installation et formation incluses avec chaque licence.",
    },
    morocco: {
      kicker: "Maroc",
      title: "Maroc Digital 2030, projet de loi 52-26 et loi 09-08 : ce qu'ils changent pour votre cabinet",
      lead: "Ce qui change pour les cabinets dentaires au Maroc, expliqué simplement, et comment MeDoc Dentist vous y prépare.",
    },
    faq: {
      kicker: "Questions",
      title: "Des réponses franches avant de décider",
      lead: "Données, internet, loi, tarifs, support : les questions que les dentistes nous posent le plus, sans détour.",
    },
    demo: {
      kicker: "Démo gratuite",
      title: "Voyez votre propre cabinet dans MeDoc Dentist, en 30 minutes",
      lead: "Une vraie journée, en direct : patient, schéma dentaire, rendez-vous, ordonnance et encaissement, plus la clôture de caisse si vous regardez Cabinet ou Cabinet+. Gratuit, sans engagement, dans votre langue.",
    },
    europe: {
      kicker: "Europe",
      title: "Bientôt",
      lead: "MeDoc Dentist est vendu au Maroc aujourd'hui.",
    },
  },
  everything: {
    kicker: "Tout numériser",
    title: "Chaque papier, chaque rendez-vous, chaque paiement. Un seul logiciel.",
    lead: "MeDoc Dentist remplace les classeurs, l'agenda papier, le carnet de reçus et le tableur. Tout ce que votre cabinet note aujourd'hui va dans un seul endroit chiffré.",
    items: [
      { t: "Dossiers patients", d: "Identité, antécédents et allergies, retrouvés en une recherche." },
      { t: "Schéma dentaire", d: "Constats et soins sur un schéma FDI, dent par dent." },
      { t: "Rendez-vous", d: "Vues mois, semaine et jour. En Cabinet et Cabinet+, toute l'équipe les partage." },
      { t: "Ordonnances", d: "Imprimées, numérotées, avec alerte allergie." },
      { t: "Certificats", d: "L'identité du patient reprise du dossier, jamais ressaisie." },
      { t: "Factures", d: "Au format marocain, en français ou en arabe." },
      { t: "Caisse", d: "Chaque paiement enregistré. En Cabinet et Cabinet+, la journée est clôturée contre la caisse." },
      { t: "Radios et courriers", d: "Scans et documents rattachés au patient." },
      { t: "Heures de l'équipe", d: "Cabinet et Cabinet+ : temps de travail, et tâches entre dentiste et accueil." },
      { t: "Statistiques", d: "Activité et chiffre d'affaires, calculés sur vos ordinateurs." },
    ],
    cta: "Le voir en direct dans une démo gratuite",
    note: "Tout ce qui est listé est dans la version actuelle.",
  },
  explore: {
    title: "Trouvez ce qui compte pour vous",
    lead: "Chaque page répond à une question.",
    cards: {
      features: { t: "Fonctionnalités", d: "Une visite du vrai logiciel, écran par écran." },
      pricing: { t: "Tarifs", d: "Licences, forfaits de service et installations." },
      morocco: { t: "Maroc", d: "Maroc Digital 2030, projet de loi 52-26 et loi 09-08, expliqués." },
      security: { t: "Sécurité", d: "Où sont vos données et qui peut les voir." },
      faq: { t: "Questions", d: "Des réponses franches avant de décider." },
      demo: { t: "Réserver une démo", d: "30 minutes, gratuit, dans votre langue." },
    },
  },
  final: {
    title: "Prêt à laisser le papier derrière vous ?",
    text: "Réservez une démo gratuite de 30 minutes. Nous vous montrons votre propre journée dans MeDoc Dentist et vous disons honnêtement ce qu'il faut pour changer.",
    cta: "Réserver une démo gratuite",
    second: "Voir les tarifs",
  },
};

const ar: RoutesCopy = {
  nav: { editions: "الإصدارات", pricing: "الأسعار", morocco: "المغرب", europe: "أوروبا", faq: "أسئلة", demo: "احجز عرضًا" },
  heads: {
    pricing: {
      kicker: "الأسعار",
      title: "ترخيص واحد، ملكك إلى الأبد. بلا رسوم مفاجئة.",
      lead: "ادفع الترخيص مرة واحدة، واختر باقة خدمة إن أردت، واعرف بالضبط ما تدفعه. التثبيت والتدريب مشمولان مع كل ترخيص.",
    },
    morocco: {
      kicker: "المغرب",
      title: "المغرب الرقمي 2030 ومشروع القانون 52-26 والقانون 09-08: ماذا تعني لعيادتك",
      lead: "ما الذي يتغيّر لعيادات طب الأسنان في المغرب، بكلمات بسيطة، وكيف يُعدّك MeDoc Dentist لذلك.",
    },
    faq: {
      kicker: "أسئلة",
      title: "أجوبة صريحة قبل أن تقرّر",
      lead: "البيانات والإنترنت والقانون والأسعار والدعم: أكثر ما يسألنا عنه أطباء الأسنان، بأجوبة واضحة.",
    },
    demo: {
      kicker: "عرض مجاني",
      title: "شاهد عيادتك في MeDoc Dentist خلال 30 دقيقة",
      lead: "يوم حقيقي مباشرةً: المريض، ومخطط الأسنان، والموعد، والوصفة، والأداء، وإغلاق اليوم إن كنت تهتم بـ Cabinet أو Cabinet+. مجانًا، دون التزام، وبلغتك.",
    },
    europe: {
      kicker: "أوروبا",
      title: "قريبًا",
      lead: "يُباع MeDoc Dentist اليوم في المغرب.",
    },
  },
  everything: {
    kicker: "رقمنة كل شيء",
    title: "كل ورقة، كل موعد، كل أداء. برنامج واحد.",
    lead: "يحلّ MeDoc Dentist محلّ الملفات ودفتر المواعيد ودفتر الإيصالات والجداول. كل ما تدوّنه عيادتك اليوم يذهب إلى مكان واحد مشفّر.",
    items: [
      { t: "ملفات المرضى", d: "الهوية والسوابق الطبية والحساسية، في بحث واحد." },
      { t: "مخطط الأسنان", d: "الملاحظات والعلاجات على مخطط FDI، سنًّا بسنّ." },
      { t: "المواعيد", d: "عرض شهري وأسبوعي ويومي. في Cabinet وCabinet+ يتشاركه الفريق كله." },
      { t: "الوصفات", d: "مطبوعة ومرقّمة، مع تنبيه الحساسية." },
      { t: "الشهادات", d: "هوية المريض مأخوذة من الملف، دون إعادة كتابة." },
      { t: "الفواتير", d: "بالصيغة المغربية، بالعربية أو الفرنسية." },
      { t: "الصندوق", d: "كل أداء مسجّل. في Cabinet وCabinet+ يُغلق اليوم مطابقًا للصندوق." },
      { t: "الأشعة والمراسلات", d: "المسوح والوثائق مرفقة بملف المريض." },
      { t: "ساعات الفريق", d: "في Cabinet وCabinet+: وقت العمل، والمهام بين الطبيب والاستقبال." },
      { t: "الإحصائيات", d: "النشاط والمداخيل، محسوبة على حواسيبك." },
    ],
    cta: "شاهده مباشرةً في عرض مجاني",
    note: "كل ما هو مذكور موجود في الإصدار الحالي.",
  },
  explore: {
    title: "اعثر على ما يهمّك",
    lead: "كل صفحة تجيب عن سؤال واحد.",
    cards: {
      features: { t: "الميزات", d: "جولة في البرنامج الحقيقي، شاشة بشاشة." },
      pricing: { t: "الأسعار", d: "التراخيص وباقات الخدمة والتجهيزات." },
      morocco: { t: "المغرب", d: "المغرب الرقمي 2030 ومشروع القانون 52-26 والقانون 09-08، بشرح واضح." },
      security: { t: "الأمان", d: "أين تُحفظ بياناتك ومن يمكنه رؤيتها." },
      faq: { t: "أسئلة", d: "أجوبة صريحة قبل أن تقرّر." },
      demo: { t: "احجز عرضًا", d: "30 دقيقة، مجانًا، بلغتك." },
    },
  },
  final: {
    title: "مستعد لترك الورق خلفك؟",
    text: "احجز عرضًا مجانيًا لمدة 30 دقيقة. سنريك يومك في MeDoc Dentist ونخبرك بصدق بما يتطلّبه الانتقال.",
    cta: "احجز عرضًا مجانيًا",
    second: "اطّلع على الأسعار",
  },
};

export const ROUTES_COPY: Record<Lang, RoutesCopy> = { en, fr, ar };
