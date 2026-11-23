type Shot = { file: string; alt: string; caption: string };
type Section = { id: string; title: string; text: string; shots: Shot[] };

export type ProductCopy = {
  title: string;
  lead: string;
  trustTitle: string;
  trustLead: string;
  trust: string[];
  sections: Section[];
};

const files = {
  roles: ["reception-overview", "reception-record", "overview"],
  calendar: ["calendar-month", "calendar-week", "calendar-drag", "calendar-day"],
  appointments: ["appointment-new", "appointment-detail"],
  record: ["patient-records", "patient-record"],
  clinical: ["examinations", "treatments"],
  documents: ["attachments"],
  papers: ["prescriptions"],
  money: ["cash-entries", "finance", "orders"],
  flow: ["practice-tasks", "charts-to-validate", "notifications"],
  numbers: ["analytics"],
  time: ["work-time"],
  administration: ["administration"],
  settings: ["settings", "settings-security"],
} as const;

function shots(ids: readonly string[], alts: string[], captions: string[]): Shot[] {
  return ids.map((file, i) => ({ file, alt: alts[i], caption: captions[i] }));
}

export const productEn: ProductCopy = {
  title: "The software, screen by screen",
  lead: "Screenshots of the current version, with fictitious patients.",
  trustTitle: "Security and reliability",
  trustLead: "One menu, a shared book, and presets so the repeat work is short. You install the license on the practice computer, then extra screens join with a PIN.",
  trust: [
    "The database is encrypted on the practice computers.",
    "Chairs talk on your network. There is no public cloud of patient files.",
    "Important actions go into a log a physician can check.",
    "A physician can export one patient, or erase the medical rows.",
    "The day keeps running when the internet does not.",
    "MeDoc documents the practice. It does not diagnose.",
  ],
  sections: [
    {
      id: "roles",
      title: "Two jobs. The chart stays with the dentist.",
      text: "Physician and Reception sign in separately. Reception keeps names, phone, the book, tasks, and the cash desk. Examinations, the tooth chart, and clinical notes are not sent to that account. The rule is in the software, not only a hidden menu. A physician can grant extra rights to one person.",
      shots: shots(
        files.roles,
        ["Reception menu, without statistics or the medical chart", "The same patient as reception sees it", "Physician overview with the full menu"],
        ["Reception’s morning is the short menu.", "Reception sees contact, appointments, papers and payments. No examinations, treatments or tooth chart.", "The dentist also sees validation, statistics, finance, and administration."],
      ),
    },
    {
      id: "calendar",
      title: "Month, week, and day are the same book.",
      text: "The month shows empty days, so you can see where the month is still open. The week shows the whole week, so you can move an appointment that does not fit. The day is one chair against the clock. Drag a card. Two visits cannot take the same chair at the same time. Reception and the dentist share this book, and both see the change.",
      shots: shots(
        files.calendar,
        ["Month calendar with open days", "Week calendar", "Dragging an appointment to a new slot", "Day calendar"],
        ["The month: empty days are visible.", "The week: move what does not fit.", "Drag and drop: the old place fades, the new time shows in the gutter.", "The day, snapped to the clock."],
      ),
    },
    {
      id: "appointments",
      title: "A new visit, or a change, stays on the calendar.",
      text: "Create the appointment from the book. Open the card to change the time, the status, or a note. The dentist can go from that card to the patient. Reception stays on names and the book.",
      shots: shots(
        files.appointments,
        ["New appointment on the calendar", "Appointment card"],
        ["A new slot, on the same screen.", "Update the visit without opening another program."],
      ),
    },
    {
      id: "record",
      title: "One file for what the dentist needs to know.",
      text: "Identity, history, teeth, examinations, treatments, prescriptions, certificates, attachments, and payments live on the same person. The list shows a status, so you can see at a glance who is in treatment, who has an open invoice, and who is closed.",
      shots: shots(
        files.record,
        ["Patient list with status", "Full patient record"],
        ["The list is the fast view.", "Open the person and the clinical pages are there."],
      ),
    },
    {
      id: "clinical",
      title: "Examine, treat, follow up, correct.",
      text: "Start an examination, select a tooth, write the finding, and save. Open it later to add or change it. A treatment names the act, the teeth, and whether it is ready to bill.",
      shots: shots(
        files.clinical,
        ["Examination with the tooth chart", "Treatments on the patient"],
        ["The chart and the note are the same examination.", "Each line says what was done, and whether it can be billed."],
      ),
    },
    {
      id: "documents",
      title: "Keep the papers on the patient. Open them again.",
      text: "Letters, scans, and photos are stored on the record. Open one when you need it. Attaching a file is available now. Reading a sensor or a DICOM study is in preparation. MeDoc is not an X-ray workstation yet.",
      shots: shots(files.documents, ["Attachments on a patient record"], ["Stored on the patient, ready to open."]),
    },
    {
      id: "papers",
      title: "Prescriptions and certificates, with the lines you reuse.",
      text: "Both print on the practice letterhead. In Administration you keep medication lists, prescription presets, and templates, so a repeat script is a few clicks. You can still change the line before it prints.",
      shots: shots(files.papers, ["Prescriptions on the patient"], ["Write it, or start from a preset."]),
    },
    {
      id: "money",
      title: "Receipts, invoices, and what you still owe the suppliers.",
      text: "Reception records cash, card, or cheque, including a partial payment and what is still due. The dentist sees the money overview. Invoices are their own path, not the till. Orders show what you asked a supplier for, and what is late. Day close checks the totals and locks the day.",
      shots: shots(
        files.money,
        ["Cash desk", "Finance overview", "Purchase orders"],
        ["The desk takes the payment.", "The dentist sees the practice money.", "Orders: open, received, or late."],
      ),
    },
    {
      id: "flow",
      title: "Tasks, validation, status, and a bell when something changed.",
      text: "A practice task can ask reception to book a visit. Records that still need the dentist sit in their own list. Notifications collect what changed. The status on the patient list is the fast view. Reception does not open the validation queue.",
      shots: shots(
        files.flow,
        ["Practice tasks", "Records waiting for validation", "Notifications"],
        ["Handoffs stay in the menu.", "The dentist signs off what is waiting.", "The bell, without leaving the page."],
      ),
    },
    {
      id: "numbers",
      title: "The practice’s own numbers.",
      text: "Statistics are a physician screen. Pick a period and see patients, appointments, treatments, income, and open orders from this practice. Reception does not get that page.",
      shots: shots(files.numbers, ["Practice statistics"], ["Counts for this practice, for the period you chose."]),
    },
    {
      id: "time",
      title: "Hours, for yourself and for the team.",
      text: "Each person clocks their own time. Under Administration, the dentist can open the team’s hours.",
      shots: shots(files.time, ["Work time"], ["Clock in, clock out, see the day."]),
    },
    {
      id: "administration",
      title: "Administration: staff, services, presets, data and updates.",
      text: "Team holds staff and their hours. Finance reports hold day close, invoices, and balance sheets. Inventory and ordering holds products, supplier data, and contracts. Services holds the treatment catalog, medications, prescription presets, and templates. Practice planning holds work days, work hours, blocked times, and preferences.",
      shots: shots(files.administration, ["Administration home"], ["The categories, and nothing that is not in the product."]),
    },
    {
      id: "settings",
      title: "The practice, the account, and the lock on the chair.",
      text: "Settings cover the practice profile, your account, notifications, security, the license, and appearance, including the four languages. Security shows the activity log, who is signed in, and a lock when the chair sits idle. Backup is for the physician.",
      shots: shots(
        files.settings,
        ["Settings", "Security settings"],
        ["Appearance, language, and the practice profile.", "The log, the sessions, and the idle lock."],
      ),
    },
  ],
};

