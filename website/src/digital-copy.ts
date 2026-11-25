import type { Lang } from "./i18n";
import type { Country } from "./prefs";

/**
 * Digitalization Pack and "digital health in your country". Every figure has a source; laws and
 * bills are described as they stand (Bill 52-26 is not law yet). Keep "what MeDoc Dentist does"
 * true to the current release: no TI, Ségur or DMP connection is claimed.
 */
type Stat = { v: string; l: string };
type Src = { t: string; u: string };
type CountryDigital = { kicker: string; title: string; lead: string; stats: Stat[]; helpTitle: string; help: string[]; note?: string; sources: Src[] };
type Step = { t: string; d: string };
type Adv = { k: string; t: string; d: string };
export type DigitalCopy = {
  advantages: { kicker: string; title: string; lead: string; items: Adv[] };
  pilot: { kicker: string; title: string; text: string; points: string[]; cta: string };
  pack: { kicker: string; title: string; lead: string; steps: Step[]; promise: string; cta: string; photoAlt: string; before: string; after: string; beforeAlt: string; afterAlt: string };
  sourcesLabel: string;
  countries: Record<Country, CountryDigital>;
};

const SRC = {
  tradeMA: { t: "trade.gov · Morocco: Digital Economy", u: "https://www.trade.gov/country-commercial-guides/morocco-digital-economy" },
  medias24: { t: "Médias24 · Santé numérique (2026)", u: "https://medias24.com/2026/07/23/sante-numerique-ce-que-le-projet-de-loi-changer-dans-votre-parcours-de-soins-1728651/" },
  telquel: { t: "TelQuel · Projet de loi 52-26 (2026)", u: "https://telquel.ma/2026/09/30/projet-de-loi-52-26-numeriser-la-sante-pourquoi-faire_2010620" },
  segur: { t: "Agence du Numérique en Santé · Ségur, chirurgiens-dentistes", u: "https://esante.gouv.fr/segur/chirurgiens-dentistes" },
  bmg: { t: "Bundesgesundheitsministerium · ePA für alle", u: "https://www.bundesgesundheitsministerium.de/themen/digitalisierung/elektronische-patientenakte" },
  kzbv: { t: "KZBV · Start der ePA (2025)", u: "https://www.kzbv.de/wp-content/uploads/KZBV_ePA_OnePager_Start_der_ePA_2025-09.pdf" },
  ehds: { t: "European Commission · EHDS Regulation", u: "https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en" },
};

