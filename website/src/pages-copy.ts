import type { Lang } from "./i18n";

/** Copy for the page structure (nav, home highlights, privacy band) and the Security page. */
type Fact = { t: string; d: string };
/** Home “look inside” card: product screenshot (`img`) or practice photo (`photo`). */
type Card = { id: string; img?: string; photo?: string; t: string; d: string; alt?: string };
export type PagesCopy = {
  nav: { features: string; security: string };
  by: string;
  photoAlt: { hero: string; team: string; tablet: string; xray: string; clinic: string; desk: string; reception: string };
  highlights: { title: string; lead: string; more: string; cards: Card[] };
  band: { kicker: string; title: string; text: string; points: string[]; more: string };
  features: { kicker: string };
  /** The demo e-mail the form prepares in the visitor's own mail app. */
  mail: {
    hello: string;
    intro: string;
    contact: string;
    request: string;
    noMessage: string;
    details: string;
    language: string;
    sentFrom: string;
    regards: string;
    copy: string;
    copied: string;
    sending: string;
    sent: string;
    needCheck: string;
    blocked: string;
    rate: string;
    fallback: string;
  };
  security: {
    meta: string;
    kicker: string;
    title: string;
    lead: string;
    where: { title: string; text: string };
    roles: { title: string; text: string; reception: string; dentist: string };
    protect: { title: string; items: Fact[] };
    notYet: { title: string; lead: string; items: Fact[] };
    law: { title: string; text: string };
    maker: { title: string; text: string; link: string };
  };
};

const CARD_IMG = {
  calendar: "product/calendar-week-1000.webp",
  clinical: "product/treatments-1000.webp",
  money: "product/finance-1000.webp",
  papers: "product/prescriptions-1000.webp",
};