export const productFr: ProductCopy = {
  title: "Le logiciel, écran par écran",
  lead: "Captures de la version actuelle, avec des patients fictifs.",
  trustTitle: "Sécurité et fiabilité",
  trustLead: "Un seul menu, un agenda partagé, et des modèles pour le travail qui revient. La licence s’installe sur l’ordinateur du cabinet, puis les autres écrans se joignent avec un code.",
  trust: [
    "La base est chiffrée sur les ordinateurs du cabinet.",
    "Les postes parlent sur votre réseau. Pas de cloud public de dossiers patients.",
    "Les actes importants vont dans un journal que le dentiste peut vérifier.",
    "Le dentiste peut exporter un patient, ou effacer les lignes médicales.",
    "La journée continue quand internet s’arrête.",
    "MeDoc documente le cabinet. Il ne pose pas de diagnostic.",
  ],
  sections: [
    {
      id: "roles",
      title: "Deux métiers. Le dossier médical reste au dentiste.",
      text: "Dentiste et accueil se connectent séparément. L’accueil garde les noms, le téléphone, l’agenda, les tâches et la caisse. Les examens, le schéma dentaire et les notes cliniques ne sont pas envoyés à ce compte. La règle est dans le logiciel, pas seulement dans un menu caché. Le dentiste peut accorder des droits en plus à une personne.",
      shots: shots(files.roles, ["Menu de l’accueil, sans statistiques ni dossier médical", "Le même patient vu par l’accueil", "Vue du dentiste avec le menu complet"], ["Le matin de l’accueil, menu court.", "L’accueil voit coordonnées, rendez-vous, documents et paiements. Ni examens, ni traitements, ni schéma dentaire.", "Le dentiste voit aussi la validation, les statistiques, les finances et l’administration."]),
    },
    {
      id: "calendar",
      title: "Mois, semaine et jour : le même agenda.",
      text: "Le mois montre les jours vides, pour voir où le mois est encore ouvert. La semaine montre toute la semaine, pour déplacer un rendez-vous qui ne tient pas. Le jour, c’est un fauteuil face à l’horloge. On glisse une carte. Deux visites ne peuvent pas prendre le même fauteuil en même temps. L’accueil et le dentiste partagent cet agenda, et voient le changement.",
      shots: shots(files.calendar, ["Calendrier du mois avec des jours libres", "Calendrier de la semaine", "Rendez-vous glissé vers un nouveau créneau", "Calendrier du jour"], ["Le mois : les jours vides se voient.", "La semaine : on déplace ce qui ne tient pas.", "Glisser-déposer : l’ancienne place s’efface, la nouvelle heure s’affiche.", "Le jour, calé sur l’horloge."]),
    },
    {
      id: "appointments",
      title: "Un nouveau rendez-vous, ou une correction, reste sur l’agenda.",
      text: "On crée le rendez-vous depuis l’agenda. On ouvre la fiche pour changer l’heure, le statut ou une note. Le dentiste peut passer de cette fiche au patient. L’accueil reste sur les noms et l’agenda.",
      shots: shots(files.appointments, ["Nouveau rendez-vous sur l’agenda", "Fiche du rendez-vous"], ["Un créneau, sur le même écran.", "On met à jour la visite sans ouvrir un autre logiciel."]),
    },
    {
      id: "record",
      title: "Un dossier pour ce que le dentiste doit savoir.",
      text: "Identité, antécédents, dents, examens, soins, ordonnances, certificats, pièces jointes et paiements sont sur la même personne. La liste affiche un statut : en soins, facture ouverte, ou dossier clos.",
      shots: shots(files.record, ["Liste des patients avec statut", "Dossier patient complet"], ["La liste est la vue rapide.", "On ouvre la personne, les pages cliniques sont là."]),
    },
    {
      id: "clinical",
      title: "Examiner, soigner, suivre, corriger.",
      text: "On ouvre un examen, on choisit une dent, on écrit le constat, on enregistre. On le rouvre plus tard pour compléter ou corriger. Un soin nomme l’acte, les dents, et s’il est prêt à facturer.",
      shots: shots(files.clinical, ["Examen avec le schéma dentaire", "Soins du patient"], ["Le schéma et la note sont le même examen.", "Chaque ligne dit ce qui a été fait, et si on peut le facturer."]),
    },
    {
      id: "documents",
      title: "Les documents restent sur le patient. On les rouvre.",
      text: "Courriers, scans et photos sont dans le dossier. On ouvre le fichier quand on en a besoin. Joindre un fichier est disponible. Lire un capteur ou une étude DICOM est en préparation. MeDoc n’est pas encore un poste de radiologie.",
      shots: shots(files.documents, ["Pièces jointes du dossier"], ["Rangées sur le patient, prêtes à ouvrir."]),
    },
    {
      id: "papers",
      title: "Ordonnances et certificats, avec les lignes que vous réutilisez.",
      text: "Les deux s’impriment sur l’en-tête du cabinet. Dans l’administration, vous gardez les listes de médicaments, les ordonnances types et les modèles : une ordonnance habituelle tient en quelques clics. On peut encore changer la ligne avant d’imprimer.",
      shots: shots(files.papers, ["Ordonnances du patient"], ["On l’écrit, ou on part d’un modèle."]),
    },
    {
      id: "money",
      title: "Encaissements, factures, et ce que vous devez encore aux fournisseurs.",
      text: "L’accueil enregistre espèces, carte ou chèque, y compris un paiement partiel et le reste dû. Le dentiste voit la vue d’ensemble. Les factures ont leur propre chemin, distinct de la caisse. Les commandes montrent ce qui est demandé au fournisseur, et ce qui est en retard. La clôture du jour vérifie les totaux et verrouille la journée.",
      shots: shots(files.money, ["Caisse", "Vue finances", "Commandes"], ["L’accueil encaisse.", "Le dentiste voit l’argent du cabinet.", "Commandes : ouvertes, reçues, ou en retard."]),
    },
    {
      id: "flow",
      title: "Tâches, validation, statut, et une cloche quand quelque chose change.",
      text: "Une tâche peut demander à l’accueil de prendre un rendez-vous. Les dossiers qui attendent le dentiste ont leur liste. Les notifications rassemblent ce qui a changé. Le statut dans la liste des patients est la vue rapide. L’accueil n’ouvre pas la file de validation.",
      shots: shots(files.flow, ["Tâches du cabinet", "Dossiers à valider", "Notifications"], ["Les passages de relais restent dans le menu.", "Le dentiste valide ce qui attend.", "La cloche, sans quitter la page."]),
    },
    {
      id: "numbers",
      title: "Les chiffres de ce cabinet.",
      text: "Les statistiques sont un écran du dentiste. On choisit une période : patients, rendez-vous, soins, recettes et commandes ouvertes de ce cabinet. L’accueil n’a pas cette page.",
      shots: shots(files.numbers, ["Statistiques du cabinet"], ["Les comptes de ce cabinet, pour la période choisie."]),
    },
    {
      id: "time",
      title: "Les heures, pour soi et pour l’équipe.",
      text: "Chacun pointe ses heures. Dans l’administration, le dentiste ouvre les heures de l’équipe.",
      shots: shots(files.time, ["Temps de travail"], ["Arrivée, départ, la journée."]),
    },
    {
      id: "administration",
      title: "Administration : équipe, actes, modèles, données et mises à jour.",
      text: "Équipe : le personnel et ses heures. Rapports financiers : clôture du jour, factures, bilans. Stock et commandes : produits, fournisseurs, contrats. Prestations : catalogue de soins, médicaments, ordonnances types, modèles. Planning du cabinet : jours travaillés, horaires, blocages, préférences.",
      shots: shots(files.administration, ["Accueil de l’administration"], ["Les catégories qui existent dans le logiciel."]),
    },
    {
      id: "settings",
      title: "Le cabinet, le compte, et le verrou du fauteuil.",
      text: "Les réglages couvrent la fiche du cabinet, votre compte, les notifications, la sécurité, la licence et l’apparence, dont les quatre langues. La sécurité montre le journal, qui est connecté, et un verrou si le poste reste inactif. La sauvegarde est réservée au dentiste.",
      shots: shots(files.settings, ["Réglages", "Sécurité"], ["Apparence, langue, et fiche du cabinet.", "Le journal, les sessions, et le verrou d’inactivité."]),
    },
  ],
};