const en: DigitalCopy = {
  advantages: {
    "kicker": "Why practices switch",
    "title": "10 ways MeDoc Dentist makes the day easier",
    "lead": "Every point below is a feature of the current release, not a promise.",
    "items": [
      {
        "k": "⌘K",
        "t": "Find any patient in seconds",
        "d": "One search, from any screen, with a single shortcut."
      },
      {
        "k": "1 file",
        "t": "No more missing documents",
        "d": "X-rays, letters and scans are attached to the patient's record, not left in a drawer."
      },
      {
        "k": "3 views",
        "t": "A calendar the whole team shares",
        "d": "Month, week and day, with drag-and-drop changes everyone sees."
      },
      {
        "k": "↻",
        "t": "Prescriptions without retyping",
        "d": "Reuse the lines you save; MeDoc warns when a drug matches a recorded allergy."
      },
      {
        "k": "✓",
        "t": "Nothing slips between reception and dentist",
        "d": "Reception drafts, the dentist validates, and a bell signals every change."
      },
      {
        "k": "=",
        "t": "A day close that adds up",
        "d": "Each payment method is checked against the till before the day is locked."
      },
      {
        "k": "13%",
        "t": "Backups that don't fill the disk",
        "d": "One encrypted backup a day at 13% of the previous size, with 3 days, last week and last half-year kept."
      },
      {
        "k": "Offline",
        "t": "Works when the internet doesn't",
        "d": "Records, calendar and till run on your own computers and practice network."
      },
      {
        "k": "Audit",
        "t": "Know who opened what",
        "d": "Every medical read is logged, and reception never sees the medical chart."
      },
      {
        "k": "4",
        "t": "In your patients' language",
        "d": "French, Arabic, English and German, with Moroccan invoices in French and Arabic."
      }
    ]
  },
  pilot: {
    "kicker": "Stories from our first practices",
    "title": "Write the first story with us",
    "text": "MeDoc Dentist is opening to its first practices. Pilot practices get the Digitalization Pack and a direct line to the people who build the software. In return we ask for honest feedback, which we will publish here, with their permission.",
    "points": [
      "Set-up, data import and training included",
      "A direct line to the team that builds MeDoc Dentist",
      "Your feedback decides what we improve next"
    ],
    "cta": "Become a pilot practice"
  },
  pack: {
    kicker: "Digitalization Pack",
    title: "From paper files to a digital practice, with us at your side",
    lead: "MeDoc Dentist puts the whole practice in one place: patients, charts, appointments, prescriptions, payments and documents. The Digitalization Pack is how we get you there without losing a patient or a day of work.",
    steps: [
      { t: "We look at how you work", d: "A call or a visit to map your day, your documents and the files you keep today." },
      { t: "We bring your data in", d: "Patients and appointments imported from Excel or CSV; paper documents scanned and attached to each patient." },
      { t: "We set up and train", d: "Installation, your prices and templates, and training for reception and dentists." },
      { t: "We stay with you", d: "Follow-up in the first weeks, support by phone and WhatsApp, and regular updates." },
    ],
    promise: "Our commitment: every practice that chooses MeDoc Dentist gets this help, whatever its size, until it runs on its own.",
    cta: "Ask about the Digitalization Pack",
    photoAlt: "A dentist showing a patient her X-ray on a tablet.",
    before: "Before",
    after: "After",
    beforeAlt: "Stacks of paper files tied with ribbons.",
    afterAlt: "A smiling receptionist working on a computer at the front desk.",
  },
  sourcesLabel: "Sources",
  countries: {
    MA: {
      kicker: "Digital health in Morocco",
      title: "Morocco is going digital. Your practice can be ready first.",
      lead: "Digital Morocco 2030 makes health a priority for digitisation. Bill 52-26, now before Parliament, plans a shared medical record for every patient and a national health identifier, and asks health professionals to feed them.",
      stats: [
        { v: "2030", l: "Horizon of Digital Morocco 2030, launched in September 2024, with health among its priorities" },
        { v: "52-26", l: "Bill on the national integrated health information system, before Parliament since July 2026" },
        { v: "1 record", l: "A shared medical record planned for every patient, fed by health professionals" },
      ],
      helpTitle: "How MeDoc Dentist helps you get there",
      help: [
        "Your files become digital and structured today: patients, tooth charts, treatments, prescriptions and invoices.",
        "Separate roles, an audit trail and encrypted storage: the confidentiality patients expect from a digital record.",
        "When the national standards are published, we will follow them in MeDoc Dentist updates.",
      ],
      note: "Bill 52-26 is not law yet; its final obligations and dates may change.",
      sources: [SRC.tradeMA, SRC.medias24, SRC.telquel],
    },
    FR: {
      kicker: "Digital health in France",
      title: "France: the Ségur du numérique en santé",
      lead: "Through the Ségur programme, dental software connects to Mon espace santé and secure health messaging, and referenced software is funded for practices.",
      stats: [
        { v: "38,000+", l: "Dentists covered by the Ségur programme" },
        { v: "97%", l: "of people in France have a Mon espace santé profile (2025)" },
        { v: "400M+", l: "Documents added to Mon espace santé each year" },
      ],
      helpTitle: "Where MeDoc Dentist stands",
      help: [
        "MeDoc Dentist is not Ségur-referenced and does not connect to Mon espace santé yet.",
        "Today it suits practices that want local, encrypted records and French-format documents.",
      ],
      sources: [SRC.segur],
    },
    DE: {
      kicker: "Digital health in Germany",
      title: "Germany: E-Rezept and the ePA for everyone",
      lead: "Germany's Digital Act made the E-Rezept the standard and introduced the electronic patient record for everyone, on an opt-out basis.",
      stats: [
        { v: "1 Jan 2024", l: "E-Rezept mandatory for medical and dental practices" },
        { v: "15 Jan 2025", l: "Start of the ePA für alle" },
        { v: "1 Oct 2025", l: "All practices required to use the ePA" },
      ],
      helpTitle: "Where MeDoc Dentist stands",
      help: [
        "MeDoc Dentist is not connected to the Telematikinfrastruktur, so it cannot issue E-Rezepte or fill the ePA.",
        "In Germany it suits private practices for records, documents and GOZ invoicing.",
      ],
      sources: [SRC.bmg, SRC.kzbv],
    },
    EU: {
      kicker: "Digital health in the EU",
      title: "The European Health Data Space",
      lead: "The EHDS Regulation gives every patient access to their health data across the EU and sets a common exchange format for electronic health record systems.",
      stats: [
        { v: "2025/327", l: "EHDS Regulation, in force since March 2025" },
        { v: "26 Mar 2027", l: "General date of application" },
        { v: "2029", l: "First exchange of patient summaries and ePrescriptions between countries" },
      ],
      helpTitle: "Where MeDoc Dentist stands",
      help: [
        "MeDoc Dentist does not support the European exchange format yet.",
        "We are following it as it is specified, so MeDoc Dentist is ready before it applies to systems like ours.",
      ],
      sources: [SRC.ehds],
    },
  },
};

