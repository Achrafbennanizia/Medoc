import type { Lang } from "./i18n";

/** Copy for the page structure (nav, home highlights, privacy band) and the Security page. */
type Fact = { t: string; d: string };
type Card = { id: string; img: string; t: string; d: string };
export type PagesCopy = {
  nav: { features: string; security: string; home: string };
  by: string;
  photoAlt: { hero: string; team: string; tablet: string; xray: string; clinic: string };
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
    country: string;
    sentFrom: string;
    regards: string;
    opened: string;
    copy: string;
    copied: string;
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
  nav: { features: "Features", security: "Security", home: "Home" },
  by: "by Sifra Labs",
  photoAlt: {
    hero: "A dentist examining a smiling patient's teeth in a dental chair.",
    team: "Two clinicians reviewing a file while a receptionist works at the front desk.",
    tablet: "A dentist showing a patient her X-ray on a tablet.",
    xray: "A dentist examining dental X-ray scans on a light box.",
    clinic: "A bright dental treatment room with a chair and lamp.",
  },
  highlights: {
    title: "Everything the practice does in a day",
    lead: "From the first call to the day close, in one program.",
    more: "See all features",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "Calendar", d: "Month, week and day views, with drag and drop." },
      { id: "clinical", img: CARD_IMG.clinical, t: "Tooth chart", d: "Examinations and treatments on an FDI chart." },
      { id: "money", img: CARD_IMG.money, t: "Payments", d: "Receipts, invoices and the day close." },
      { id: "papers", img: CARD_IMG.papers, t: "Prescriptions", d: "Prescriptions and certificates, in French and Arabic." },
    ],
  },
  band: {
    kicker: "Privacy",
    title: "Reception and dentist see different things",
    text: "Reception books, bills and files. The medical chart stays with the dentist, and every time it is opened, MeDoc records who and when.",
    points: ["Encrypted on your own computers", "Every medical read is logged", "Works without internet"],
    more: "How MeDoc protects data",
  },
  features: { kicker: "Features" },
  mail: {
    hello: "Hello Sifra Labs team,",
    intro: "I would like a demo of MeDoc for our practice.",
    contact: "Contact",
    request: "Request",
    noMessage: "No specific request: please show us a typical day.",
    details: "Details",
    language: "Language",
    country: "Country",
    sentFrom: "Sent from the MeDoc website on",
    regards: "Best regards,",
    opened: "Your e-mail app should now open with the message ready: check it and press Send. Nothing opened? Copy the e-mail and send it to",
    copy: "Copy the e-mail",
    copied: "Copied",
  },
  security: {
    meta: "Security and privacy · MeDoc",
    kicker: "Security",
    title: "Your patients' records stay in your practice",
    lead: "MeDoc keeps its database encrypted on your own computers, shows each person only what their job needs, and records who opened what. Here is how, and what is not done yet.",
    where: {
      title: "Where the data lives",
      text: "On the practice's own computers, in an encrypted database. Nothing is sent to MeDoc or Sifra Labs, and nothing goes to a cloud. When the internet is down, the practice keeps working.",
    },
    roles: {
      title: "Reception and dentist see different things",
      text: "Reception books, bills and files. The medical chart, examinations and notes stay with the dentist. The rule is checked in the core of the software, not only hidden on screen.",
      reception: "What reception sees",
      dentist: "What the dentist sees",
    },
    protect: {
      title: "What protects the data",
      items: [
        { t: "Encryption at rest", d: "The whole database is encrypted with SQLCipher (AES-256). A copied disk or a stolen laptop shows nothing readable." },
        { t: "Audit trail", d: "Opening a medical record and sensitive changes are logged in a chain sealed with HMAC, so later edits to the log show." },
        { t: "Daily backups", d: "One encrypted backup a day, attachments included, to a folder you choose, such as a USB or external drive." },
        { t: "Practice network", d: "Computers in the practice talk over the local network with TLS and check the server's certificate fingerprint." },
        { t: "Own accounts", d: "Everyone signs in with their own account. Passwords are hashed with Argon2, and the screen locks after a period of inactivity." },
        { t: "Patients' rights", d: "Export or erase a patient's data, and generate the processing register and impact assessment." },
      ],
    },
    notYet: {
      title: "Not done yet",
      lead: "On the roadmap. Until they ship, we don't claim them.",
      items: [
        { t: "Two-factor sign-in", d: "Built but switched off until fully tested. Passkeys, Face ID and fingerprint come after." },
        { t: "Signed installers", d: "Windows and macOS may warn at install; signing certificates are in progress." },
        { t: "Independent audit", d: "No certification or penetration test yet." },
        { t: "Emergency access", d: "No “break-glass” access to a chart outside the normal roles." },
      ],
    },
    law: {
      title: "Loi 09-08 and the GDPR",
      text: "MeDoc gives you the tools; the practice stays responsible for its declaration to the CNDP in Morocco, or its records under the GDPR in Europe. The Compliance page in MeDoc shows backup and log status, and a checklist of who ticked what and when.",
    },
    maker: {
      title: "Made by Sifra Labs",
      text: "MeDoc is built and maintained by Sifra Labs. Found a security problem? Write to security@sifralabs.com.",
      link: "Sifra Labs security policy",
    },
  },
};