export const productAr: ProductCopy = {
  title: "البرنامج، شاشة بشاشة",
  lead: "لقطات من النسخة الحالية، بمرضى وهميين.",
  trustTitle: "الأمان والموثوقية",
  trustLead: "قائمة واحدة، ودفتر مواعيد مشترك، ونماذج جاهزة للعمل المتكرر. تُثبَّت الرخصة على حاسوب العيادة، ثم تنضم الشاشات الأخرى برمز.",
  trust: [
    "قاعدة البيانات مشفّرة على حواسيب العيادة.",
    "الكراسي تتحدث عبر شبكتكم. لا سحابة عامة لملفات المرضى.",
    "الأعمال المهمة تُكتب في سجل يستطيع الطبيب مراجعته.",
    "يستطيع الطبيب تصدير مريض، أو مسح الصفوف الطبية.",
    "اليوم يستمر حين ينقطع الإنترنت.",
    "MeDoc يوثّق عمل العيادة. لا يضع تشخيصًا.",
  ],
  sections: [
    {
      id: "roles",
      title: "وظيفتان. الملف الطبي يبقى عند الطبيب.",
      text: "الطبيب والاستقبال يدخلان بحسابين منفصلين. الاستقبال يرى الأسماء والهاتف ودفتر المواعيد والمهام والصندوق. الفحوصات ومخطط الأسنان والملاحظات السريرية لا تُرسل إلى هذا الحساب. القاعدة داخل البرنامج، لا مجرد قائمة مخفية. يستطيع الطبيب منح صلاحيات إضافية لشخص واحد.",
      shots: shots(files.roles, ["قائمة الاستقبال بلا إحصاءات ولا ملف طبي", "المريض نفسه كما يراه الاستقبال", "نظرة الطبيب مع القائمة الكاملة"], ["صباح الاستقبال: قائمة قصيرة.", "يرى الاستقبال بيانات الاتصال والمواعيد والوثائق والمدفوعات، دون الفحوص والعلاجات ومخطط الأسنان.", "الطبيب يرى أيضًا التحقق والإحصاءات والمالية والإدارة."]),
    },
    {
      id: "calendar",
      title: "الشهر والأسبوع واليوم دفتر واحد.",
      text: "الشهر يُظهر الأيام الفارغة لتعرف أين ما زال الشهر مفتوحًا. الأسبوع يُظهر الأسبوع كاملًا لتنقل موعدًا لا يتسع. اليوم كرسي واحد أمام الساعة. اسحب البطاقة. زيارتان لا تأخذان الكرسي نفسه في الوقت نفسه. الاستقبال والطبيب يشاركان هذا الدفتر، ويريان التغيير.",
      shots: shots(files.calendar, ["تقويم الشهر مع أيام فارغة", "تقويم الأسبوع", "سحب موعد إلى وقت جديد", "تقويم اليوم"], ["الشهر: الأيام الفارغة ظاهرة.", "الأسبوع: انقل ما لا يتسع.", "السحب والإفلات: يبهت المكان القديم ويظهر الوقت الجديد.", "اليوم، مضبوط على الساعة."]),
    },
    {
      id: "appointments",
      title: "موعد جديد، أو تعديل، يبقى على الدفتر.",
      text: "يُنشأ الموعد من الدفتر. تُفتح البطاقة لتغيير الوقت أو الحالة أو ملاحظة. الطبيب ينتقل من البطاقة إلى المريض. الاستقبال يبقى على الأسماء والدفتر.",
      shots: shots(files.appointments, ["موعد جديد على التقويم", "بطاقة الموعد"], ["خانة جديدة على الشاشة نفسها.", "تحديث الزيارة دون برنامج آخر."]),
    },
    {
      id: "record",
      title: "ملف واحد لما يحتاج الطبيب أن يعرفه.",
      text: "الهوية والسوابق والأسنان والفحوصات والعلاجات والوصفات والشهادات والمرفقات والمدفوعات على الشخص نفسه. القائمة تعرض حالة: قيد العلاج، أو فاتورة مفتوحة، أو ملف مغلق.",
      shots: shots(files.record, ["قائمة المرضى مع الحالة", "ملف المريض كاملًا"], ["القائمة هي النظرة السريعة.", "افتح الشخص فتجد الصفحات السريرية."]),
    },
    {
      id: "clinical",
      title: "افحص، عالج، تابع، وصحّح.",
      text: "تبدأ فحصًا، تختار سنًا، تكتب النتيجة، وتحفظ. تعود إليه لاحقًا لتضيف أو تصحح. العلاج يسمّي الإجراء والأسنان وهل هو جاهز للفوترة.",
      shots: shots(files.clinical, ["فحص مع مخطط الأسنان", "علاجات المريض"], ["المخطط والملاحظة فحص واحد.", "كل سطر يقول ما تم، وهل يمكن فوترته."]),
    },
    {
      id: "documents",
      title: "الوثائق تبقى على المريض. تُفتح من جديد.",
      text: "الرسائل والمسوح والصور مخزّنة في الملف. تفتحها حين تحتاجها. إرفاق ملف متاح الآن. قراءة مستشعر أو دراسة DICOM قيد الإعداد. MeDoc ليس بعد محطة أشعة.",
      shots: shots(files.documents, ["مرفقات ملف المريض"], ["محفوظة على المريض، جاهزة للفتح."]),
    },
    {
      id: "papers",
      title: "الوصفات والشهادات، مع السطور التي تعيد استخدامها.",
      text: "الاثنان يُطبعان على ترويسة العيادة. في الإدارة تحتفظ بقوائم الأدوية ونماذج الوصفات والقوالب، فوصفة متكررة بضع نقرات. تستطيع تغيير السطر قبل الطباعة.",
      shots: shots(files.papers, ["وصفات المريض"], ["تكتبها، أو تبدأ من نموذج."]),
    },
    {
      id: "money",
      title: "الإيصالات والفواتير وما زلتم تدينون به للمورّدين.",
      text: "الاستقبال يسجّل النقد أو البطاقة أو الشيك، بما في ذلك دفعة جزئية والباقي. الطبيب يرى نظرة المال. الفواتير مسار مستقل عن الصندوق. الطلبات تُظهر ما طُلب من المورّد وما تأخر. إقفال اليوم يراجع المجاميع ويقفل اليوم.",
      shots: shots(files.money, ["الصندوق", "نظرة المالية", "الطلبات"], ["الاستقبال يقبض.", "الطبيب يرى مال العيادة.", "الطلبات: مفتوحة أو مستلمة أو متأخرة."]),
    },
    {
      id: "flow",
      title: "مهام، وتحقق، وحالة، وجرس حين يتغيّر شيء.",
      text: "مهمة يمكن أن تطلب من الاستقبال حجز موعد. الملفات التي تنتظر الطبيب لها قائمتها. الإشعارات تجمع ما تغيّر. الحالة في قائمة المرضى هي النظرة السريعة. الاستقبال لا يفتح طابور التحقق.",
      shots: shots(files.flow, ["مهام العيادة", "ملفات بانتظار التحقق", "الإشعارات"], ["التسليم يبقى في القائمة.", "الطبيب يعتمد ما ينتظر.", "الجرس، دون مغادرة الصفحة."]),
    },
    {
      id: "numbers",
      title: "أرقام هذه العيادة.",
      text: "الإحصاءات شاشة للطبيب. تختار فترة: مرضى، ومواعيد، وعلاجات، ودخل، وطلبات مفتوحة لهذه العيادة. الاستقبال لا يصل إلى هذه الصفحة.",
      shots: shots(files.numbers, ["إحصاءات العيادة"], ["أرقام هذه العيادة، للفترة التي اخترتها."]),
    },
    {
      id: "time",
      title: "الساعات، لك وللفريق.",
      text: "كل شخص يسجّل ساعاته. في الإدارة يفتح الطبيب ساعات الفريق.",
      shots: shots(files.time, ["وقت العمل"], ["دخول، خروج، واليوم."]),
    },
    {
      id: "administration",
      title: "الإدارة: الفريق، الخدمات، النماذج، البيانات والتحديثات.",
      text: "الفريق: الموظفون وساعاتهم. التقارير المالية: إقفال اليوم والفواتير والميزانيات. المخزون والطلبات: المنتجات وبيانات المورّدين والعقود. الخدمات: فهرس العلاجات والأدوية ونماذج الوصفات والقوالب. تخطيط العيادة: أيام العمل والساعات والأوقات المحجوبة والتفضيلات.",
      shots: shots(files.administration, ["صفحة الإدارة"], ["التصنيفات الموجودة في البرنامج."]),
    },
    {
      id: "settings",
      title: "العيادة، والحساب، وقفل الكرسي.",
      text: "الإعدادات تشمل ملف العيادة وحسابك والإشعارات والأمان والرخصة والمظهر، ومنها اللغات الأربع. الأمان يعرض السجل ومن هو داخل، وقفلاً إذا بقي الكرسي بلا حركة. النسخ الاحتياطي للطبيب.",
      shots: shots(files.settings, ["الإعدادات", "إعدادات الأمان"], ["المظهر واللغة وملف العيادة.", "السجل والجلسات وقفل الخمول."]),
    },
  ],
};