const fr: DigitalCopy = {
  advantages: {
    "kicker": "Pourquoi les cabinets passent à MeDoc",
    "title": "10 façons dont MeDoc Dentist simplifie la journée",
    "lead": "Chaque point ci-dessous est une fonction de la version actuelle, pas une promesse.",
    "items": [
      {
        "k": "⌘K",
        "t": "Retrouver un patient en quelques secondes",
        "d": "Une recherche depuis n'importe quel écran, avec un seul raccourci."
      },
      {
        "k": "1 dossier",
        "t": "Fini les documents égarés",
        "d": "Radios, courriers et scans sont rattachés au dossier du patient, pas oubliés dans un tiroir."
      },
      {
        "k": "3 vues",
        "t": "Un agenda partagé par toute l'équipe",
        "d": "Mois, semaine et jour, avec des modifications par glisser-déposer que chacun voit."
      },
      {
        "k": "↻",
        "t": "Des ordonnances sans ressaisie",
        "d": "Réutilisez vos lignes enregistrées ; MeDoc alerte si un médicament correspond à une allergie notée."
      },
      {
        "k": "✓",
        "t": "Rien ne se perd entre l'accueil et le dentiste",
        "d": "L'accueil prépare, le dentiste valide, et une cloche signale chaque changement."
      },
      {
        "k": "=",
        "t": "Une clôture de caisse qui tombe juste",
        "d": "Chaque moyen de paiement est comparé à la caisse avant que la journée soit verrouillée."
      },
      {
        "k": "13 %",
        "t": "Des sauvegardes qui ne remplissent pas le disque",
        "d": "Une sauvegarde chiffrée par jour, à 13 % de la taille d'avant ; 3 jours, la semaine dernière et le dernier semestre sont gardés."
      },
      {
        "k": "Hors ligne",
        "t": "Fonctionne quand internet coupe",
        "d": "Dossiers, agenda et caisse tournent sur vos ordinateurs et le réseau du cabinet."
      },
      {
        "k": "Journal",
        "t": "Savoir qui a ouvert quoi",
        "d": "Chaque lecture médicale est journalisée, et l'accueil ne voit jamais le dossier médical."
      },
      {
        "k": "4",
        "t": "Dans la langue de vos patients",
        "d": "Français, arabe, anglais et allemand, avec des factures marocaines en français et en arabe."
      }
    ]
  },
  pilot: {
    "kicker": "Les histoires de nos premiers cabinets",
    "title": "Écrivez la première histoire avec nous",
    "text": "MeDoc Dentist s'ouvre à ses premiers cabinets. Les cabinets pilotes bénéficient du Pack Digitalisation et d'une ligne directe avec ceux qui construisent le logiciel. En échange, nous leur demandons un retour honnête, que nous publierons ici avec leur accord.",
    "points": [
      "Installation, reprise des données et formation incluses",
      "Une ligne directe avec l'équipe qui construit MeDoc Dentist",
      "Vos retours décident de nos prochaines améliorations"
    ],
    "cta": "Devenir cabinet pilote"
  },
  pack: {
    kicker: "Pack Digitalisation",
    title: "Du dossier papier au cabinet numérique, avec nous à vos côtés",
    lead: "MeDoc Dentist réunit tout le cabinet au même endroit : patients, schémas, rendez-vous, ordonnances, encaissements et documents. Le Pack Digitalisation, c'est notre façon de vous y amener sans perdre un patient ni une journée de travail.",
    steps: [
      { t: "Nous regardons comment vous travaillez", d: "Un appel ou une visite pour comprendre votre journée, vos documents et les dossiers que vous tenez aujourd'hui." },
      { t: "Nous reprenons vos données", d: "Patients et rendez-vous importés depuis Excel ou CSV ; documents papier numérisés et rattachés à chaque patient." },
      { t: "Nous installons et formons", d: "Installation, vos tarifs et modèles, et formation de l'accueil et des dentistes." },
      { t: "Nous restons avec vous", d: "Un suivi pendant les premières semaines, une assistance par téléphone et WhatsApp, et des mises à jour régulières." },
    ],
    promise: "Notre engagement : chaque cabinet qui choisit MeDoc Dentist reçoit cette aide, quelle que soit sa taille, jusqu'à ce qu'il soit autonome.",
    cta: "Demander le Pack Digitalisation",
    photoAlt: "Un dentiste montre sa radiographie à une patiente sur une tablette.",
    before: "Avant",
    after: "Après",
    beforeAlt: "Des piles de dossiers papier attachés par des rubans.",
    afterAlt: "Une secrétaire souriante travaille sur ordinateur à l'accueil.",
  },
  sourcesLabel: "Sources",
  countries: {
    MA: {
      kicker: "La santé numérique au Maroc",
      title: "Le Maroc passe au numérique. Votre cabinet peut être prêt en premier.",
      lead: "Maroc Digital 2030 fait de la santé une priorité de la numérisation. Le projet de loi 52-26, en discussion au Parlement, prévoit un dossier médical partagé pour chaque patient et un identifiant national de santé, alimentés par les professionnels de santé.",
      stats: [
        { v: "2030", l: "Horizon de Maroc Digital 2030, lancée en septembre 2024, avec la santé parmi ses priorités" },
        { v: "52-26", l: "Projet de loi sur le système national intégré d'information sanitaire, au Parlement depuis juillet 2026" },
        { v: "1 dossier", l: "Un dossier médical partagé prévu pour chaque patient, alimenté par les professionnels" },
      ],
      helpTitle: "Comment MeDoc Dentist vous y prépare",
      help: [
        "Vos dossiers deviennent numériques et structurés dès aujourd'hui : patients, schémas dentaires, soins, ordonnances et factures.",
        "Rôles séparés, journal d'audit et stockage chiffré : la confidentialité que les patients attendent d'un dossier numérique.",
        "Quand les normes nationales seront publiées, nous les suivrons dans les mises à jour de MeDoc Dentist.",
      ],
      note: "Le projet de loi 52-26 n'est pas encore adopté ; ses obligations et ses dates peuvent encore changer.",
      sources: [SRC.tradeMA, SRC.medias24, SRC.telquel],
    },
    FR: {
      kicker: "La santé numérique en France",
      title: "France : le Ségur du numérique en santé",
      lead: "Avec le Ségur, les logiciels dentaires se connectent à Mon espace santé et à la messagerie sécurisée de santé, et les logiciels référencés sont financés pour les cabinets.",
      stats: [
        { v: "38 000+", l: "Chirurgiens-dentistes concernés par le Ségur" },
        { v: "97 %", l: "des Français ont un profil Mon espace santé (2025)" },
        { v: "400 M+", l: "Documents déposés chaque année dans Mon espace santé" },
      ],
      helpTitle: "Où en est MeDoc Dentist",
      help: [
        "MeDoc Dentist n'est pas référencé Ségur et ne se connecte pas encore à Mon espace santé.",
        "Il convient aujourd'hui aux cabinets qui veulent des dossiers locaux et chiffrés et des documents au format français.",
      ],
      sources: [SRC.segur],
    },
    DE: {
      kicker: "La santé numérique en Allemagne",
      title: "Allemagne : E-Rezept et dossier patient pour tous",
      lead: "La loi numérique allemande a fait de l'E-Rezept la norme et a introduit le dossier patient électronique pour tous, sauf opposition.",
      stats: [
        { v: "1er janv. 2024", l: "E-Rezept obligatoire pour les cabinets médicaux et dentaires" },
        { v: "15 janv. 2025", l: "Lancement de l'ePA für alle" },
        { v: "1er oct. 2025", l: "Tous les cabinets doivent utiliser l'ePA" },
      ],
      helpTitle: "Où en est MeDoc Dentist",
      help: [
        "MeDoc Dentist n'est pas relié à la Telematikinfrastruktur : il ne peut ni émettre d'E-Rezept ni alimenter l'ePA.",
        "En Allemagne, il convient aux cabinets privés pour les dossiers, les documents et la facturation GOZ.",
      ],
      sources: [SRC.bmg, SRC.kzbv],
    },
    EU: {
      kicker: "La santé numérique dans l'UE",
      title: "L'Espace européen des données de santé",
      lead: "Le règlement EHDS donne à chaque patient l'accès à ses données de santé dans toute l'UE et fixe un format d'échange commun pour les dossiers patients électroniques.",
      stats: [
        { v: "2025/327", l: "Règlement EHDS, en vigueur depuis mars 2025" },
        { v: "26 mars 2027", l: "Date générale d'application" },
        { v: "2029", l: "Premiers échanges de résumés patients et d'ordonnances électroniques entre pays" },
      ],
      helpTitle: "Où en est MeDoc Dentist",
      help: [
        "MeDoc Dentist ne prend pas encore en charge le format d'échange européen.",
        "Nous le suivons au fil de sa définition, pour que MeDoc Dentist soit prêt avant qu'il s'applique aux logiciels comme le nôtre.",
      ],
      sources: [SRC.ehds],
    },
  },
};