const fr: PagesCopy = {
  nav: { features: "Fonctionnalités", security: "Sécurité", home: "Accueil" },
  by: "par Sifra Labs",
  photoAlt: {
    hero: "Une dentiste examine les dents d'un patient souriant, installé dans le fauteuil.",
    team: "Deux soignantes consultent un dossier pendant qu'une secrétaire travaille à l'accueil.",
    tablet: "Un dentiste montre sa radiographie à une patiente sur une tablette.",
    xray: "Un dentiste examine des radiographies dentaires sur un négatoscope.",
    clinic: "Une salle de soins dentaires lumineuse avec fauteuil et scialytique.",
  },
  highlights: {
    title: "Tout ce que fait le cabinet dans une journée",
    lead: "Du premier appel à la clôture de caisse, dans un seul logiciel.",
    more: "Voir toutes les fonctionnalités",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "Agenda", d: "Vues mois, semaine et jour, avec glisser-déposer." },
      { id: "clinical", img: CARD_IMG.clinical, t: "Schéma dentaire", d: "Examens et soins sur un schéma FDI." },
      { id: "money", img: CARD_IMG.money, t: "Encaissements", d: "Reçus, factures et clôture de caisse." },
      { id: "papers", img: CARD_IMG.papers, t: "Ordonnances", d: "Ordonnances et certificats, en français et en arabe." },
    ],
  },
  band: {
    kicker: "Confidentialité",
    title: "L'accueil et le dentiste ne voient pas la même chose",
    text: "L'accueil prend les rendez-vous, encaisse et classe. Le dossier médical reste au dentiste, et chaque ouverture est enregistrée : qui et quand.",
    points: ["Chiffré sur vos propres ordinateurs", "Chaque lecture médicale est journalisée", "Fonctionne sans internet"],
    more: "Comment MeDoc protège les données",
  },
  features: { kicker: "Fonctionnalités" },
  mail: {
    hello: "Bonjour l'équipe Sifra Labs,",
    intro: "Je souhaite une démonstration de MeDoc pour notre cabinet.",
    contact: "Coordonnées",
    request: "Demande",
    noMessage: "Pas de demande particulière : montrez-nous une journée type.",
    details: "Détails",
    language: "Langue",
    country: "Pays",
    sentFrom: "Envoyé depuis le site MeDoc le",
    regards: "Bien cordialement,",
    opened: "Votre application e-mail devrait s'ouvrir avec le message prêt : vérifiez-le et cliquez sur Envoyer. Rien ne s'est ouvert ? Copiez l'e-mail et envoyez-le à",
    copy: "Copier l'e-mail",
    copied: "Copié",
  },
  security: {
    meta: "Sécurité et confidentialité · MeDoc",
    kicker: "Sécurité",
    title: "Les dossiers de vos patients restent dans votre cabinet",
    lead: "MeDoc garde sa base de données chiffrée sur vos propres ordinateurs, ne montre à chacun que ce dont son métier a besoin et enregistre qui a ouvert quoi. Voici comment, et ce qui n'est pas encore fait.",
    where: {
      title: "Où sont les données",
      text: "Sur les ordinateurs du cabinet, dans une base chiffrée. Rien n'est envoyé à MeDoc ni à Sifra Labs, et rien ne part dans un cloud. Quand internet tombe, le cabinet continue de travailler.",
    },
    roles: {
      title: "L'accueil et le dentiste ne voient pas la même chose",
      text: "L'accueil prend les rendez-vous, encaisse et classe. Le dossier médical, les examens et les notes restent au dentiste. La règle est vérifiée au cœur du logiciel, pas seulement masquée à l'écran.",
      reception: "Ce que voit l'accueil",
      dentist: "Ce que voit le dentiste",
    },
    protect: {
      title: "Ce qui protège les données",
      items: [
        { t: "Chiffrement au repos", d: "Toute la base est chiffrée avec SQLCipher (AES-256). Un disque copié ou un portable volé ne montre rien de lisible." },
        { t: "Journal d'audit", d: "L'ouverture d'un dossier médical et les modifications sensibles sont inscrites dans une chaîne scellée par HMAC : une retouche du journal se voit." },
        { t: "Sauvegarde quotidienne", d: "Une sauvegarde chiffrée par jour, pièces jointes comprises, dans le dossier de votre choix, par exemple une clé USB ou un disque externe." },
        { t: "Réseau du cabinet", d: "Les ordinateurs du cabinet échangent sur le réseau local en TLS et vérifient l'empreinte du certificat du serveur." },
        { t: "Comptes personnels", d: "Chacun se connecte avec son propre compte. Les mots de passe sont hachés avec Argon2 et l'écran se verrouille après une période d'inactivité." },
        { t: "Droits des patients", d: "Exporter ou effacer les données d'un patient, et générer le registre des traitements et l'analyse d'impact." },
      ],
    },
    notYet: {
      title: "Pas encore fait",
      lead: "C'est sur la feuille de route. Tant que ce n'est pas livré, nous ne le promettons pas.",
      items: [
        { t: "Double authentification", d: "Développée mais désactivée jusqu'à la fin des tests. Les clés d'accès, Face ID et l'empreinte viendront ensuite." },
        { t: "Installateurs signés", d: "Windows et macOS peuvent afficher un avertissement à l'installation ; les certificats de signature sont en cours." },
        { t: "Audit indépendant", d: "Pas encore de certification ni de test d'intrusion." },
        { t: "Accès d'urgence", d: "Pas d'accès « bris de glace » à un dossier en dehors des rôles habituels." },
      ],
    },
    law: {
      title: "Loi 09-08 et RGPD",
      text: "MeDoc vous donne les outils ; le cabinet reste responsable de sa déclaration à la CNDP au Maroc, ou de son registre au titre du RGPD en Europe. La page Conformité de MeDoc montre l'état des sauvegardes et du journal, et une liste de contrôle indiquant qui a coché quoi et quand.",
    },
    maker: {
      title: "Conçu par Sifra Labs",
      text: "MeDoc est développé et maintenu par Sifra Labs. Vous avez trouvé un problème de sécurité ? Écrivez à security@sifralabs.com.",
      link: "Politique de sécurité de Sifra Labs",
    },
  },
};

