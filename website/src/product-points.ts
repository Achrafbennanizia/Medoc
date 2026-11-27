// The concrete points under each feature on #/features. Every line is a true claim from
// docs/brand/site-facts.md. A point that is not in all three editions names its editions (`ed`);
// a point under a feature that is already limited to some editions needs no tag of its own.
import type { Lang } from "./i18n";
import type { Ed, FeatureId } from "./product-copy";

export type Point = { t: string; ed?: Exclude<Ed, "all"> };
type Points = Record<FeatureId, (string | Point)[]>;

const cab = (t: string): Point => ({ t, ed: "cabinet" });
const plus = (t: string): Point => ({ t, ed: "plus" });
const ess = (t: string): Point => ({ t, ed: "essentiel" });

const en: Points = {
  changes: [
    cab("Reception sends a patient's chart to you with a short note. It appears in your To validate list, with a count in the sidebar. You validate or decline it, and each step is logged."),
    ess("A helper signs in as a guest. Their new appointments, patient details and cash payments wait in your Inbox until you click Add or Dismiss."),
    "The activity log records who created or changed a record, validated a chart or exported data, and when.",
    "Each entry is chained to the one before with a cryptographic HMAC, so an altered or deleted entry shows.",
    "Page through the log or export it as CSV. Reception accounts cannot open it by default. Each computer keeps its own log.",
  ],
  "day-close": [
    "Bank transfers are added up for you. You only type the cash and, if you have one, the card terminal total.",
    "A day with a difference cannot be closed without a written reason.",
    "Each closing is final and gets a numbered report.",
    "A mistake is fixed with a correction that points to the original, never by editing it.",
    "Cash added to or taken from the drawer, bank deposits and cash expenses are recorded with a reason, and flow into the next close.",
  ],
  calendar: [
    "Moves snap to 5-minute steps inside opening hours.",
    "Breaks and absences are refused, so an appointment never lands on them.",
    "Changed your mind? Undo puts the appointment back.",
    "The month view shows how full each day is. Click a day to open it.",
    plus("Two to four doctors' agendas sit side by side in the day view."),
  ],
  flags: [
    "A doctor cannot be double-booked, and bookings in breaks, closures or absences are refused.",
    "Change your opening hours and MeDoc warns you about the appointments left outside them.",
    "Before a prescription is issued, its active substance is checked against the allergies in the medical history, by name and by drug group. You confirm before it goes out. The check covers common dental drug groups and does not replace a drug database.",
    "The patient header shows the basics still missing: insurance number, medical history, tooth findings, examination.",
    cab("At day close, a gap between the counted cash and the cash book, or between the card terminal and the recorded card payments, asks for a reason."),
    cab("Edits made on two computers at once go to the admin's conflict list instead of being lost."),
  ],
  statistics: [
    "The comparison uses the same part of last month, so a month in progress does not look like a drop.",
    "See your treatment mix by category and your income by payment method.",
    "Every figure is a real count or amount from your own records.",
    "A figure that fell shows in red. To see why, open the chart behind it.",
    plus("Compare your dentists side by side and filter by doctor."),
  ],
  patients: [
    "On the Patients page, search by name, phone, email or insurance number. Misspell a name and MeDoc suggests the right one.",
    "Book an appointment, write a prescription, email or call straight from the patient list.",
    "A new patient's details and medical history, allergies included, go into one form.",
  ],
  tasks: [
    "For billing, printing or patient-data tasks, reception marks the task done with a note or a linked payment. You confirm it or send it back with a reason.",
    "Both sides can comment on a task.",
    "Reception can send you a ticket the same way.",
    "Your plan for the next appointment goes to reception in one click.",
  ],
  orders: [
    "Each order keeps its expected date and its price.",
    "When an order is delivered, its quantity is added to the product's stock.",
    "For any month, quarter or year, the period report sets the money you received against your spending: delivered orders and running contracts. Each saved report is numbered and cannot be changed.",
    cab("Cash expenses recorded with the day close appear in the period report too."),
  ],
  shortcuts: ["Shortcuts pause while you type in a field, so they never get in the way.", "⌘/ opens the full, searchable list in Help."],
  "status-rules": [
    "A completed appointment cannot go back to planned, and a paid payment cannot be reopened.",
    "An issued prescription is never overwritten. A correction creates a new version and marks the old one replaced.",
    "An invoice is cancelled with a numbered credit note that refers to it. Nothing is deleted.",
    "Help, Status guide explains every status, built from the same definitions the screens use.",
  ],
  backups: [
    "Restoring takes one click in Settings, Backups. MeDoc first saves a copy of today's data and puts it back if the restore fails.",
    "Each backup carries a signature that MeDoc checks. A damaged or altered backup is flagged and cannot be restored.",
    "A backup is much smaller than the database: under a third in our tests.",
    "Backups run while MeDoc is open. If the drive is missing, the backup goes to the computer's own folder and the page tells you.",
  ],
  "tooth-chart": [
    "Pick a status (caries, filling, crown, root fracture, missing, implant, planned) and click a tooth.",
    "Statuses can be combined on one tooth, and contradicting ones are cleared automatically.",
    "Every tooth can be reached by keyboard and is named for screen readers.",
  ],
};