const en: PagesCopy = {
  nav: { features: "Features", security: "Security" },
  by: "by Sifra Labs",
  photoAlt: {
    hero: "A dentist examining a smiling patient's teeth in a dental chair.",
    team: "Two clinicians reviewing a file while a receptionist works at the front desk.",
    tablet: "A dentist showing a patient her X-ray on a tablet.",
    xray: "A dentist examining dental X-ray scans on a light box.",
    clinic: "A bright dental treatment room with a chair and lamp.",
    desk: "A dentist working at a computer in the practice.",
    reception: "A receptionist with a notebook speaking with a patient at the front desk.",
  },
  highlights: {
    title: "See the program and the practice day",
    lead: "Real screens and real rooms. Open any card for the full feature.",
    more: "See all features",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "Calendar", d: "Month, week and day views, with drag and drop." },
      { id: "clinical", img: CARD_IMG.clinical, t: "Tooth chart", d: "Examinations and treatments on an FDI chart." },
      { id: "patients", photo: "dentist-computer", alt: "desk", t: "At the desk", d: "The patient file stays on your computer, not in a cloud." },
      { id: "papers", img: CARD_IMG.papers, t: "Prescriptions", d: "Prescriptions and certificates, in French and Arabic." },
      { id: "money", img: CARD_IMG.money, t: "Payments", d: "Receipts and invoices, plus the day close in Cabinet and Cabinet+." },
      { id: "changes", photo: "reception-desk", alt: "reception", t: "At reception", d: "Bookings and the till, without the medical chart." },
    ],
  },
  band: {
    kicker: "Privacy",
    title: "Reception and dentist see different things",
    text: "Reception books, bills and files. By default the medical chart stays with the dentist, and every time it is opened, MeDoc Dentist records who and when.",
    points: ["Encrypted on your own computers", "Every medical read is logged", "Works without internet"],
    more: "How MeDoc Dentist protects data",
  },
  features: { kicker: "Features" },
  mail: {
    hello: "Hello Sifra Labs team,",
    intro: "I would like a demo of MeDoc Dentist for our practice.",
    contact: "Contact",
    request: "Request",
    noMessage: "No specific request: please show us a typical day.",
    details: "Details",
    language: "Language",
    sentFrom: "Sent from the MeDoc Dentist website on",
    regards: "Best regards,",
    copy: "Copy the e-mail",
    copied: "Copied",
    sending: "Sending…",
    sent: "Thank you. Your request is on its way to our team, and we will call or write back within two working days.",
    needCheck: "Complete the security check above, then press Send again.",
    blocked: "The form could not be sent (security check). Refresh the page, complete the check, and try once more.",
    rate: "Too many tries from this network. Wait about an hour, then try again — or write to contact@sifralabs.com.",
    fallback: "We couldn't send it from the website just now, so your e-mail app is opening with the message ready: press Send there. Nothing opened? Copy the e-mail and send it to",
  },
  security: {
    meta: "Security and privacy · MeDoc Dentist",
    kicker: "Security",
    title: "Your patients' records stay in your practice",
    lead: "MeDoc Dentist keeps its database encrypted on your own computers, shows each person only what their job needs, and records who opened what. Here is how, and what is not done yet.",
    where: {
      title: "Where the data lives",
      text: "On the practice's own computers, in an encrypted database. Nothing is sent to Sifra Labs, and nothing goes to a cloud. When the internet is down, the practice keeps working.",
    },
    roles: {
      title: "Reception and dentist see different things",
      text: "Reception books, bills and files. By default, the medical chart, examinations and notes stay with the dentist, and the software enforces this, not only the screen. Reception accounts come with Cabinet and Cabinet+; in Essentiel, the guest account follows the same rule.",
      reception: "What reception sees",
      dentist: "What the dentist sees",
    },
    protect: {
      title: "What protects the data",
      items: [
        { t: "Encryption at rest", d: "The whole database is encrypted with SQLCipher (AES-256). The key stays in the computer's secure keychain, not next to the data." },
        { t: "Audit trail", d: "Opening a medical record and sensitive changes are logged in a chain sealed with HMAC, so later edits to the log show." },
        { t: "Daily backups", d: "One encrypted backup a day, attachments included, to a folder you choose, such as a USB or external drive." },
        { t: "Practice network", d: "Cabinet and Cabinet+: the practice computers share one database over your local network, encrypted and with every change signed." },
        { t: "Own accounts", d: "Everyone signs in with their own password, stored only as an Argon2id hash. After 5 wrong attempts the account locks for 15 minutes, and a session closes after 30 minutes without activity." },
        { t: "Patients' rights", d: "Export or erase a patient's data, and generate the processing register and impact assessment." },
      ],
    },
    notYet: {
      title: "Not done yet",
      lead: "On the roadmap. Until they ship, we don't claim them.",
      items: [
        { t: "Two-factor sign-in", d: "In preparation. Today you sign in with your e-mail and password." },
        { t: "Signed installers", d: "Windows and macOS may warn at install; signing certificates are in progress." },
        { t: "Independent audit", d: "No certification or penetration test yet." },
        { t: "Emergency access", d: "No “break-glass” access to a chart outside the normal roles." },
      ],
    },
    law: {
      title: "Law 09-08 and the CNDP",
      text: "MeDoc Dentist gives you the tools; the practice stays responsible for its declaration to the CNDP. The Compliance page in MeDoc Dentist shows backup and log status, and a Law 09-08 checklist of who ticked what and when.",
    },
    maker: {
      title: "Made by Sifra Labs",
      text: "MeDoc Dentist is built and maintained by Sifra Labs. Found a security problem? Write to security@sifralabs.com.",
      link: "Sifra Labs security policy",
    },
  },
};