const ar: DigitalCopy = {
  advantages: {
    "kicker": "لماذا تنتقل العيادات إلى MeDoc",
    "title": "10 طرق يجعل بها MeDoc Dentist اليوم أسهل",
    "lead": "كل نقطة أدناه ميزة موجودة في الإصدار الحالي، وليست وعدًا.",
    "items": [
      {
        "k": "⌘K",
        "t": "العثور على أي مريض في ثوانٍ",
        "d": "بحث واحد من أي شاشة، باختصار واحد."
      },
      {
        "k": "ملف واحد",
        "t": "لا وثائق ضائعة بعد اليوم",
        "d": "الصور الشعاعية والرسائل والوثائق الممسوحة مرفقة بملف المريض، لا منسية في درج."
      },
      {
        "k": "3 عروض",
        "t": "جدول مواعيد يتقاسمه الفريق كله",
        "d": "الشهر والأسبوع واليوم، مع تعديلات بالسحب والإفلات يراها الجميع."
      },
      {
        "k": "↻",
        "t": "وصفات دون إعادة كتابة",
        "d": "أعيدوا استعمال السطور المحفوظة، وينبّه MeDoc إذا طابق دواءٌ حساسيةً مسجّلة."
      },
      {
        "k": "✓",
        "t": "لا شيء يضيع بين الاستقبال والطبيب",
        "d": "يُعِدّ الاستقبال، ويصادق الطبيب، وجرس ينبّه إلى كل تغيير."
      },
      {
        "k": "=",
        "t": "إغلاق صندوق مضبوط",
        "d": "تُقارن كل وسيلة دفع بالصندوق قبل قفل اليوم."
      },
      {
        "k": "13%",
        "t": "نسخ احتياطية لا تملأ القرص",
        "d": "نسخة مشفّرة كل يوم بحجم 13% مما كانت عليه، مع الاحتفاظ بثلاثة أيام والأسبوع الماضي وآخر نصف سنة."
      },
      {
        "k": "دون إنترنت",
        "t": "يعمل حين ينقطع الإنترنت",
        "d": "الملفات والمواعيد والصندوق تعمل على حواسيبكم وشبكة العيادة."
      },
      {
        "k": "سجل",
        "t": "معرفة من فتح ماذا",
        "d": "كل قراءة طبية مسجّلة، ولا يرى الاستقبال الملف الطبي أبدًا."
      },
      {
        "k": "4",
        "t": "بلغة مرضاكم",
        "d": "الفرنسية والعربية والإنجليزية والألمانية، مع فواتير مغربية بالفرنسية والعربية."
      }
    ]
  },
  pilot: {
    "kicker": "قصص عياداتنا الأولى",
    "title": "اكتبوا القصة الأولى معنا",
    "text": "يفتح MeDoc Dentist أبوابه لعياداته الأولى. تحصل العيادات الرائدة على باقة الرقمنة وعلى خط مباشر مع من يبنون البرنامج. وفي المقابل نطلب منها رأيًا صادقًا، سننشره هنا بموافقتها.",
    "points": [
      "التثبيت ونقل البيانات والتدريب مشمولة",
      "خط مباشر مع الفريق الذي يبني MeDoc Dentist",
      "آراؤكم تحدد ما نحسّنه بعد ذلك"
    ],
    "cta": "انضموا كعيادة رائدة"
  },
  pack: {
    kicker: "باقة الرقمنة",
    title: "من الملفات الورقية إلى عيادة رقمية، ونحن إلى جانبكم",
    lead: "يجمع MeDoc Dentist العيادة كلها في مكان واحد: المرضى، والمخططات، والمواعيد، والوصفات، والمدفوعات، والوثائق. وباقة الرقمنة هي طريقتنا لنوصلكم إلى ذلك دون أن تفقدوا مريضًا أو يوم عمل.",
    steps: [
      { t: "ندرس طريقة عملكم", d: "مكالمة أو زيارة لفهم يومكم ووثائقكم والملفات التي تحتفظون بها اليوم." },
      { t: "ننقل بياناتكم", d: "استيراد المرضى والمواعيد من Excel أو CSV، ومسح الوثائق الورقية وإرفاقها بملف كل مريض." },
      { t: "نثبّت وندرّب", d: "التثبيت، وأسعاركم ونماذجكم، وتدريب الاستقبال وأطباء الأسنان." },
      { t: "نبقى معكم", d: "متابعة خلال الأسابيع الأولى، ودعم بالهاتف وواتساب، وتحديثات منتظمة." },
    ],
    promise: "التزامنا: كل عيادة تختار MeDoc Dentist تحصل على هذه المساعدة، مهما كان حجمها، إلى أن تعمل باستقلالية.",
    cta: "اطلبوا باقة الرقمنة",
    photoAlt: "طبيب أسنان يعرض على مريضة صورتها الشعاعية على جهاز لوحي.",
    before: "قبل",
    after: "بعد",
    beforeAlt: "أكوام من الملفات الورقية مربوطة بأشرطة.",
    afterAlt: "موظفة استقبال مبتسمة تعمل على حاسوب في مكتب الاستقبال.",
  },
  sourcesLabel: "المصادر",
  countries: {
    MA: {
      kicker: "الصحة الرقمية في المغرب",
      title: "المغرب يتجه نحو الرقمنة، وعيادتكم يمكن أن تكون جاهزة أولًا.",
      lead: "تجعل استراتيجية المغرب الرقمي 2030 الصحة من أولويات الرقمنة. ويتضمن مشروع القانون 52-26، المعروض على البرلمان، ملفًا طبيًا مشتركًا لكل مريض ومعرّفًا صحيًا وطنيًا، يغذيهما مهنيو الصحة.",
      stats: [
        { v: "2030", l: "أفق استراتيجية المغرب الرقمي 2030، التي أُطلقت في شتنبر 2024، والصحة ضمن أولوياتها" },
        { v: "52-26", l: "مشروع قانون المنظومة الوطنية المندمجة للمعلومات الصحية، معروض على البرلمان منذ يوليوز 2026" },
        { v: "ملف واحد", l: "ملف طبي مشترك مُرتقب لكل مريض، يغذيه مهنيو الصحة" },
      ],
      helpTitle: "كيف يساعدكم MeDoc Dentist على الاستعداد",
      help: [
        "تصبح ملفاتكم رقمية ومنظمة من اليوم: المرضى، ومخططات الأسنان، والعلاجات، والوصفات، والفواتير.",
        "أدوار منفصلة، وسجل تدقيق، وتخزين مشفّر: السرية التي ينتظرها المرضى من ملف رقمي.",
        "عند نشر المعايير الوطنية، سنعتمدها في تحديثات MeDoc Dentist.",
      ],
      note: "مشروع القانون 52-26 لم يُصادَق عليه بعد، وقد تتغير التزاماته ومواعيده النهائية.",
      sources: [SRC.tradeMA, SRC.medias24, SRC.telquel],
    },
    FR: {
      kicker: "الصحة الرقمية في فرنسا",
      title: "فرنسا: برنامج Ségur للصحة الرقمية",
      lead: "في إطار برنامج Ségur، ترتبط برامج طب الأسنان بمنصة Mon espace santé وبالمراسلة الصحية الآمنة، وتُموَّل البرامج المعتمدة للعيادات.",
      stats: [
        { v: "+38,000", l: "طبيب أسنان يشملهم برنامج Ségur" },
        { v: "97%", l: "من سكان فرنسا لديهم حساب في Mon espace santé (2025)" },
        { v: "+400 مليون", l: "وثيقة تُضاف إلى Mon espace santé كل سنة" },
      ],
      helpTitle: "أين يقف MeDoc Dentist",
      help: [
        "MeDoc Dentist غير معتمد في برنامج Ségur ولا يرتبط بعد بمنصة Mon espace santé.",
        "وهو مناسب اليوم للعيادات التي تريد ملفات محلية مشفّرة ووثائق بالصيغة الفرنسية.",
      ],
      sources: [SRC.segur],
    },
    DE: {
      kicker: "الصحة الرقمية في ألمانيا",
      title: "ألمانيا: الوصفة الإلكترونية والملف الإلكتروني للجميع",
      lead: "جعل القانون الرقمي الألماني الوصفة الإلكترونية هي القاعدة، وأدخل الملف الإلكتروني للمريض للجميع ما لم يعترض.",
      stats: [
        { v: "1 يناير 2024", l: "الوصفة الإلكترونية إلزامية للعيادات الطبية وعيادات الأسنان" },
        { v: "15 يناير 2025", l: "انطلاق الملف الإلكتروني للجميع (ePA)" },
        { v: "1 أكتوبر 2025", l: "إلزام كل العيادات باستعمال الملف الإلكتروني" },
      ],
      helpTitle: "أين يقف MeDoc Dentist",
      help: [
        "MeDoc Dentist غير مرتبط بالبنية التحتية للاتصالات الصحية في ألمانيا، فلا يمكنه إصدار وصفات إلكترونية أو تغذية الملف الإلكتروني.",
        "وهو مناسب في ألمانيا للعيادات الخاصة في الملفات والوثائق والفوترة وفق GOZ.",
      ],
      sources: [SRC.bmg, SRC.kzbv],
    },
    EU: {
      kicker: "الصحة الرقمية في الاتحاد الأوروبي",
      title: "الفضاء الأوروبي للبيانات الصحية",
      lead: "تمنح لائحة EHDS كل مريض الوصول إلى بياناته الصحية في كامل الاتحاد الأوروبي، وتحدد صيغة تبادل موحّدة لأنظمة الملفات الصحية الإلكترونية.",
      stats: [
        { v: "2025/327", l: "لائحة EHDS، سارية منذ مارس 2025" },
        { v: "26 مارس 2027", l: "التاريخ العام لبدء التطبيق" },
        { v: "2029", l: "أول تبادل لملخصات المرضى والوصفات الإلكترونية بين الدول" },
      ],
      helpTitle: "أين يقف MeDoc Dentist",
      help: [
        "لا يدعم MeDoc Dentist بعد صيغة التبادل الأوروبية.",
        "نتابع تحديدها خطوة بخطوة، ليكون MeDoc Dentist جاهزًا قبل أن تُطبَّق على برامج مثل برنامجنا.",
      ],
      sources: [SRC.ehds],
    },
  },
};

