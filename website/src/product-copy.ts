// Copy for the Features page (#/features): the hero title and lead (read by FeaturesHero), the section
// nav, the twelve features and the bands between them. Every claim comes from docs/brand/site-facts.md;
// the bullet points under each feature live in product-points.ts.

/** The twelve features, in page order. Each id is also the section's anchor (#/features/<id>). */
export const FEATURE_IDS = [
  "changes",
  "day-close",
  "calendar",
  "flags",
  "statistics",
  "patients",
  "tasks",
  "orders",
  "shortcuts",
  "status-rules",
  "backups",
  "tooth-chart",
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

/** Editions that include a feature or a point: all three, Cabinet and Cabinet+, Cabinet+ only, Essentiel only. */
export type Ed = "all" | "cabinet" | "plus" | "essentiel";

export type Shot = { file: string; alt: string; caption: string };
export type Feature = { chip: string; ed: Ed; title: string; text: string; shots: Shot[] };

export type ProductCopy = {
  title: string;
  lead: string;
  nav: string;
  docsChip: string;
  ed: Record<Ed, string>;
  features: Record<FeatureId, Feature>;
  /** Shortcuts card: keys separated by spaces, each drawn as one key. */
  keys: { k: string; d: string }[];
  /** Backups card: what the retention keeps. */
  keep: { title: string; days: string; week: string; half: string; note: string };
  demo: { title: string; text: string; cta: string };
  editions: { title: string; text: string; price: (from: string) => string; cta: string };
  security: { title: string; text: string; cta: string };
};

const shot = (file: string, alt: string, caption: string): Shot => ({ file, alt, caption });

export const productEn: ProductCopy = {
  title: "Twelve ways MeDoc Dentist makes your day easier.",
  lead: "Real screens with fictitious patients. Each feature says which editions include it: Essentiel, Cabinet or Cabinet+.",
  nav: "On this page",
  docsChip: "Moroccan documents",
  ed: { all: "All editions", cabinet: "Cabinet and Cabinet+", plus: "Cabinet+", essentiel: "Essentiel" },
  features: {
    changes: {
      chip: "Validation and log",
      ed: "all",
      title: "Keep an eye on what your team enters.",
      text: "Charts wait for your validation, a helper's entries wait for your OK, and a log you can check shows who did what, and when.",
      shots: [
        shot("charts-to-validate", "List of charts to validate, in draft or in review, each with Validate and Decline", "Cabinet and Cabinet+: charts waiting for you, each with Validate and Decline."),
        shot("settings-security", "Security settings with the audit log and device sessions", "The activity log opens from Settings, Security."),
      ],
    },
    "day-close": {
      chip: "Daily close",
      ed: "cabinet",
      title: "Close the day with two numbers.",
      text: "Type the cash you counted and your card terminal's total. MeDoc works out what should be there from the day's bookings and shows any difference.",
      shots: [shot("cash-entries", "New payment form with the amount in MAD and the payment method", "Each payment is booked with its method as it comes in. The day close adds them up for you.")],
    },
    calendar: {
      chip: "Drag-and-drop calendar",
      ed: "all",
      title: "Move an appointment with the mouse. MeDoc makes room.",
      text: "Drag an appointment to another time or day in the day or week view. MeDoc snaps it to your opening hours, pushes that doctor's next appointments back, and gives you Undo.",
      shots: [
        shot("calendar-drag", "Week view while an appointment is dragged to a new time", "In the week view, the old place fades and the new time shows in the margin."),
        shot("calendar-day", "Day view with each appointment's status", "The day view, with each appointment's status and a summary of the day."),
      ],
    },
    flags: {
      chip: "Conflicts flagged",
      ed: "all",
      title: "Catch mistakes while you work, not after.",
      text: "MeDoc checks each entry as you make it. It refuses a double booking, warns you about a drug the patient is allergic to, and shows what is still missing.",
      shots: [shot("appointment-new", "New appointment form with unavailable times greyed out", "Opening hours and conflicts are checked while you pick a time.")],
    },
    statistics: {
      chip: "Statistics",
      ed: "all",
      title: "Know how the month is going, in real figures.",
      text: "Patients, new patients, appointments, treatments and income per month, over 6 or 12 months. Each key figure shows its change against last month.",
      shots: [shot("analytics", "Statistics overview with each figure's change against last month", "Each key figure with its change against last month.")],
    },
    patients: {
      chip: "Patient overview",
      ed: "all",
      title: "The whole patient on one header.",
      text: "Open a record and see status, open invoice, age, phone, insurance and address at once, with a small tooth chart and the basics still missing.",
      shots: [shot("patient-record", "Patient record with status, open invoice, contact details and a small tooth chart", "Status, open invoice, contact, insurance and a small tooth chart on one header.")],
    },
    tasks: {
      chip: "Tasks for reception",
      ed: "cabinet",
      title: "Send a task instead of interrupting reception.",
      text: "From the patient's file, send a task to the whole front desk or to one person. It lands in their task list and notification bell, and you go back to your patient.",
      shots: [shot("practice-tasks", "Practice task list with patient, type and status", "Every task with its patient, type and status, in one list.")],
    },
    orders: {
      chip: "Orders and spending",
      ed: "all",
      title: "Supplies and spending at a glance.",
      text: "Order from your suppliers with saved templates and follow each order from open to in transit to delivered. The dashboard puts open and late orders in front of you.",
      shots: [
        shot("orders", "Supplier orders with status, expected date and price", "Open, in transit, late or delivered, with the expected date and price."),
        shot("overview", "Dashboard with items waiting for validation and orders to check", "The dashboard shows late orders to check."),
      ],
    },
    shortcuts: {
      chip: "Keyboard shortcuts",
      ed: "all",
      title: "Keep your hands on the keyboard.",
      text: "Press ⌘K to jump to any page or start something new. The most common actions have their own keys. On Windows, use Ctrl instead of ⌘.",
      shots: [],
    },
    "status-rules": {
      chip: "Status rules",
      ed: "all",
      title: "Every record follows clear steps. Nothing slips backwards.",
      text: "Appointments, patients, charts, payments and orders each have a fixed set of statuses and allowed next steps. MeDoc refuses changes out of order.",
      shots: [shot("appointment-detail", "Appointment panel with its steps: planned, confirmed, in progress, completed", "The appointment shows where it stands and offers the next allowed step.")],
    },
    backups: {
      chip: "Backups",
      ed: "all",
      title: "A backup every day, without anyone having to remember.",
      text: "MeDoc Dentist backs up the practice once a day by itself, compressed and encrypted with AES-256-GCM. Send it to a USB stick or an external drive, X-rays and scans included.",
      shots: [],
    },
    "tooth-chart": {
      chip: "Tooth chart",
      ed: "all",
      title: "A tooth chart you can read at a glance.",
      text: "All 32 permanent teeth in FDI order along a curved arch, with distinct outlines for incisors, canines, premolars and molars. Each status has its own colour and mark.",
      shots: [shot("examinations", "Examination with the tooth chart and its colour legend", "Caries in red, planned work dashed: each status has its own colour and mark.")],
    },
  },
  keys: [
    { k: "⌘ K", d: "Go to any page or new form" },
    { k: "⌘ N", d: "New appointment" },
    { k: "⇧ ⌘ N", d: "New patient" },
    { k: "G", d: "Then a letter: go straight to a section" },
    { k: "D W M", d: "Calendar: day, week or month view" },
    { k: "T", d: "Calendar: jump to today" },
    { k: "N", d: "Calendar: book an appointment" },
    { k: "← →", d: "Calendar: page through time" },
    { k: "⌘ /", d: "Every shortcut, in Help" },
  ],
  keep: {
    title: "What MeDoc keeps",
    days: "The last 3 days",
    week: "One from last week",
    half: "One from the last half-year",
    note: "Older backups are deleted automatically, so the disk never fills up.",
  },
  demo: {
    title: "See it working before you decide.",
    text: "In a free demo we walk you through the calendar, the checks and the day close, and answer your questions.",
    cta: "Book a free demo",
  },
  editions: {
    title: "Which edition fits your practice?",
    text: "Essentiel for one dentist on one computer. Cabinet for a dentist with reception, on up to 3 computers. Cabinet+ for up to 4 dentists and 5 computers.",
    price: (from) => `Licence from ${from} excl. VAT, bought once.`,
    cta: "Compare editions",
  },
  security: {
    title: "How MeDoc Dentist protects patient data",
    text: "Encryption on disk, separate roles and the audit chain are explained on the Security page.",
    cta: "Read the Security page",
  },
};

export const productFr: ProductCopy = {
  title: "Douze façons dont MeDoc Dentist vous simplifie la journée.",
  lead: "Des écrans réels, avec des patients fictifs. Chaque fonction indique les éditions qui l'incluent : Essentiel, Cabinet ou Cabinet+.",
  nav: "Sur cette page",
  docsChip: "Documents marocains",
  ed: { all: "Toutes les éditions", cabinet: "Cabinet et Cabinet+", plus: "Cabinet+", essentiel: "Essentiel" },
  features: {
    changes: {
      chip: "Validation et journal",
      ed: "all",
      title: "Gardez un œil sur ce que votre équipe saisit.",
      text: "Les dossiers attendent votre validation, les saisies d'un aide attendent votre accord, et un journal que vous pouvez consulter montre qui a fait quoi, et quand.",
      shots: [
        shot("charts-to-validate", "Liste des dossiers à valider, en brouillon ou en revue, avec Valider et Refuser", "Cabinet et Cabinet+ : les dossiers qui vous attendent, chacun avec Valider et Refuser."),
        shot("settings-security", "Réglages de sécurité avec le journal d'audit et les sessions", "Le journal d'activité s'ouvre depuis Paramètres, Sécurité."),
      ],
    },
    "day-close": {
      chip: "Clôture journalière",
      ed: "cabinet",
      title: "Clôturez la journée avec deux chiffres.",
      text: "Saisissez le montant compté en caisse et le total de votre terminal de carte. MeDoc calcule ce qui devrait s'y trouver d'après les encaissements du jour et affiche tout écart.",
      shots: [shot("cash-entries", "Formulaire de nouveau paiement, montant en MAD et mode de paiement", "Chaque paiement est enregistré avec son mode dès qu'il arrive. La clôture les additionne pour vous.")],
    },
    calendar: {
      chip: "Agenda glisser-déposer",
      ed: "all",
      title: "Déplacez un rendez-vous à la souris. MeDoc fait la place.",
      text: "Glissez un rendez-vous vers une autre heure ou un autre jour, en vue jour ou semaine. MeDoc le cale sur vos horaires, décale les rendez-vous suivants de ce praticien et vous permet d'annuler le déplacement.",
      shots: [
        shot("calendar-drag", "Vue semaine pendant le déplacement d'un rendez-vous", "En vue semaine, l'ancienne place s'estompe et la nouvelle heure s'affiche dans la marge."),
        shot("calendar-day", "Vue jour avec le statut de chaque rendez-vous", "La vue jour, avec le statut de chaque rendez-vous et un résumé de la journée."),
      ],
    },
    flags: {
      chip: "Conflits signalés",
      ed: "all",
      title: "Les erreurs se voient pendant la saisie, pas après.",
      text: "MeDoc vérifie chaque saisie au moment où vous la faites. Il refuse une double réservation, vous avertit d'un médicament auquel le patient est allergique et montre ce qui manque encore.",
      shots: [shot("appointment-new", "Formulaire de nouveau rendez-vous, heures indisponibles grisées", "Horaires et conflits vérifiés pendant que vous choisissez l'heure.")],
    },
    statistics: {
      chip: "Statistiques",
      ed: "all",
      title: "Sachez où en est le mois, en chiffres réels.",
      text: "Patients, nouveaux patients, rendez-vous, soins et recettes par mois, sur 6 ou 12 mois. Chaque chiffre clé montre son évolution par rapport au mois précédent.",
      shots: [shot("analytics", "Vue d'ensemble des statistiques avec l'évolution de chaque chiffre", "Chaque chiffre clé avec son évolution par rapport au mois précédent.")],
    },
    patients: {
      chip: "Vue patient",
      ed: "all",
      title: "Tout le patient sur un seul en-tête.",
      text: "Ouvrez un dossier : statut, facture ouverte, âge, téléphone, assurance et adresse d'un coup d'œil, avec un petit schéma dentaire et les données de base qui manquent.",
      shots: [shot("patient-record", "Dossier patient avec statut, facture ouverte, coordonnées et petit schéma dentaire", "Statut, facture ouverte, coordonnées, assurance et petit schéma dentaire sur un seul en-tête.")],
    },
    tasks: {
      chip: "Tâches pour l'accueil",
      ed: "cabinet",
      title: "Envoyez une tâche au lieu d'interrompre l'accueil.",
      text: "Depuis le dossier du patient, envoyez une tâche à tout l'accueil ou à une personne. Elle arrive dans sa liste de tâches et sa cloche de notifications, et vous retournez à votre patient.",
      shots: [shot("practice-tasks", "Liste des tâches du cabinet avec patient, type et statut", "Chaque tâche avec son patient, son type et son statut, dans une seule liste.")],
    },
    orders: {
      chip: "Commandes et dépenses",
      ed: "all",
      title: "Fournitures et dépenses d'un coup d'œil.",
      text: "Commandez chez vos fournisseurs à partir de modèles enregistrés et suivez chaque commande : ouverte, en transit, livrée. Le tableau de bord met sous vos yeux les commandes ouvertes et en retard.",
      shots: [
        shot("orders", "Commandes fournisseurs avec statut, date prévue et prix", "Ouvertes, en transit, en retard ou livrées, avec date prévue et prix."),
        shot("overview", "Tableau de bord avec validations en attente et commandes à vérifier", "Le tableau de bord signale les commandes en retard à vérifier."),
      ],
    },
    shortcuts: {
      chip: "Raccourcis clavier",
      ed: "all",
      title: "Gardez les mains sur le clavier.",
      text: "Appuyez sur ⌘K pour aller à n'importe quelle page ou créer un élément. Les actions courantes ont leur propre touche. Sous Windows, utilisez Ctrl à la place de ⌘.",
      shots: [],
    },
    "status-rules": {
      chip: "Règles de statut",
      ed: "all",
      title: "Chaque dossier suit des étapes claires. Rien ne revient en arrière par erreur.",
      text: "Rendez-vous, patients, dossiers, paiements et commandes ont chacun des statuts fixes et des étapes suivantes autorisées. MeDoc refuse les changements dans le désordre.",
      shots: [shot("appointment-detail", "Fiche du rendez-vous avec ses étapes : planifié, confirmé, en cours, terminé", "Le rendez-vous montre où il en est et propose l'étape suivante autorisée.")],
    },
    backups: {
      chip: "Sauvegardes",
      ed: "all",
      title: "Une sauvegarde chaque jour, sans que personne n'y pense.",
      text: "MeDoc Dentist sauvegarde le cabinet une fois par jour, tout seul, compressé et chiffré en AES-256-GCM. Envoyez la sauvegarde sur une clé USB ou un disque externe, radios et scans compris.",
      shots: [],
    },
    "tooth-chart": {
      chip: "Schéma dentaire",
      ed: "all",
      title: "Un schéma dentaire qui se lit d'un coup d'œil.",
      text: "Les 32 dents permanentes dans l'ordre FDI, le long d'une arcade, avec des contours distincts pour incisives, canines, prémolaires et molaires. Chaque statut a sa couleur et sa marque.",
      shots: [shot("examinations", "Examen avec le schéma dentaire et sa légende de couleurs", "Carie en rouge, soin prévu en pointillés : chaque statut a sa couleur et sa marque.")],
    },
  },
  keys: [
    { k: "⌘ K", d: "Aller à une page ou créer un élément" },
    { k: "⌘ N", d: "Nouveau rendez-vous" },
    { k: "⇧ ⌘ N", d: "Nouveau patient" },
    { k: "G", d: "Puis une lettre : aller droit à une rubrique" },
    { k: "D W M", d: "Agenda : vue jour, semaine ou mois" },
    { k: "T", d: "Agenda : revenir à aujourd'hui" },
    { k: "N", d: "Agenda : prendre un rendez-vous" },
    { k: "← →", d: "Agenda : avancer ou reculer dans le temps" },
    { k: "⌘ /", d: "Tous les raccourcis, dans l'Aide" },
  ],
  keep: {
    title: "Ce que MeDoc garde",
    days: "Les 3 derniers jours",
    week: "Une de la semaine dernière",
    half: "Une du dernier semestre",
    note: "Les plus anciennes sont supprimées automatiquement : le disque ne se remplit jamais.",
  },
  demo: {
    title: "Voyez-le fonctionner avant de décider.",
    text: "Pendant une démo gratuite, nous vous montrons l'agenda, les contrôles et la clôture journalière, et nous répondons à vos questions.",
    cta: "Réserver une démo gratuite",
  },
  editions: {
    title: "Quelle édition pour votre cabinet ?",
    text: "Essentiel pour un dentiste sur un ordinateur. Cabinet pour un dentiste avec accueil, sur 3 ordinateurs au plus. Cabinet+ pour 4 dentistes et 5 ordinateurs au plus.",
    price: (from) => `Licence à partir de ${from} HT, achetée une seule fois.`,
    cta: "Comparer les éditions",
  },
  security: {
    title: "Comment MeDoc Dentist protège les données des patients",
    text: "Le chiffrement sur disque, les rôles séparés et la chaîne d'audit sont expliqués sur la page Sécurité.",
    cta: "Lire la page Sécurité",
  },
};

export const productAr: ProductCopy = {
  title: "اثنتا عشرة طريقة يُسهّل بها MeDoc Dentist يومك.",
  lead: "شاشات حقيقية بمرضى وهميين. كل ميزة تذكر الإصدارات التي تشملها: Essentiel أو Cabinet أو Cabinet+.",
  nav: "في هذه الصفحة",
  docsChip: "الوثائق المغربية",
  ed: { all: "كل الإصدارات", cabinet: "Cabinet وCabinet+", plus: "Cabinet+", essentiel: "Essentiel" },
  features: {
    changes: {
      chip: "المصادقة والسجل",
      ed: "all",
      title: "تابِع ما يُدخله فريقك.",
      text: "الملفات تنتظر مصادقتك، وما يُدخله المساعد ينتظر موافقتك، وسجلّ يمكنك مراجعته يبيّن من فعل ماذا، ومتى.",
      shots: [
        shot("charts-to-validate", "قائمة الملفات بانتظار المصادقة، مسودة أو قيد المراجعة، مع زرّي المصادقة والرفض", "Cabinet وCabinet+: الملفات التي تنتظرك، لكل منها زرّا المصادقة والرفض."),
        shot("settings-security", "إعدادات الأمان مع سجل التدقيق وجلسات الأجهزة", "يُفتح سجل النشاط من الإعدادات، قسم الأمان."),
      ],
    },
    "day-close": {
      chip: "إغلاق اليوم",
      ed: "cabinet",
      title: "أغلِق اليوم برقمين.",
      text: "أدخل المبلغ النقدي الذي عددته ومجموع جهاز الدفع بالبطاقة. يحسب MeDoc ما يجب أن يكون في الصندوق من تحصيلات اليوم، ويُظهر أي فرق.",
      shots: [shot("cash-entries", "نموذج دفعة جديدة بالمبلغ بالدرهم وطريقة الدفع", "تُسجَّل كل دفعة مع طريقتها فور وصولها، ويجمعها إغلاق اليوم من أجلك.")],
    },
    calendar: {
      chip: "مواعيد بالسحب والإفلات",
      ed: "all",
      title: "انقل الموعد بالفأرة، ويُفسح MeDoc المكان.",
      text: "اسحب الموعد إلى وقت أو يوم آخر في عرض اليوم أو الأسبوع. يضبطه MeDoc على ساعات العمل، ويؤخّر المواعيد التالية للطبيب نفسه، ويتيح لك التراجع.",
      shots: [
        shot("calendar-drag", "عرض الأسبوع أثناء سحب موعد إلى وقت جديد", "في عرض الأسبوع يبهت المكان القديم ويظهر الوقت الجديد في الهامش."),
        shot("calendar-day", "عرض اليوم مع حالة كل موعد", "عرض اليوم، مع حالة كل موعد وملخص اليوم."),
      ],
    },
    flags: {
      chip: "تنبيه التعارضات",
      ed: "all",
      title: "الأخطاء تظهر أثناء العمل، لا بعده.",
      text: "يفحص MeDoc كل إدخال لحظة كتابته: يرفض الحجز المزدوج، وينبّهك إلى دواء لدى المريض حساسية منه، ويُظهر ما لا يزال ناقصًا.",
      shots: [shot("appointment-new", "نموذج موعد جديد مع الأوقات غير المتاحة باللون الرمادي", "تُفحص ساعات العمل والتعارضات أثناء اختيار الوقت.")],
    },
    statistics: {
      chip: "الإحصاءات",
      ed: "all",
      title: "اعرف كيف يسير الشهر، بأرقام حقيقية.",
      text: "المرضى، والمرضى الجدد، والمواعيد، والعلاجات، والمداخيل شهرًا بشهر، على 6 أو 12 شهرًا. كل رقم أساسي يُظهر تغيّره مقارنة بالشهر الماضي.",
      shots: [shot("analytics", "نظرة عامة على الإحصاءات مع تغيّر كل رقم مقارنة بالشهر الماضي", "كل رقم أساسي مع تغيّره مقارنة بالشهر الماضي.")],
    },
    patients: {
      chip: "نظرة على المريض",
      ed: "all",
      title: "المريض كله في رأس صفحة واحد.",
      text: "افتح الملف لترى دفعة واحدة الحالة، والفاتورة المفتوحة، والعمر، والهاتف، والتأمين، والعنوان، مع مخطط أسنان صغير والبيانات الأساسية الناقصة.",
      shots: [shot("patient-record", "ملف مريض مع الحالة والفاتورة المفتوحة وبيانات الاتصال ومخطط أسنان صغير", "الحالة والفاتورة المفتوحة والاتصال والتأمين ومخطط أسنان صغير في رأس صفحة واحد.")],
    },
    tasks: {
      chip: "مهام للاستقبال",
      ed: "cabinet",
      title: "أرسل مهمة بدل أن تقاطع الاستقبال.",
      text: "من ملف المريض، أرسل مهمة إلى الاستقبال كله أو إلى شخص واحد. تصل إلى قائمة مهامه وجرس الإشعارات، وتعود أنت إلى مريضك.",
      shots: [shot("practice-tasks", "قائمة مهام العيادة مع المريض والنوع والحالة", "كل مهمة مع مريضها ونوعها وحالتها، في قائمة واحدة.")],
    },
    orders: {
      chip: "الطلبيات والمصاريف",
      ed: "all",
      title: "اللوازم والمصاريف في لمحة.",
      text: "اطلب من مورّديك انطلاقًا من نماذج محفوظة، وتابع كل طلبية: مفتوحة، ثم قيد الشحن، ثم مستلمة. ولوحة القيادة تضع أمامك الطلبيات المفتوحة والمتأخرة.",
      shots: [
        shot("orders", "طلبيات المورّدين مع الحالة والتاريخ المتوقع والسعر", "مفتوحة أو قيد الشحن أو متأخرة أو مستلمة، مع التاريخ المتوقع والسعر."),
        shot("overview", "لوحة القيادة مع ما ينتظر المصادقة والطلبيات التي يجب التحقق منها", "لوحة القيادة تُظهر الطلبيات المتأخرة التي يجب التحقق منها."),
      ],
    },
    shortcuts: {
      chip: "اختصارات لوحة المفاتيح",
      ed: "all",
      title: "أبقِ يديك على لوحة المفاتيح.",
      text: "اضغط ⌘K للانتقال إلى أي صفحة أو لبدء شيء جديد. ولأكثر الإجراءات استعمالًا مفاتيحها الخاصة. في Windows استعمل Ctrl بدل ⌘.",
      shots: [],
    },
    "status-rules": {
      chip: "قواعد الحالات",
      ed: "all",
      title: "لكل ملف خطوات واضحة، ولا شيء يعود إلى الوراء خطأً.",
      text: "للمواعيد والمرضى والملفات الطبية والمدفوعات والطلبيات حالات ثابتة وخطوات تالية مسموح بها، ويرفض MeDoc أي تغيير خارج الترتيب.",
      shots: [shot("appointment-detail", "لوحة الموعد مع خطواته: مخطط، مؤكد، جارٍ، مكتمل", "يُظهر الموعد أين وصل، ويقترح الخطوة التالية المسموح بها.")],
    },
    backups: {
      chip: "النسخ الاحتياطية",
      ed: "all",
      title: "نسخة احتياطية كل يوم، دون أن يتذكّرها أحد.",
      text: "يأخذ MeDoc Dentist نسخة احتياطية من العيادة مرة في اليوم من تلقاء نفسه، مضغوطة ومشفّرة بـ AES-256-GCM. احفظها على مفتاح USB أو قرص خارجي، مع صور الأشعة والمسوح.",
      shots: [],
    },
    "tooth-chart": {
      chip: "مخطط الأسنان",
      ed: "all",
      title: "مخطط أسنان يُقرأ بنظرة واحدة.",
      text: "الأسنان الدائمة الـ32 بترتيب FDI على قوس منحنٍ، بأشكال مميّزة للقواطع والأنياب والضواحك والأضراس. لكل حالة لونها وعلامتها.",
      shots: [shot("examinations", "فحص مع مخطط الأسنان ودليل ألوانه", "التسوّس بالأحمر والعلاج المخطط بخط متقطع: لكل حالة لونها وعلامتها.")],
    },
  },
  keys: [
    { k: "⌘ K", d: "الانتقال إلى أي صفحة أو نموذج جديد" },
    { k: "⌘ N", d: "موعد جديد" },
    { k: "⇧ ⌘ N", d: "مريض جديد" },
    { k: "G", d: "ثم حرف: انتقال مباشر إلى قسم" },
    { k: "D W M", d: "المواعيد: عرض اليوم أو الأسبوع أو الشهر" },
    { k: "T", d: "المواعيد: العودة إلى اليوم" },
    { k: "N", d: "المواعيد: حجز موعد" },
    { k: "← →", d: "المواعيد: التنقل في الزمن" },
    { k: "⌘ /", d: "كل الاختصارات، في المساعدة" },
  ],
  keep: {
    title: "ما يحتفظ به MeDoc",
    days: "آخر 3 أيام",
    week: "نسخة من الأسبوع الماضي",
    half: "نسخة من آخر نصف سنة",
    note: "تُحذف النسخ الأقدم تلقائيًا، فلا يمتلئ القرص أبدًا.",
  },
  demo: {
    title: "شاهده يعمل قبل أن تقرّر.",
    text: "في عرض مجاني نريك المواعيد والتنبيهات وإغلاق اليوم، ونجيب عن أسئلتك.",
    cta: "احجز عرضًا مجانيًا",
  },
  editions: {
    title: "أي إصدار يناسب عيادتك؟",
    text: "Essentiel لطبيب أسنان واحد على حاسوب واحد. Cabinet لطبيب أسنان مع الاستقبال، على 3 حواسيب كحد أقصى. Cabinet+ لما يصل إلى 4 أطباء أسنان و5 حواسيب.",
    price: (from) => `الترخيص ابتداءً من ${from} دون احتساب الضريبة، تشتريه مرة واحدة.`,
    cta: "قارن الإصدارات",
  },
  security: {
    title: "كيف يحمي MeDoc Dentist بيانات المرضى",
    text: "التشفير على القرص، والأدوار المنفصلة، وسلسلة التدقيق مشروحة في صفحة الأمان.",
    cta: "اقرأ صفحة الأمان",
  },
};