const fr: PagesCopy = {
  nav: { features: "Fonctionnalités", security: "Sécurité" },
  by: "par Sifra Labs",
  photoAlt: {
    hero: "Une dentiste examine les dents d'un patient souriant, installé dans le fauteuil.",
    team: "Deux soignantes consultent un dossier pendant qu'une secrétaire travaille à l'accueil.",
    tablet: "Un dentiste montre sa radiographie à une patiente sur une tablette.",
    xray: "Un dentiste examine des radiographies dentaires sur un négatoscope.",
    clinic: "Une salle de soins dentaires lumineuse avec fauteuil et scialytique.",
    desk: "Un dentiste travaille sur un ordinateur au cabinet.",
    reception: "Une réceptionniste avec un carnet parle à un patient au comptoir.",
  },
  highlights: {
    title: "Voir le logiciel et la journée du cabinet",
    lead: "Vrais écrans et vraies salles. Ouvrez une carte pour la fonction complète.",
    more: "Voir toutes les fonctionnalités",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "Agenda", d: "Vues mois, semaine et jour, avec glisser-déposer." },
      { id: "clinical", img: CARD_IMG.clinical, t: "Schéma dentaire", d: "Examens et soins sur un schéma FDI." },
      { id: "patients", photo: "dentist-computer", alt: "desk", t: "Au bureau", d: "Le dossier patient reste sur votre ordinateur, pas dans un cloud." },
      { id: "papers", img: CARD_IMG.papers, t: "Ordonnances", d: "Ordonnances et certificats, en français et en arabe." },
      { id: "money", img: CARD_IMG.money, t: "Encaissements", d: "Reçus et factures, plus la clôture de caisse en Cabinet et Cabinet+." },
      { id: "changes", photo: "reception-desk", alt: "reception", t: "À l'accueil", d: "Les rendez-vous et la caisse, sans le dossier médical." },
    ],
  },
  band: {
    kicker: "Confidentialité",
    title: "L'accueil et le dentiste ne voient pas la même chose",
    text: "L'accueil prend les rendez-vous, encaisse et classe. Par défaut, le dossier médical reste au dentiste, et chaque ouverture est enregistrée : qui et quand.",
    points: ["Chiffré sur vos propres ordinateurs", "Chaque lecture médicale est journalisée", "Fonctionne sans internet"],
    more: "Comment MeDoc Dentist protège les données",
  },
  features: { kicker: "Fonctionnalités" },
  mail: {
    hello: "Bonjour l'équipe Sifra Labs,",
    intro: "Je souhaite une démonstration de MeDoc Dentist pour notre cabinet.",
    contact: "Coordonnées",
    request: "Demande",
    noMessage: "Pas de demande particulière : montrez-nous une journée type.",
    details: "Détails",
    language: "Langue",
    sentFrom: "Envoyé depuis le site MeDoc Dentist le",
    regards: "Bien cordialement,",
    copy: "Copier l'e-mail",
    copied: "Copié",
    sending: "Envoi…",
    sent: "Merci. Votre demande est partie vers notre équipe : nous vous appelons ou vous écrivons sous deux jours ouvrés.",
    needCheck: "Terminez le contrôle de sécurité ci-dessus, puis renvoyez.",
    blocked: "Envoi bloqué (contrôle de sécurité). Rechargez la page, validez le contrôle, puis réessayez une fois.",
    rate: "Trop d'essais depuis ce réseau. Attendez environ une heure, puis réessayez — ou écrivez à contact@sifralabs.com.",
    fallback: "L'envoi depuis le site n'a pas abouti : votre application e-mail s'ouvre avec le message prêt, cliquez sur Envoyer. Rien ne s'est ouvert ? Copiez l'e-mail et envoyez-le à",
  },
  security: {
    meta: "Sécurité et confidentialité · MeDoc Dentist",
    kicker: "Sécurité",
    title: "Les dossiers de vos patients restent dans votre cabinet",
    lead: "MeDoc Dentist garde sa base de données chiffrée sur vos propres ordinateurs, ne montre à chacun que ce dont son métier a besoin et enregistre qui a ouvert quoi. Voici comment, et ce qui n'est pas encore fait.",
    where: {
      title: "Où sont les données",
      text: "Sur les ordinateurs du cabinet, dans une base chiffrée. Rien n'est envoyé à Sifra Labs, et rien ne part dans un cloud. Quand internet tombe, le cabinet continue de travailler.",
    },
    roles: {
      title: "L'accueil et le dentiste ne voient pas la même chose",
      text: "L'accueil prend les rendez-vous, encaisse et classe. Par défaut, le dossier médical, les examens et les notes restent au dentiste, et le logiciel l'impose, pas seulement l'écran. Les comptes accueil viennent avec Cabinet et Cabinet+ ; en Essentiel, le compte invité suit la même règle.",
      reception: "Ce que voit l'accueil",
      dentist: "Ce que voit le dentiste",
    },
    protect: {
      title: "Ce qui protège les données",
      items: [
        { t: "Chiffrement au repos", d: "Toute la base est chiffrée avec SQLCipher (AES-256). La clé reste dans le trousseau sécurisé de l'ordinateur, pas à côté des données." },
        { t: "Journal d'audit", d: "L'ouverture d'un dossier médical et les modifications sensibles sont inscrites dans une chaîne scellée par HMAC : une retouche du journal se voit." },
        { t: "Sauvegarde quotidienne", d: "Une sauvegarde chiffrée par jour, pièces jointes comprises, dans le dossier de votre choix, par exemple une clé USB ou un disque externe." },
        { t: "Réseau du cabinet", d: "Cabinet et Cabinet+ : les ordinateurs du cabinet partagent une seule base sur votre réseau local, chiffrée, chaque modification étant signée." },
        { t: "Comptes personnels", d: "Chacun se connecte avec son propre mot de passe, conservé uniquement sous forme de hachage Argon2id. Après 5 essais erronés, le compte se bloque 15 minutes, et une session se ferme après 30 minutes d'inactivité." },
        { t: "Droits des patients", d: "Exporter ou effacer les données d'un patient, et générer le registre des traitements et l'analyse d'impact." },
      ],
    },
    notYet: {
      title: "Pas encore fait",
      lead: "C'est sur la feuille de route. Tant que ce n'est pas livré, nous ne le promettons pas.",
      items: [
        { t: "Double authentification", d: "En préparation. Aujourd'hui, vous vous connectez avec votre e-mail et votre mot de passe." },
        { t: "Installateurs signés", d: "Windows et macOS peuvent afficher un avertissement à l'installation ; les certificats de signature sont en cours." },
        { t: "Audit indépendant", d: "Pas encore de certification ni de test d'intrusion." },
        { t: "Accès d'urgence", d: "Pas d'accès « bris de glace » à un dossier en dehors des rôles habituels." },
      ],
    },
    law: {
      title: "Loi 09-08 et CNDP",
      text: "MeDoc Dentist vous donne les outils ; le cabinet reste responsable de sa déclaration à la CNDP. La page Conformité de MeDoc Dentist montre l'état des sauvegardes et du journal, et une liste de contrôle loi 09-08 indiquant qui a coché quoi et quand.",
    },
    maker: {
      title: "Conçu par Sifra Labs",
      text: "MeDoc Dentist est développé et maintenu par Sifra Labs. Vous avez trouvé un problème de sécurité ? Écrivez à security@sifralabs.com.",
      link: "Politique de sécurité de Sifra Labs",
    },
  },
};