const ar: PagesCopy = {
  nav: { features: "الميزات", security: "الأمان", home: "الرئيسية" },
  by: "من Sifra Labs",
  photoAlt: {
    hero: "طبيبة أسنان تفحص أسنان مريض مبتسم جالس على كرسي العلاج.",
    team: "طبيبتان تراجعان ملفًا بينما تعمل موظفة الاستقبال في المكتب.",
    tablet: "طبيب أسنان يعرض على مريضة صورتها الشعاعية على جهاز لوحي.",
    xray: "طبيب أسنان يفحص صورًا شعاعية للأسنان على لوح مضيء.",
    clinic: "غرفة علاج أسنان مضيئة فيها كرسي ومصباح.",
  },
  highlights: {
    title: "كل ما تقوم به العيادة في يوم واحد",
    lead: "من أول مكالمة إلى إغلاق الصندوق، في برنامج واحد.",
    more: "عرض كل الميزات",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "المواعيد", d: "عرض الشهر والأسبوع واليوم، مع السحب والإفلات." },
      { id: "clinical", img: CARD_IMG.clinical, t: "مخطط الأسنان", d: "الفحوصات والعلاجات على مخطط FDI." },
      { id: "money", img: CARD_IMG.money, t: "المدفوعات", d: "الإيصالات والفواتير وإغلاق الصندوق." },
      { id: "papers", img: CARD_IMG.papers, t: "الوصفات", d: "الوصفات والشهادات بالفرنسية والعربية." },
    ],
  },
  band: {
    kicker: "السرية",
    title: "الاستقبال والطبيب لا يريان الشيء نفسه",
    text: "يحجز الاستقبال المواعيد ويحصّل ويرتّب الملفات. الملف الطبي يبقى عند الطبيب، وكل مرة يُفتح فيها يسجّل MeDoc من فتحه ومتى.",
    points: ["مشفّر على حواسيبكم", "كل قراءة طبية مسجّلة", "يعمل دون إنترنت"],
    more: "كيف يحمي MeDoc البيانات",
  },
  features: { kicker: "الميزات" },
  mail: {
    hello: "مرحبًا فريق Sifra Labs،",
    intro: "أرغب في عرض تجريبي لبرنامج MeDoc لعيادتنا.",
    contact: "معلومات الاتصال",
    request: "الطلب",
    noMessage: "لا طلب خاص: أرونا يومًا عاديًا في العيادة.",
    details: "تفاصيل",
    language: "اللغة",
    country: "البلد",
    sentFrom: "أُرسل من موقع MeDoc بتاريخ",
    regards: "مع أطيب التحيات،",
    opened: "سيُفتح الآن تطبيق البريد لديكم والرسالة جاهزة: راجعوها ثم اضغطوا إرسال. لم يُفتح شيء؟ انسخوا الرسالة وأرسلوها إلى",
    copy: "نسخ الرسالة",
    copied: "تم النسخ",
  },
  security: {
    meta: "الأمان والسرية · MeDoc",
    kicker: "الأمان",
    title: "ملفات مرضاكم تبقى داخل عيادتكم",
    lead: "يحفظ MeDoc قاعدة بياناته مشفّرة على حواسيبكم، ولا يُظهر لكل شخص إلا ما يحتاجه عمله، ويسجّل من فتح ماذا. إليكم الطريقة، وما لم يُنجز بعد.",
    where: {
      title: "أين توجد البيانات",
      text: "على حواسيب العيادة، في قاعدة بيانات مشفّرة. لا يُرسل شيء إلى MeDoc ولا إلى Sifra Labs، ولا يذهب شيء إلى السحابة. وعندما ينقطع الإنترنت، تواصل العيادة عملها.",
    },
    roles: {
      title: "الاستقبال والطبيب لا يريان الشيء نفسه",
      text: "يحجز الاستقبال المواعيد ويحصّل ويرتّب الملفات. أما الملف الطبي والفحوصات والملاحظات فتبقى عند الطبيب. القاعدة تُفحص في صميم البرنامج، لا تُخفى على الشاشة فقط.",
      reception: "ما يراه الاستقبال",
      dentist: "ما يراه الطبيب",
    },
    protect: {
      title: "ما يحمي البيانات",
      items: [
        { t: "التشفير أثناء التخزين", d: "قاعدة البيانات كلها مشفّرة بـ SQLCipher (AES-256). القرص المنسوخ أو الحاسوب المسروق لا يُظهر شيئًا مقروءًا." },
        { t: "سجل التدقيق", d: "فتح الملف الطبي والتعديلات الحساسة تُسجَّل في سلسلة مختومة بـ HMAC، فيظهر أي تعديل لاحق على السجل." },
        { t: "نسخة احتياطية يومية", d: "نسخة مشفّرة كل يوم، مع المرفقات، في مجلد تختارونه مثل مفتاح USB أو قرص خارجي." },
        { t: "شبكة العيادة", d: "تتواصل حواسيب العيادة عبر الشبكة المحلية بـ TLS وتتحقق من بصمة شهادة الخادم." },
        { t: "حسابات شخصية", d: "يدخل كل شخص بحسابه الخاص. كلمات المرور محفوظة بتجزئة Argon2، وتُقفل الشاشة بعد فترة من عدم النشاط." },
        { t: "حقوق المرضى", d: "تصدير بيانات المريض أو حذفها، وإنشاء سجل المعالجات وتقييم الأثر." },
      ],
    },
    notYet: {
      title: "لم يُنجز بعد",
      lead: "هذه في خطة العمل. ولا نَعِد بها قبل أن تصدر.",
      items: [
        { t: "التحقق بخطوتين", d: "مطوَّر لكنه معطَّل حتى تكتمل الاختبارات. مفاتيح المرور وFace ID والبصمة تأتي بعد ذلك." },
        { t: "برامج تثبيت موقَّعة", d: "قد يُظهر Windows وmacOS تحذيرًا عند التثبيت؛ شهادات التوقيع قيد الإعداد." },
        { t: "تدقيق مستقل", d: "لا توجد بعد شهادة ولا اختبار اختراق." },
        { t: "وصول الطوارئ", d: "لا يوجد وصول طارئ إلى ملف خارج الأدوار المعتادة." },
      ],
    },
    law: {
      title: "القانون 09-08 واللائحة الأوروبية لحماية البيانات",
      text: "يمنحكم MeDoc الأدوات، وتبقى العيادة مسؤولة عن تصريحها لدى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي في المغرب، أو عن سجلها وفق اللائحة الأوروبية في أوروبا. تُظهر صفحة المطابقة في MeDoc حالة النسخ الاحتياطية والسجل، وقائمة مراجعة بمن أشّر على ماذا ومتى.",
    },
    maker: {
      title: "من تطوير Sifra Labs",
      text: "تطوّر Sifra Labs برنامج MeDoc وتصونه. وجدتم مشكلة أمنية؟ راسلونا على security@sifralabs.com.",
      link: "سياسة الأمان لدى Sifra Labs",
    },
  },
};