const de: DigitalCopy = {
  advantages: {
    "kicker": "Warum Praxen wechseln",
    "title": "10 Wege, wie MeDoc Dentist den Tag leichter macht",
    "lead": "Jeder Punkt unten ist eine Funktion der aktuellen Version, kein Versprechen.",
    "items": [
      {
        "k": "⌘K",
        "t": "Jeden Patienten in Sekunden finden",
        "d": "Eine Suche von jedem Bildschirm aus, mit einem einzigen Kürzel."
      },
      {
        "k": "1 Akte",
        "t": "Keine verlorenen Dokumente mehr",
        "d": "Röntgenbilder, Briefe und Scans hängen an der Patientenakte, nicht in einer Schublade."
      },
      {
        "k": "3 Ansichten",
        "t": "Ein Kalender für das ganze Team",
        "d": "Monat, Woche und Tag, mit Änderungen per Drag-and-drop, die alle sehen."
      },
      {
        "k": "↻",
        "t": "Rezepte ohne Abtippen",
        "d": "Gespeicherte Zeilen wiederverwenden; MeDoc warnt, wenn ein Medikament zu einer erfassten Allergie passt."
      },
      {
        "k": "✓",
        "t": "Nichts geht zwischen Empfang und Zahnarzt verloren",
        "d": "Der Empfang bereitet vor, der Zahnarzt gibt frei, und eine Glocke meldet jede Änderung."
      },
      {
        "k": "=",
        "t": "Ein Tagesabschluss, der aufgeht",
        "d": "Jede Zahlungsart wird mit der Kasse abgeglichen, bevor der Tag gesperrt wird."
      },
      {
        "k": "13 %",
        "t": "Sicherungen, die die Festplatte nicht füllen",
        "d": "Eine verschlüsselte Sicherung pro Tag mit 13 % der bisherigen Größe; 3 Tage, letzte Woche und letztes Halbjahr bleiben erhalten."
      },
      {
        "k": "Offline",
        "t": "Funktioniert, wenn das Internet ausfällt",
        "d": "Akten, Kalender und Kasse laufen auf Ihren Rechnern und im Praxisnetz."
      },
      {
        "k": "Protokoll",
        "t": "Wissen, wer was geöffnet hat",
        "d": "Jeder medizinische Zugriff wird protokolliert, und der Empfang sieht nie die medizinische Akte."
      },
      {
        "k": "4",
        "t": "In der Sprache Ihrer Patienten",
        "d": "Französisch, Arabisch, Englisch und Deutsch, mit marokkanischen Rechnungen auf Französisch und Arabisch."
      }
    ]
  },
  pilot: {
    "kicker": "Geschichten unserer ersten Praxen",
    "title": "Schreiben Sie die erste Geschichte mit uns",
    "text": "MeDoc Dentist öffnet sich für seine ersten Praxen. Pilotpraxen erhalten das Digitalisierungspaket und einen direkten Draht zu den Menschen, die die Software bauen. Im Gegenzug bitten wir um ehrliches Feedback, das wir hier mit ihrer Zustimmung veröffentlichen.",
    "points": [
      "Einrichtung, Datenübernahme und Schulung inklusive",
      "Ein direkter Draht zum Team hinter MeDoc Dentist",
      "Ihr Feedback bestimmt, was wir als Nächstes verbessern"
    ],
    "cta": "Pilotpraxis werden"
  },
  pack: {
    kicker: "Digitalisierungspaket",
    title: "Von der Papierakte zur digitalen Praxis, mit uns an Ihrer Seite",
    lead: "MeDoc Dentist bringt die ganze Praxis an einen Ort: Patienten, Befunde, Termine, Rezepte, Zahlungen und Dokumente. Mit dem Digitalisierungspaket bringen wir Sie dorthin, ohne einen Patienten oder einen Arbeitstag zu verlieren.",
    steps: [
      { t: "Wir sehen uns an, wie Sie arbeiten", d: "Ein Gespräch oder Besuch, um Ihren Tag, Ihre Dokumente und Ihre heutige Aktenführung zu verstehen." },
      { t: "Wir übernehmen Ihre Daten", d: "Patienten und Termine aus Excel oder CSV übernommen; Papierdokumente eingescannt und dem jeweiligen Patienten zugeordnet." },
      { t: "Wir richten ein und schulen", d: "Installation, Ihre Preise und Vorlagen, Schulung für Empfang und Zahnärzte." },
      { t: "Wir bleiben an Ihrer Seite", d: "Begleitung in den ersten Wochen, Support per Telefon und WhatsApp, regelmäßige Updates." },
    ],
    promise: "Unser Versprechen: Jede Praxis, die sich für MeDoc Dentist entscheidet, bekommt diese Hilfe, unabhängig von ihrer Größe, bis sie selbstständig damit arbeitet.",
    cta: "Nach dem Digitalisierungspaket fragen",
    photoAlt: "Ein Zahnarzt zeigt einer Patientin ihr Röntgenbild auf einem Tablet.",
    before: "Vorher",
    after: "Nachher",
    beforeAlt: "Stapel von Papierakten, mit Bändern verschnürt.",
    afterAlt: "Eine lächelnde Empfangskraft arbeitet am Computer.",
  },
  sourcesLabel: "Quellen",
  countries: {
    MA: {
      kicker: "Digitale Gesundheit in Marokko",
      title: "Marokko wird digital. Ihre Praxis kann als Erste bereit sein.",
      lead: "Mit Digital Morocco 2030 wird Gesundheit zur Priorität der Digitalisierung. Der Gesetzentwurf 52-26, der dem Parlament vorliegt, sieht für jeden Patienten eine gemeinsame Patientenakte und eine nationale Gesundheitskennung vor, die von den Gesundheitsberufen befüllt werden.",
      stats: [
        { v: "2030", l: "Zielhorizont von Digital Morocco 2030, gestartet im September 2024, mit Gesundheit unter den Prioritäten" },
        { v: "52-26", l: "Gesetzentwurf zum nationalen Gesundheitsinformationssystem, seit Juli 2026 im Parlament" },
        { v: "1 Akte", l: "Eine gemeinsame Patientenakte für jeden Patienten, befüllt von den Gesundheitsberufen" },
      ],
      helpTitle: "Wie MeDoc Dentist Sie vorbereitet",
      help: [
        "Ihre Akten werden schon heute digital und strukturiert: Patienten, Zahnschemata, Behandlungen, Rezepte und Rechnungen.",
        "Getrennte Rollen, Prüfprotokoll und verschlüsselte Speicherung: die Vertraulichkeit, die Patienten von einer digitalen Akte erwarten.",
        "Sobald die nationalen Standards veröffentlicht sind, setzen wir sie in Updates von MeDoc Dentist um.",
      ],
      note: "Der Gesetzentwurf 52-26 ist noch nicht verabschiedet; Pflichten und Fristen können sich noch ändern.",
      sources: [SRC.tradeMA, SRC.medias24, SRC.telquel],
    },
    FR: {
      kicker: "Digitale Gesundheit in Frankreich",
      title: "Frankreich: der Ségur du numérique en santé",
      lead: "Mit dem Ségur-Programm werden Zahnarztprogramme an Mon espace santé und die sichere Gesundheitsmail angebunden; referenzierte Software wird für Praxen finanziert.",
      stats: [
        { v: "38.000+", l: "Zahnärzte im Ségur-Programm" },
        { v: "97 %", l: "der Menschen in Frankreich haben ein Profil in Mon espace santé (2025)" },
        { v: "400 Mio.+", l: "Dokumente pro Jahr in Mon espace santé" },
      ],
      helpTitle: "Wo MeDoc Dentist steht",
      help: [
        "MeDoc Dentist ist nicht Ségur-referenziert und noch nicht an Mon espace santé angebunden.",
        "Heute passt es zu Praxen, die lokale, verschlüsselte Akten und Dokumente im französischen Format wollen.",
      ],
      sources: [SRC.segur],
    },
    DE: {
      kicker: "Digitale Gesundheit in Deutschland",
      title: "Deutschland: E-Rezept und ePA für alle",
      lead: "Das Digital-Gesetz hat das E-Rezept zum Standard gemacht und die elektronische Patientenakte für alle eingeführt, mit Widerspruchsmöglichkeit.",
      stats: [
        { v: "1. Jan. 2024", l: "E-Rezept verpflichtend für Arzt- und Zahnarztpraxen" },
        { v: "15. Jan. 2025", l: "Start der ePA für alle" },
        { v: "1. Okt. 2025", l: "Alle Praxen müssen die ePA nutzen" },
      ],
      helpTitle: "Wo MeDoc Dentist steht",
      help: [
        "MeDoc Dentist ist nicht an die Telematikinfrastruktur angebunden; es kann keine E-Rezepte ausstellen und die ePA nicht befüllen.",
        "In Deutschland eignet es sich für Privatpraxen: Akten, Dokumente und Abrechnung nach GOZ.",
      ],
      sources: [SRC.bmg, SRC.kzbv],
    },
    EU: {
      kicker: "Digitale Gesundheit in der EU",
      title: "Der Europäische Gesundheitsdatenraum",
      lead: "Die EHDS-Verordnung gibt allen Patienten EU-weit Zugriff auf ihre Gesundheitsdaten und legt ein gemeinsames Austauschformat für elektronische Patientenaktensysteme fest.",
      stats: [
        { v: "2025/327", l: "EHDS-Verordnung, in Kraft seit März 2025" },
        { v: "26. März 2027", l: "Allgemeiner Geltungsbeginn" },
        { v: "2029", l: "Erster grenzüberschreitender Austausch von Patientenkurzakten und E-Rezepten" },
      ],
      helpTitle: "Wo MeDoc Dentist steht",
      help: [
        "MeDoc Dentist unterstützt das europäische Austauschformat noch nicht.",
        "Wir verfolgen seine Festlegung, damit MeDoc Dentist bereit ist, bevor es für Systeme wie unseres gilt.",
      ],
      sources: [SRC.ehds],
    },
  },
};

export const DIGITAL_COPY: Record<Lang, DigitalCopy> = { en, fr, ar, de };