const ar: PagesCopy = {
  nav: { features: "الميزات", security: "الأمان" },
  by: "من Sifra Labs",
  photoAlt: {
    hero: "طبيبة أسنان تفحص أسنان مريض مبتسم جالس على كرسي العلاج.",
    team: "طبيبتان تراجعان ملفًا بينما تعمل موظفة الاستقبال في المكتب.",
    tablet: "طبيب أسنان يعرض على مريضة صورتها الشعاعية على جهاز لوحي.",
    xray: "طبيب أسنان يفحص صورًا شعاعية للأسنان على لوح مضيء.",
    clinic: "غرفة علاج أسنان مضيئة فيها كرسي ومصباح.",
    desk: "طبيب أسنان يعمل على حاسوب في العيادة.",
    reception: "موظفة استقبال بدفتر تتحدث مع مريض عند المكتب.",
  },
  highlights: {
    title: "شاهد البرنامج ويوم العيادة",
    lead: "شاشات حقيقية وقاعات حقيقية. افتح أي بطاقة للميزة كاملة.",
    more: "عرض كل الميزات",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "المواعيد", d: "عرض الشهر والأسبوع واليوم، مع السحب والإفلات." },
      { id: "clinical", img: CARD_IMG.clinical, t: "مخطط الأسنان", d: "الفحوصات والعلاجات على مخطط FDI." },
      { id: "patients", photo: "dentist-computer", alt: "desk", t: "على المكتب", d: "ملف المريض يبقى على حاسوبك، لا في السحابة." },
      { id: "papers", img: CARD_IMG.papers, t: "الوصفات", d: "الوصفات والشهادات بالفرنسية والعربية." },
      { id: "money", img: CARD_IMG.money, t: "المدفوعات", d: "الإيصالات والفواتير، وإغلاق الصندوق في Cabinet وCabinet+." },
      { id: "changes", photo: "reception-desk", alt: "reception", t: "في الاستقبال", d: "الحجوزات والصندوق، دون الملف الطبي." },
    ],
  },
  band: {
    kicker: "السرية",
    title: "الاستقبال والطبيب لا يريان الشيء نفسه",
    text: "يحجز الاستقبال المواعيد ويحصّل ويرتّب الملفات. افتراضيًا يبقى الملف الطبي عند الطبيب، وكل مرة يُفتح فيها يسجّل MeDoc Dentist من فتحه ومتى.",
    points: ["مشفّر على حواسيبكم", "كل قراءة طبية مسجّلة", "يعمل دون إنترنت"],
    more: "كيف يحمي MeDoc Dentist البيانات",
  },
  features: { kicker: "الميزات" },
  mail: {
    hello: "مرحبًا فريق Sifra Labs،",
    intro: "أرغب في عرض تجريبي لبرنامج MeDoc Dentist لعيادتنا.",
    contact: "معلومات الاتصال",
    request: "الطلب",
    noMessage: "لا طلب خاص: أرونا يومًا عاديًا في العيادة.",
    details: "تفاصيل",
    language: "اللغة",
    sentFrom: "أُرسل من موقع MeDoc Dentist بتاريخ",
    regards: "مع أطيب التحيات،",
    copy: "نسخ الرسالة",
    copied: "تم النسخ",
    sending: "جارٍ الإرسال…",
    sent: "شكرًا. وصل طلبكم إلى فريقنا، وسنتصل بكم أو نراسلكم خلال يومَي عمل.",
    needCheck: "أكملوا التحقق الأمني أعلاه ثم اضغطوا إرسال مرة أخرى.",
    blocked: "تعذّر الإرسال (التحقق الأمني). حدّثوا الصفحة، أكملوا التحقق، ثم حاولوا مرة واحدة.",
    rate: "محاولات كثيرة من هذه الشبكة. انتظروا حوالي ساعة ثم أعيدوا المحاولة — أو راسلوا contact@sifralabs.com.",
    fallback: "تعذّر الإرسال من الموقع الآن، لذلك يُفتح تطبيق البريد لديكم والرسالة جاهزة: اضغطوا إرسال. لم يُفتح شيء؟ انسخوا الرسالة وأرسلوها إلى",
  },
  security: {
    meta: "الأمان والسرية · MeDoc Dentist",
    kicker: "الأمان",
    title: "ملفات مرضاكم تبقى داخل عيادتكم",
    lead: "يحفظ MeDoc Dentist قاعدة بياناته مشفّرة على حواسيبكم، ولا يُظهر لكل شخص إلا ما يحتاجه عمله، ويسجّل من فتح ماذا. إليكم الطريقة، وما لم يُنجز بعد.",
    where: {
      title: "أين توجد البيانات",
      text: "على حواسيب العيادة، في قاعدة بيانات مشفّرة. لا يُرسل شيء إلى Sifra Labs، ولا يذهب شيء إلى السحابة. وعندما ينقطع الإنترنت، تواصل العيادة عملها.",
    },
    roles: {
      title: "الاستقبال والطبيب لا يريان الشيء نفسه",
      text: "يحجز الاستقبال المواعيد ويحصّل ويرتّب الملفات. افتراضيًا تبقى الملفات الطبية والفحوصات والملاحظات عند الطبيب، والبرنامج نفسه يفرض ذلك، لا الشاشة فقط. تأتي حسابات الاستقبال مع Cabinet وCabinet+، وفي Essentiel يخضع حساب الضيف للقاعدة نفسها.",
      reception: "ما يراه الاستقبال",
      dentist: "ما يراه الطبيب",
    },
    protect: {
      title: "ما يحمي البيانات",
      items: [
        { t: "التشفير أثناء التخزين", d: "قاعدة البيانات كلها مشفّرة بـ SQLCipher (AES-256). ويبقى المفتاح في سلسلة المفاتيح الآمنة للحاسوب، لا بجانب البيانات." },
        { t: "سجل التدقيق", d: "فتح الملف الطبي والتعديلات الحساسة تُسجَّل في سلسلة مختومة بـ HMAC، فيظهر أي تعديل لاحق على السجل." },
        { t: "نسخة احتياطية يومية", d: "نسخة مشفّرة كل يوم، مع المرفقات، في مجلد تختارونه مثل مفتاح USB أو قرص خارجي." },
        { t: "شبكة العيادة", d: "في Cabinet وCabinet+: تتشارك حواسيب العيادة قاعدة بيانات واحدة عبر شبكتكم المحلية، مشفّرة ومع توقيع كل تغيير." },
        { t: "حسابات شخصية", d: "يدخل كل شخص بكلمة مروره الخاصة، ولا تُحفظ إلا بتجزئة Argon2id. بعد 5 محاولات خاطئة يُقفل الحساب 15 دقيقة، وتُغلق الجلسة بعد 30 دقيقة دون نشاط." },
        { t: "حقوق المرضى", d: "تصدير بيانات المريض أو حذفها، وإنشاء سجل المعالجات وتقييم الأثر." },
      ],
    },
    notYet: {
      title: "لم يُنجز بعد",
      lead: "هذه في خطة العمل. ولا نَعِد بها قبل أن تصدر.",
      items: [
        { t: "التحقق بخطوتين", d: "قيد الإعداد. يتم الدخول اليوم بالبريد الإلكتروني وكلمة المرور." },
        { t: "برامج تثبيت موقَّعة", d: "قد يُظهر Windows وmacOS تحذيرًا عند التثبيت؛ شهادات التوقيع قيد الإعداد." },
        { t: "تدقيق مستقل", d: "لا توجد بعد شهادة ولا اختبار اختراق." },
        { t: "وصول الطوارئ", d: "لا يوجد وصول طارئ إلى ملف خارج الأدوار المعتادة." },
      ],
    },
    law: {
      title: "القانون 09-08 واللجنة الوطنية",
      text: "يمنحكم MeDoc Dentist الأدوات، وتبقى العيادة مسؤولة عن تصريحها لدى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي. تُظهر صفحة المطابقة في MeDoc Dentist حالة النسخ الاحتياطية والسجل، وقائمة مراجعة القانون 09-08 بمن أشّر على ماذا ومتى.",
    },
    maker: {
      title: "من تطوير Sifra Labs",
      text: "تطوّر Sifra Labs برنامج MeDoc Dentist وتصونه. وجدتم مشكلة أمنية؟ راسلونا على security@sifralabs.com.",
      link: "سياسة الأمان لدى Sifra Labs",
    },
  },
};

export const PAGES_COPY: Record<Lang, PagesCopy> = { en, fr, ar };