const de: PagesCopy = {
  nav: { features: "Funktionen", security: "Sicherheit", home: "Start" },
  by: "von Sifra Labs",
  photoAlt: {
    hero: "Eine Zahnärztin untersucht die Zähne eines lächelnden Patienten auf dem Behandlungsstuhl.",
    team: "Zwei Ärztinnen besprechen eine Akte, während eine Kollegin am Empfang arbeitet.",
    tablet: "Ein Zahnarzt zeigt einer Patientin ihr Röntgenbild auf einem Tablet.",
    xray: "Ein Zahnarzt betrachtet zahnärztliche Röntgenaufnahmen auf einem Leuchtkasten.",
    clinic: "Ein heller Behandlungsraum mit Zahnarztstuhl und Lampe.",
  },
  highlights: {
    title: "Alles, was die Praxis an einem Tag erledigt",
    lead: "Vom ersten Anruf bis zum Tagesabschluss, in einem Programm.",
    more: "Alle Funktionen ansehen",
    cards: [
      { id: "calendar", img: CARD_IMG.calendar, t: "Terminkalender", d: "Monat, Woche und Tag, mit Drag-and-drop." },
      { id: "clinical", img: CARD_IMG.clinical, t: "Zahnschema", d: "Befunde und Behandlungen im FDI-Schema." },
      { id: "money", img: CARD_IMG.money, t: "Zahlungen", d: "Quittungen, Rechnungen und Tagesabschluss." },
      { id: "papers", img: CARD_IMG.papers, t: "Rezepte", d: "Rezepte und Bescheinigungen, auch auf Französisch und Arabisch." },
    ],
  },
  band: {
    kicker: "Datenschutz",
    title: "Empfang und Zahnarzt sehen nicht dasselbe",
    text: "Der Empfang vergibt Termine, kassiert und legt ab. Die medizinische Akte bleibt beim Zahnarzt, und jedes Öffnen hält MeDoc fest: wer und wann.",
    points: ["Verschlüsselt auf Ihren eigenen Rechnern", "Jeder medizinische Zugriff wird protokolliert", "Funktioniert ohne Internet"],
    more: "Wie MeDoc Daten schützt",
  },
  features: { kicker: "Funktionen" },
  mail: {
    hello: "Hallo Sifra-Labs-Team,",
    intro: "ich möchte eine MeDoc-Vorführung für unsere Praxis.",
    contact: "Kontakt",
    request: "Anliegen",
    noMessage: "Kein besonderes Anliegen: Zeigen Sie uns einen typischen Praxistag.",
    details: "Details",
    language: "Sprache",
    country: "Land",
    sentFrom: "Gesendet über die MeDoc-Website am",
    regards: "Mit freundlichen Grüßen",
    opened: "Ihr E-Mail-Programm sollte sich jetzt mit der fertigen Nachricht öffnen: Prüfen Sie sie und klicken Sie auf Senden. Nichts geöffnet? Kopieren Sie die E-Mail und senden Sie sie an",
    copy: "E-Mail kopieren",
    copied: "Kopiert",
  },
  security: {
    meta: "Sicherheit und Datenschutz · MeDoc",
    kicker: "Sicherheit",
    title: "Die Akten Ihrer Patienten bleiben in Ihrer Praxis",
    lead: "MeDoc speichert seine Datenbank verschlüsselt auf Ihren eigenen Rechnern, zeigt jeder Person nur, was ihre Arbeit braucht, und hält fest, wer was geöffnet hat. So funktioniert es, und das ist noch nicht fertig.",
    where: {
      title: "Wo die Daten liegen",
      text: "Auf den Rechnern der Praxis, in einer verschlüsselten Datenbank. Nichts geht an MeDoc oder Sifra Labs, nichts in eine Cloud. Fällt das Internet aus, arbeitet die Praxis weiter.",
    },
    roles: {
      title: "Empfang und Zahnarzt sehen nicht dasselbe",
      text: "Der Empfang vergibt Termine, kassiert und legt ab. Medizinische Akte, Befunde und Notizen bleiben beim Zahnarzt. Die Regel wird im Kern der Software geprüft, nicht nur auf dem Bildschirm ausgeblendet.",
      reception: "Was der Empfang sieht",
      dentist: "Was der Zahnarzt sieht",
    },
    protect: {
      title: "Was die Daten schützt",
      items: [
        { t: "Verschlüsselung im Ruhezustand", d: "Die ganze Datenbank ist mit SQLCipher (AES-256) verschlüsselt. Eine kopierte Festplatte oder ein gestohlener Laptop zeigt nichts Lesbares." },
        { t: "Prüfprotokoll", d: "Das Öffnen medizinischer Akten und sensible Änderungen werden in einer mit HMAC versiegelten Kette protokolliert, spätere Änderungen am Protokoll fallen auf." },
        { t: "Tägliche Sicherung", d: "Eine verschlüsselte Sicherung pro Tag, mit Anhängen, in einen Ordner Ihrer Wahl, etwa auf einen USB-Stick oder eine externe Festplatte." },
        { t: "Praxisnetz", d: "Die Rechner der Praxis kommunizieren im lokalen Netz per TLS und prüfen den Zertifikats-Fingerabdruck des Servers." },
        { t: "Eigene Konten", d: "Jede Person meldet sich mit eigenem Konto an. Passwörter werden mit Argon2 gehasht, und der Bildschirm sperrt sich nach einer Zeit ohne Aktivität." },
        { t: "Patientenrechte", d: "Daten eines Patienten exportieren oder löschen, Verarbeitungsverzeichnis und Datenschutz-Folgenabschätzung erzeugen." },
      ],
    },
    notYet: {
      title: "Noch nicht fertig",
      lead: "Auf dem Fahrplan. Bis es ausgeliefert ist, versprechen wir es nicht.",
      items: [
        { t: "Zwei-Faktor-Anmeldung", d: "Gebaut, aber abgeschaltet, bis sie vollständig getestet ist. Passkeys, Face ID und Fingerabdruck folgen." },
        { t: "Signierte Installer", d: "Windows und macOS können bei der Installation warnen; die Signaturzertifikate sind in Arbeit." },
        { t: "Unabhängige Prüfung", d: "Noch keine Zertifizierung und kein Penetrationstest." },
        { t: "Notfallzugriff", d: "Kein „Break-Glass“-Zugriff auf eine Akte außerhalb der normalen Rollen." },
      ],
    },
    law: {
      title: "DSGVO und Loi 09-08",
      text: "MeDoc liefert die Werkzeuge; verantwortlich bleibt die Praxis, für ihr Verzeichnis nach der DSGVO in Europa oder ihre Meldung bei der CNDP in Marokko. Die Seite „Compliance“ in MeDoc zeigt den Stand von Sicherungen und Protokoll und eine Checkliste, wer was wann abgehakt hat.",
    },
    maker: {
      title: "Entwickelt von Sifra Labs",
      text: "MeDoc wird von Sifra Labs entwickelt und gepflegt. Sie haben ein Sicherheitsproblem gefunden? Schreiben Sie an security@sifralabs.com.",
      link: "Sicherheitsrichtlinie von Sifra Labs",
    },
  },
};

export const PAGES_COPY: Record<Lang, PagesCopy> = { en, fr, ar, de };