const fr: Points = {
  changes: [
    cab("L'accueil vous envoie le dossier d'un patient avec une courte note. Il apparaît dans votre liste « À valider », avec un compteur dans le menu. Vous le validez ou le refusez, et chaque étape est journalisée."),
    ess("Un aide se connecte en invité. Ses nouveaux rendez-vous, données patients et paiements en espèces attendent dans votre boîte de réception jusqu'à ce que vous cliquiez sur Ajouter ou Écarter."),
    "Le journal d'activité enregistre qui a créé ou modifié une fiche, validé un dossier ou exporté des données, et quand.",
    "Chaque entrée est chaînée à la précédente par un HMAC cryptographique : une entrée modifiée ou supprimée se voit.",
    "Parcourez le journal ou exportez-le en CSV. Par défaut, les comptes de l'accueil ne peuvent pas l'ouvrir. Chaque ordinateur tient son propre journal.",
  ],
  "day-close": [
    "Les virements sont additionnés pour vous. Vous ne saisissez que les espèces et, si vous en avez un, le total du terminal de carte.",
    "Une journée avec un écart ne se clôture pas sans motif écrit.",
    "Chaque clôture est définitive et reçoit un rapport numéroté.",
    "Une erreur se corrige par une correction qui renvoie à l'original, jamais en le modifiant.",
    "Les apports et retraits de caisse, les versements en banque et les dépenses en espèces sont saisis avec un motif et entrent dans la clôture suivante.",
  ],
  calendar: [
    "Le déplacement se cale par pas de 5 minutes, dans les horaires d'ouverture.",
    "Pauses et absences sont refusées : un rendez-vous n'y atterrit jamais.",
    "Vous changez d'avis ? Annuler remet le rendez-vous à sa place.",
    "La vue mois montre le remplissage de chaque jour. Un clic sur un jour l'ouvre.",
    plus("Les agendas de deux à quatre praticiens côte à côte, en vue jour."),
  ],
  flags: [
    "Un praticien ne peut pas avoir deux rendez-vous en même temps, et les rendez-vous pendant une pause, une fermeture ou une absence sont refusés.",
    "Si vous changez vos horaires, MeDoc vous avertit des rendez-vous qui se retrouvent en dehors.",
    "Avant l'émission d'une ordonnance, la substance active est comparée aux allergies de l'anamnèse, par nom et par famille de médicaments. Vous confirmez avant l'émission. Le contrôle couvre les familles courantes en dentaire et ne remplace pas une base de médicaments.",
    "L'en-tête du patient montre les données de base qui manquent : numéro d'assurance, anamnèse, constats dentaires, examen.",
    cab("À la clôture, un écart entre les espèces comptées et le livre de caisse, ou entre le terminal de carte et les paiements par carte enregistrés, demande un motif."),
    cab("Une modification faite en même temps sur deux ordinateurs va dans la liste des conflits de l'administrateur au lieu d'être perdue."),
  ],
  statistics: [
    "La comparaison se fait avec la même partie du mois précédent : un mois en cours ne ressemble pas à une baisse.",
    "Voyez la répartition de vos soins par catégorie et vos recettes par mode de paiement.",
    "Chaque chiffre est un compte ou un montant réel, tiré de vos propres dossiers.",
    "Un chiffre en baisse s'affiche en rouge. Pour comprendre pourquoi, ouvrez le graphique correspondant.",
    plus("Comparez vos dentistes côte à côte et filtrez par praticien."),
  ],
  patients: [
    "Sur la page Patients, cherchez par nom, téléphone, e-mail ou numéro d'assurance. Une faute dans un nom ? MeDoc propose le bon.",
    "Prenez rendez-vous, rédigez une ordonnance, écrivez ou appelez directement depuis la liste des patients.",
    "Les données d'un nouveau patient et son anamnèse, allergies comprises, tiennent dans un seul formulaire.",
  ],
  tasks: [
    "Pour une tâche de facturation, d'impression ou de données patient, l'accueil la marque terminée avec une note ou un paiement lié. Vous la confirmez ou la renvoyez avec un motif.",
    "Chacun peut commenter la tâche.",
    "L'accueil peut vous envoyer un ticket de la même façon.",
    "Votre plan pour le prochain rendez-vous part à l'accueil en un clic.",
  ],
  orders: [
    "Chaque commande garde sa date prévue et son prix.",
    "À la livraison, la quantité s'ajoute au stock du produit.",
    "Pour un mois, un trimestre ou une année, le bilan de période met en regard l'argent encaissé et vos dépenses : commandes livrées et contrats en cours. Chaque bilan enregistré est numéroté et ne peut plus être modifié.",
    cab("Les dépenses en espèces saisies avec la clôture journalière y figurent aussi."),
  ],
  shortcuts: ["Les raccourcis se mettent en pause pendant que vous tapez dans un champ : ils ne gênent jamais.", "⌘/ ouvre la liste complète, avec recherche, dans l'Aide."],
  "status-rules": [
    "Un rendez-vous terminé ne repasse pas en planifié, et un paiement réglé ne se rouvre pas.",
    "Une ordonnance émise n'est jamais écrasée : une correction crée une nouvelle version et marque l'ancienne comme remplacée.",
    "Une facture s'annule par un avoir numéroté qui y fait référence. Rien n'est supprimé.",
    "Aide, Guide des statuts explique chaque statut, à partir des mêmes définitions que les écrans.",
  ],
  backups: [
    "La restauration se fait en un clic dans Paramètres, Sauvegardes. MeDoc enregistre d'abord une copie des données du jour et la remet en place si la restauration échoue.",
    "Chaque sauvegarde porte une signature que MeDoc vérifie. Une sauvegarde abîmée ou modifiée est signalée et ne peut pas être restaurée.",
    "Une sauvegarde est bien plus petite que la base : moins d'un tiers dans nos tests.",
    "La sauvegarde tourne quand MeDoc est ouvert. Si le disque manque, elle va dans le dossier de l'ordinateur et la page vous le dit.",
  ],
  "tooth-chart": [
    "Choisissez un statut (carie, obturation, couronne, fracture radiculaire, absente, implant, prévu) et cliquez sur une dent.",
    "Plusieurs statuts peuvent se combiner sur une dent, et ceux qui se contredisent sont retirés automatiquement.",
    "Chaque dent est accessible au clavier et nommée pour les lecteurs d'écran.",
  ],
};