export const productDe: ProductCopy = {
  title: "Die Software, Bildschirm für Bildschirm",
  lead: "Bildschirmfotos der aktuellen Version, mit erfundenen Patienten.",
  trustTitle: "Sicherheit und Zuverlässigkeit",
  trustLead: "Ein Menü, ein gemeinsames Buch und Vorlagen für die Arbeit, die sich wiederholt. Die Lizenz liegt auf dem Praxisrechner, weitere Bildschirme kommen mit einer PIN dazu.",
  trust: [
    "Die Datenbank ist auf den Praxisrechnern verschlüsselt.",
    "Die Stühle sprechen über Ihr Netz. Keine öffentliche Wolke mit Patientenakten.",
    "Wichtige Vorgänge stehen in einem Protokoll, das die Zahnärztin prüfen kann.",
    "Eine Zahnärztin kann eine Patientin exportieren oder die medizinischen Zeilen löschen.",
    "Der Tag läuft weiter, wenn das Internet ausfällt.",
    "MeDoc dokumentiert die Praxis. Es stellt keine Diagnose.",
  ],
  sections: [
    {
      id: "roles",
      title: "Zwei Berufe. Die Akte bleibt bei der Zahnärztin.",
      text: "Zahnärztin und Empfang melden sich getrennt an. Der Empfang behält Namen, Telefon, das Buch, Aufgaben und die Kasse. Untersuchungen, das Zahnschema und klinische Notizen gehen nicht an dieses Konto. Die Regel steckt in der Software, nicht nur in einem versteckten Menü. Eine Zahnärztin kann einer Person zusätzliche Rechte geben.",
      shots: shots(files.roles, ["Empfangsmenü ohne Statistik und ohne Akte", "Derselbe Patient aus Sicht des Empfangs", "Übersicht der Zahnärztin mit vollem Menü"], ["Der Morgen am Empfang ist das kurze Menü.", "Der Empfang sieht Kontakt, Termine, Dokumente und Zahlungen. Keine Untersuchungen, Behandlungen oder Zahnschema.", "Die Zahnärztin sieht auch Freigabe, Statistik, Finanzen und Verwaltung."]),
    },
    {
      id: "calendar",
      title: "Monat, Woche und Tag sind dasselbe Buch.",
      text: "Der Monat zeigt leere Tage, damit sichtbar bleibt, wo der Monat noch offen ist. Die Woche zeigt die ganze Woche, damit ein Termin wandert, der nicht passt. Der Tag ist ein Stuhl an der Uhr. Eine Karte lässt sich ziehen. Zwei Besuche können nicht gleichzeitig denselben Stuhl belegen. Empfang und Zahnärztin teilen dieses Buch und sehen die Änderung.",
      shots: shots(files.calendar, ["Monatskalender mit freien Tagen", "Wochenkalender", "Termin wird auf einen neuen Slot gezogen", "Tageskalender"], ["Der Monat: leere Tage sind sichtbar.", "Die Woche: verschieben, was nicht passt.", "Drag & Drop: der alte Platz verblasst, die neue Zeit steht am Rand.", "Der Tag, an der Uhr."]),
    },
    {
      id: "appointments",
      title: "Ein neuer Termin oder eine Änderung bleibt im Kalender.",
      text: "Der Termin entsteht im Buch. Die Karte ändert Uhrzeit, Status oder eine Notiz. Die Zahnärztin geht von der Karte zur Patientin. Der Empfang bleibt bei Namen und Buch.",
      shots: shots(files.appointments, ["Neuer Termin im Kalender", "Terminkarte"], ["Ein Slot, auf demselben Bildschirm.", "Den Besuch ändern, ohne ein zweites Programm."]),
    },
    {
      id: "record",
      title: "Eine Akte für das, was die Zahnärztin wissen muss.",
      text: "Identität, Vorgeschichte, Zähne, Untersuchungen, Behandlungen, Rezepte, Bescheinigungen, Anhänge und Zahlungen liegen bei derselben Person. Die Liste zeigt einen Status: in Behandlung, offene Rechnung oder geschlossen.",
      shots: shots(files.record, ["Patientenliste mit Status", "Vollständige Patientenakte"], ["Die Liste ist die schnelle Sicht.", "Die Person öffnen, die klinischen Seiten sind da."]),
    },
    {
      id: "clinical",
      title: "Untersuchen, behandeln, nachsehen, korrigieren.",
      text: "Eine Untersuchung beginnen, einen Zahn wählen, den Befund schreiben, speichern. Später wieder öffnen und ergänzen oder ändern. Eine Behandlung nennt die Leistung, die Zähne und ob sie abgerechnet werden kann.",
      shots: shots(files.clinical, ["Untersuchung mit Zahnschema", "Behandlungen der Patientin"], ["Schema und Notiz sind dieselbe Untersuchung.", "Jede Zeile sagt, was getan wurde und ob es abgerechnet werden kann."]),
    },
    {
      id: "documents",
      title: "Unterlagen bleiben an der Patientin. Man öffnet sie wieder.",
      text: "Briefe, Scans und Fotos liegen in der Akte. Man öffnet die Datei, wenn man sie braucht. Eine Datei anhängen geht heute. Einen Sensor oder eine DICOM-Studie lesen ist in Vorbereitung. MeDoc ist noch kein Röntgenplatz.",
      shots: shots(files.documents, ["Anhänge in der Akte"], ["An der Patientin gespeichert, bereit zum Öffnen."]),
    },
    {
      id: "papers",
      title: "Rezepte und Bescheinigungen, mit den Zeilen, die Sie wiederverwenden.",
      text: "Beides druckt auf dem Briefkopf der Praxis. In der Verwaltung liegen Medikamentenlisten, Rezeptvorlagen und Textvorlagen, damit ein bekanntes Rezept wenige Klicks braucht. Die Zeile lässt sich vor dem Druck noch ändern.",
      shots: shots(files.papers, ["Rezepte der Patientin"], ["Selbst schreiben oder von einer Vorlage starten."]),
    },
    {
      id: "money",
      title: "Quittungen, Rechnungen und das, was Sie Lieferanten noch schulden.",
      text: "Der Empfang bucht bar, Karte oder Scheck, auch eine Teilzahlung und den Rest. Die Zahnärztin sieht die Geldübersicht. Rechnungen sind ein eigener Weg, nicht die Kasse. Bestellungen zeigen, was beim Lieferanten liegt und was zu spät ist. Der Tagesabschluss prüft die Summen und sperrt den Tag.",
      shots: shots(files.money, ["Kasse", "Finanzübersicht", "Bestellungen"], ["Der Empfang nimmt das Geld.", "Die Zahnärztin sieht das Geld der Praxis.", "Bestellungen: offen, da oder zu spät."]),
    },
    {
      id: "flow",
      title: "Aufgaben, Freigabe, Status und eine Glocke, wenn sich etwas ändert.",
      text: "Eine Aufgabe kann den Empfang bitten, einen Termin zu legen. Akten, die noch die Zahnärztin brauchen, haben eine eigene Liste. Hinweise sammeln, was sich geändert hat. Der Status in der Patientenliste ist die schnelle Sicht. Der Empfang öffnet die Freigabeliste nicht.",
      shots: shots(files.flow, ["Praxisaufgaben", "Akten zur Freigabe", "Hinweise"], ["Übergaben bleiben im Menü.", "Die Zahnärztin gibt frei, was wartet.", "Die Glocke, ohne die Seite zu verlassen."]),
    },
    {
      id: "numbers",
      title: "Die Zahlen dieser Praxis.",
      text: "Statistik ist ein Bildschirm der Zahnärztin. Ein Zeitraum: Patienten, Termine, Behandlungen, Einnahmen und offene Bestellungen dieser Praxis. Der Empfang hat diese Seite nicht.",
      shots: shots(files.numbers, ["Praxisstatistik"], ["Zahlen dieser Praxis, für den gewählten Zeitraum."]),
    },
    {
      id: "time",
      title: "Stunden, für sich und für das Team.",
      text: "Jede Person stempelt ihre Zeit. In der Verwaltung öffnet die Zahnärztin die Stunden des Teams.",
      shots: shots(files.time, ["Arbeitszeit"], ["Kommen, gehen, der Tag."]),
    },
    {
      id: "administration",
      title: "Verwaltung: Team, Leistungen, Vorlagen, Daten und Updates.",
      text: "Team: Personal und Stunden. Finanzberichte: Tagesabschluss, Rechnungen, Bilanzen. Lager und Bestellung: Produkte, Lieferantendaten, Verträge. Leistungen: Behandlungskatalog, Medikamente, Rezeptvorlagen, Textvorlagen. Praxisplanung: Arbeitstage, Arbeitszeiten, Sperrzeiten, Einstellungen.",
      shots: shots(files.administration, ["Verwaltung"], ["Die Kategorien, die das Programm wirklich hat."]),
    },
    {
      id: "settings",
      title: "Die Praxis, das Konto und die Sperre am Stuhl.",
      text: "Einstellungen halten das Praxisprofil, das Konto, Hinweise, Sicherheit, die Lizenz und das Aussehen, einschließlich der vier Sprachen. Sicherheit zeigt das Protokoll, wer angemeldet ist, und eine Sperre, wenn der Stuhl stillsteht. Die Sicherung ist für die Zahnärztin.",
      shots: shots(files.settings, ["Einstellungen", "Sicherheit"], ["Aussehen, Sprache und Praxisprofil.", "Das Protokoll, die Sitzungen und die Leerlaufsperre."]),
    },
  ],
};