const ar: Points = {
  changes: [
    cab("يرسل الاستقبال ملف المريض إليك مع ملاحظة قصيرة. يظهر في قائمة «للمصادقة» مع عدّاد في القائمة الجانبية. تصادق عليه أو ترفضه، وتُسجَّل كل خطوة."),
    ess("يدخل المساعد بحساب ضيف. مواعيده الجديدة وبيانات المرضى والمدفوعات النقدية تنتظر في صندوق الوارد حتى تنقر على «إضافة» أو «تجاهل»."),
    "يسجّل سجل النشاط من أنشأ ملفًا أو عدّله، ومن صادق على ملف أو صدّر بيانات، ومتى.",
    "كل إدخال مرتبط بالذي قبله بتوقيع HMAC تشفيري، فيظهر أي إدخال عُدِّل أو حُذف.",
    "تصفّح السجل أو صدّره بصيغة CSV. حسابات الاستقبال لا تفتحه افتراضيًا. ولكل حاسوب سجلّه الخاص.",
  ],
  "day-close": [
    "التحويلات البنكية تُجمع من أجلك. لا تُدخل إلا النقد، ومجموع جهاز البطاقة إن كان لديك.",
    "لا يُغلق يوم فيه فرق دون سبب مكتوب.",
    "كل إغلاق نهائي، وله تقرير مرقّم.",
    "يُصحَّح الخطأ بتصحيح يحيل إلى الأصل، ولا يُعدَّل الأصل أبدًا.",
    "المبالغ المضافة إلى الصندوق والمسحوبة منه، والإيداعات في البنك، والمصاريف النقدية تُسجَّل مع سببها وتدخل في الإغلاق التالي.",
  ],
  calendar: [
    "يُضبط النقل على خطوات من 5 دقائق داخل ساعات العمل.",
    "الاستراحات والغيابات مرفوضة، فلا يقع موعد عليها أبدًا.",
    "غيّرت رأيك؟ زر التراجع يعيد الموعد إلى مكانه.",
    "عرض الشهر يبيّن امتلاء كل يوم، وبنقرة على اليوم يُفتح.",
    plus("مواعيد طبيبين إلى أربعة أطباء جنبًا إلى جنب في عرض اليوم."),
  ],
  flags: [
    "لا يمكن حجز موعدين للطبيب نفسه في الوقت نفسه، وتُرفض المواعيد أثناء الاستراحة أو الإغلاق أو الغياب.",
    "إذا غيّرت ساعات العمل، ينبّهك MeDoc إلى المواعيد التي صارت خارجها.",
    "قبل إصدار الوصفة تُقارَن المادة الفعالة بالحساسية المسجّلة في السوابق الطبية، بالاسم وبفئة الدواء، وتؤكّد أنت قبل الإصدار. يشمل الفحص فئات الأدوية الشائعة في طب الأسنان، ولا يغني عن قاعدة بيانات للأدوية.",
    "رأس ملف المريض يُظهر البيانات الأساسية الناقصة: رقم التأمين، والسوابق الطبية، ونتائج فحص الأسنان، والفحص.",
    cab("عند إغلاق اليوم، أي فرق بين النقد المعدود ودفتر الصندوق، أو بين جهاز البطاقة ومدفوعات البطاقة المسجّلة، يتطلب سببًا."),
    cab("التعديل الذي يُجرى في الوقت نفسه على حاسوبين يذهب إلى قائمة تعارضات المسؤول بدل أن يضيع."),
  ],
  statistics: [
    "تتم المقارنة مع الجزء نفسه من الشهر الماضي، فلا يبدو الشهر الجاري تراجعًا.",
    "اطّلع على توزيع علاجاتك حسب الفئة، ومداخيلك حسب طريقة الدفع.",
    "كل رقم عدد أو مبلغ حقيقي من ملفاتك أنت.",
    "الرقم المتراجع يظهر بالأحمر. لمعرفة السبب، افتح الرسم البياني الخاص به.",
    plus("قارن أطباء الأسنان جنبًا إلى جنب، وصفِّ النتائج حسب الطبيب."),
  ],
  patients: [
    "في صفحة المرضى ابحث بالاسم أو الهاتف أو البريد الإلكتروني أو رقم التأمين. أخطأت في كتابة الاسم؟ يقترح MeDoc الاسم الصحيح.",
    "احجز موعدًا، أو اكتب وصفة، أو راسل المريض أو اتصل به مباشرة من قائمة المرضى.",
    "بيانات المريض الجديد وسوابقه الطبية، ومنها الحساسية، في نموذج واحد.",
  ],
  tasks: [
    "في مهام الفوترة أو الطباعة أو بيانات المريض، يعلّم الاستقبال المهمة منجزة مع ملاحظة أو دفعة مرتبطة، فتؤكّدها أو تعيدها مع السبب.",
    "يمكن للطرفين التعليق على المهمة.",
    "ويستطيع الاستقبال أن يرسل إليك تذكرة بالطريقة نفسها.",
    "خطتك للموعد القادم تصل إلى الاستقبال بنقرة واحدة.",
  ],
  orders: [
    "تحتفظ كل طلبية بتاريخها المتوقع وسعرها.",
    "عند الاستلام تُضاف الكمية إلى مخزون المنتج.",
    "لأي شهر أو ربع سنة أو سنة، يضع تقرير الفترة ما قبضته مقابل مصاريفك: الطلبيات المستلمة والعقود الجارية. كل تقرير محفوظ مرقّم ولا يمكن تغييره.",
    cab("وتظهر فيه أيضًا المصاريف النقدية المسجّلة مع إغلاق اليوم."),
  ],
  shortcuts: ["تتوقف الاختصارات أثناء الكتابة في حقل، فلا تعترض عملك أبدًا.", "⌘/ يفتح القائمة الكاملة، مع البحث، في المساعدة."],
  "status-rules": [
    "الموعد المكتمل لا يعود إلى «مخطط»، والدفعة المؤدّاة لا يُعاد فتحها.",
    "الوصفة الصادرة لا يُكتب فوقها أبدًا: التصحيح ينشئ نسخة جديدة ويعلّم القديمة بأنها مستبدلة.",
    "تُلغى الفاتورة بفاتورة تصحيحية مرقّمة تحيل إليها، ولا يُحذف شيء.",
    "دليل الحالات في المساعدة يشرح كل حالة، انطلاقًا من التعريفات نفسها التي تستعملها الشاشات.",
  ],
  backups: [
    "الاستعادة بنقرة واحدة في الإعدادات، قسم النسخ الاحتياطية. يحفظ MeDoc أولًا نسخة من بيانات اليوم، ويعيدها إذا فشلت الاستعادة.",
    "تحمل كل نسخة توقيعًا يتحقق منه MeDoc. النسخة التالفة أو المعدّلة تُعلَّم ولا يمكن استعادتها.",
    "النسخة أصغر بكثير من قاعدة البيانات: أقل من الثلث في اختباراتنا.",
    "تعمل النسخ الاحتياطية ما دام MeDoc مفتوحًا. إذا غاب القرص، تُحفظ النسخة في مجلد الحاسوب نفسه وتخبرك الصفحة بذلك.",
  ],
  "tooth-chart": [
    "اختر حالة (تسوّس، حشوة، تاج، كسر الجذر، مفقود، زرعة، مخطط له) وانقر على السن.",
    "يمكن الجمع بين عدة حالات على سن واحد، وتُزال الحالات المتناقضة تلقائيًا.",
    "يمكن الوصول إلى كل سن بلوحة المفاتيح، ولكل سن اسم تقرؤه برامج قراءة الشاشة.",
  ],
};

export const PRODUCT_POINTS: Record<Lang, Points> = { en, fr, ar };
