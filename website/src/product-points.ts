// Concrete details shown under each product section. Every line maps to a shipped feature
// (routes, status guide docs/manual/status-guide.*.md, settings sections). Keep it that way.
import type { Lang } from "./i18n";

type Points = Partial<Record<string, string[]>> & { trust: string[] };

const en: Points = {
  calendar: [
    "The month colours each day by how full it is, so open days stand out.",
    "Drag a card to another time or day. It snaps to the grid, the gutter shows the new time, and an overlap is refused.",
    "Insert an emergency: it goes before the next free appointment and the later visits shift automatically.",
    "Practice hours, absences and blocked times are greyed out. A break is one click.",
  ],
  appointments: [
    "The status follows the visit: Planned, Confirmed, In progress, Completed. No-show and Cancelled free the slot.",
    "Complaints are tags (toothache, bleeding, check-up…). A toothache can point to the exact teeth.",
    "Practice hours and conflicts are checked while you pick the time.",
  ],
  record: [
    "List tabs: New, In treatment, Treatment completed, Invoice open, Record open.",
    "The header shows the dental chart. Hover a tooth to see its findings, examination notes and treatments.",
    "The anamnesis holds insurance, chronic conditions, medication and allergies, with the patient's signature.",
    "Export the record as a PDF, or send a task to reception from it.",
  ],
  clinical: [
    "An examination covers complaint and pain score, extra- and intraoral findings, PSI per sextant, bleeding and plaque, function, imaging, diagnosis and plan.",
    "The price comes from your treatment catalog and is confirmed before saving.",
    "Treatments are Planned, In progress, Completed, Discontinued or Cancelled. Multi-session work keeps its session number.",
    "A record goes Draft, In review, Validated. A declined record comes back with the reason.",
  ],
  documents: [
    "Each file has a type: X-ray, CT, MRI, lab, referral, consent or other.",
    "Drop a file on the record, or take a photo with the camera.",
  ],
  papers: [
    "A preset can hold several medicines, for example antibiotic, painkiller and mouthwash after implant surgery.",
    "Before issuing, each medicine is checked against the allergies in the anamnesis. A conflict needs an explicit confirmation.",
    "Correcting an issued prescription creates a new version. The old one is kept for the audit trail.",
    "Certificates and sick-leave notes start from templates you write once.",
  ],
  money: [
    "Payment status follows the bookings: Outstanding, Partially paid, Paid.",
    "An invoice becomes Overdue on its due date, and a reminder can be printed.",
    "Day close compares each payment method with the till and locks the day. A correction creates a new version.",
    "Orders go Open, In transit, Delivered. Delivery books the stock.",
  ],
  flow: [
    "Task types: appointment, billing, master data, print and other.",
    "A task goes Open, In progress, Done and awaiting review, Validated. The creator can return it with a reason.",
    "The overview lists approvals waiting and orders to check, so nothing sits unseen.",
  ],
  time: ["Start, pause and end a session. Breaks are not counted.", "The dentist sees the team's hours and can correct a session."],
  settings: [
    "The screen locks after inactivity. Each signed-in device can be marked trusted or suspicious.",
    "A letterhead designer sets what prints on prescriptions, invoices and receipts.",
    "Each computer has a network role: main computer, or a device paired to it.",
  ],
  trust: [
    "Passwords are hashed with Argon2. Repeated wrong passwords lock the sign-in.",
    "The audit log is chained with an HMAC, so a removed line shows.",
    "Updates are signed. An update with a bad signature is refused.",
    "Changes made offline wait in a crash-safe queue and are sent when the main computer is back. The top bar shows Connected, Syncing or Offline.",
  ],
};

const fr: Points = {
  calendar: [
    "Le mois colore chaque jour selon son remplissage : les jours libres se voient tout de suite.",
    "Glissez une carte vers une autre heure ou un autre jour. Elle s'aligne sur la grille, la nouvelle heure s'affiche et un chevauchement est refusé.",
    "Insérez une urgence : elle se place avant le prochain rendez-vous libre et les visites suivantes se décalent automatiquement.",
    "Horaires du cabinet, absences et créneaux bloqués sont grisés. Une pause s'ajoute en un clic.",
  ],
  appointments: [
    "Le statut suit la visite : Planifié, Confirmé, En cours, Terminé. Absent et Annulé libèrent le créneau.",
    "Les plaintes sont des étiquettes (douleur dentaire, saignement, contrôle…). Une douleur peut désigner les dents exactes.",
    "Horaires et conflits sont vérifiés pendant que vous choisissez l'heure.",
  ],
  record: [
    "Onglets de la liste : Nouveaux, En traitement, Traitement terminé, Facture ouverte, Dossier ouvert.",
    "L'en-tête montre le schéma dentaire. Survolez une dent pour voir ses constats, notes d'examen et traitements.",
    "L'anamnèse contient couverture, affections chroniques, médicaments et allergies, avec la signature du patient.",
    "Exportez le dossier en PDF, ou envoyez une tâche à l'accueil depuis le dossier.",
  ],
  clinical: [
    "Un examen couvre motif et douleur, constats extra- et intrabuccaux, PSI par sextant, saignement et plaque, fonction, imagerie, diagnostic et plan.",
    "Le prix vient de votre catalogue d'actes et se confirme avant l'enregistrement.",
    "Les traitements sont Planifiés, En cours, Terminés, Interrompus ou Annulés. Les soins en plusieurs séances gardent leur numéro de séance.",
    "Un dossier passe de Brouillon à En revue puis Validé. Un dossier refusé revient avec le motif.",
  ],
  documents: [
    "Chaque fichier a un type : radiographie, scanner, IRM, laboratoire, courrier, consentement ou autre.",
    "Déposez un fichier sur le dossier, ou prenez une photo avec la caméra.",
  ],
  papers: [
    "Un modèle peut contenir plusieurs médicaments, par exemple antibiotique, antalgique et bain de bouche après une pose d'implant.",
    "Avant l'émission, chaque médicament est comparé aux allergies de l'anamnèse. Un conflit demande une confirmation explicite.",
    "Corriger une ordonnance émise crée une nouvelle version. L'ancienne est conservée pour la traçabilité.",
    "Certificats et arrêts de travail partent de modèles rédigés une seule fois.",
  ],
  money: [
    "Le statut du paiement suit les encaissements : En attente, Partiellement payé, Payé.",
    "Une facture passe En retard à l'échéance, et une relance peut être imprimée.",
    "La clôture compare chaque mode de paiement à la caisse et verrouille la journée. Une correction crée une nouvelle version.",
    "Les commandes passent de Ouverte à En transit puis Livrée. La livraison met le stock à jour.",
  ],
  flow: [
    "Types de tâches : rendez-vous, facturation, données de base, impression et autre.",
    "Une tâche passe de Ouverte à En cours, Terminée en attente de contrôle, puis Validée. Son auteur peut la renvoyer avec un motif.",
    "La vue générale liste les validations en attente et les commandes à vérifier : rien ne reste dans l'ombre.",
  ],
  time: ["Démarrez, mettez en pause et terminez une session. Les pauses ne sont pas comptées.", "Le dentiste voit les heures de l'équipe et peut corriger une session."],
  settings: [
    "L'écran se verrouille après inactivité. Chaque appareil connecté peut être marqué de confiance ou suspect.",
    "Un éditeur d'en-tête règle ce qui s'imprime sur ordonnances, factures et reçus.",
    "Chaque ordinateur a un rôle réseau : ordinateur principal, ou appareil associé.",
  ],
  trust: [
    "Les mots de passe sont hachés avec Argon2. Des erreurs répétées bloquent la connexion.",
    "Le journal d'audit est chaîné par HMAC : une ligne supprimée se voit.",
    "Les mises à jour sont signées. Une mise à jour à la signature invalide est refusée.",
    "Les modifications faites hors ligne attendent dans une file protégée contre les plantages et partent au retour de l'ordinateur principal. La barre du haut indique En ligne, Synchronisation ou Hors ligne.",
  ],
};

const ar: Points = {
  calendar: [
    "يلوّن عرض الشهر كل يوم حسب امتلائه، فتظهر الأيام الفارغة فورًا.",
    "اسحب البطاقة إلى وقت أو يوم آخر. تلتصق بالشبكة ويظهر الوقت الجديد، ويُرفض أي تداخل.",
    "أدرج حالة طارئة: توضع قبل الموعد الحر التالي وتتأخر المواعيد اللاحقة تلقائيًا.",
    "تظهر ساعات العيادة والغيابات والأوقات المحجوبة باللون الرمادي، وتُضاف الاستراحة بنقرة واحدة.",
  ],
  appointments: [
    "تتبع الحالة الزيارة: مخطط، مؤكد، جارٍ، مكتمل. الغياب والإلغاء يحرّران الموعد.",
    "الشكاوى وسوم (ألم أسنان، نزيف، فحص…)، ويمكن للألم أن يحدد الأسنان بدقة.",
    "تُفحص ساعات العيادة والتعارضات أثناء اختيار الوقت.",
  ],
  record: [
    "تبويبات القائمة: جديد، قيد العلاج، علاج مكتمل، فاتورة مفتوحة، ملف مفتوح.",
    "يعرض رأس الملف مخطط الأسنان. مرّر المؤشر على سن لترى ملاحظاته ونتائج الفحص والعلاجات.",
    "يضم الاستبيان الطبي التغطية والأمراض المزمنة والأدوية والحساسية، مع توقيع المريض.",
    "صدّر الملف بصيغة PDF، أو أرسل مهمة إلى الاستقبال من داخله.",
  ],
  clinical: [
    "يشمل الفحص الشكوى ودرجة الألم، والنتائج خارج الفم وداخله، ومؤشر PSI لكل سدس، والنزيف واللويحة، والوظيفة، والتصوير، والتشخيص والخطة.",
    "يأتي السعر من دليل الإجراءات ويُؤكَّد قبل الحفظ.",
    "العلاجات: مخطط، جارٍ، مكتمل، متوقف أو ملغى. ويحتفظ العلاج متعدد الجلسات برقم جلسته.",
    "ينتقل الملف من مسودة إلى قيد المراجعة ثم معتمد. والملف المرفوض يعود مع السبب.",
  ],
  documents: [
    "لكل ملف نوع: أشعة، تصوير مقطعي، رنين مغناطيسي، مختبر، إحالة، موافقة أو غير ذلك.",
    "أسقط الملف على السجل، أو التقط صورة بالكاميرا.",
  ],
  papers: [
    "يمكن للنموذج أن يضم عدة أدوية، مثل مضاد حيوي ومسكّن وغسول فم بعد زرع سن.",
    "قبل الإصدار يُقارَن كل دواء بالحساسية المسجلة في الاستبيان، ويتطلب التعارض تأكيدًا صريحًا.",
    "تصحيح وصفة صادرة ينشئ نسخة جديدة، وتُحفظ القديمة في سجل التتبع.",
    "الشهادات وشهادات التوقف عن العمل تبدأ من نماذج تُكتب مرة واحدة.",
  ],
  money: [
    "تتبع حالة الدفع التحصيلات: مستحق، مدفوع جزئيًا، مدفوع.",
    "تصبح الفاتورة متأخرة عند تاريخ الاستحقاق، ويمكن طباعة تذكير.",
    "يقارن إغلاق اليوم كل طريقة دفع بالصندوق ويقفل اليوم، والتصحيح ينشئ نسخة جديدة.",
    "تنتقل الطلبيات من مفتوحة إلى قيد الشحن ثم مستلمة، والاستلام يحدّث المخزون.",
  ],
  flow: [
    "أنواع المهام: موعد، فوترة، بيانات أساسية، طباعة وغير ذلك.",
    "تنتقل المهمة من مفتوحة إلى قيد التنفيذ ثم منجزة بانتظار المراجعة ثم معتمدة، ويمكن لصاحبها إعادتها مع السبب.",
    "تعرض النظرة العامة الاعتمادات المنتظرة والطلبيات التي يجب التحقق منها، فلا يبقى شيء دون متابعة.",
  ],
  time: ["ابدأ الجلسة وأوقفها مؤقتًا وأنهِها، ولا تُحتسب الاستراحات.", "يرى الطبيب ساعات الفريق ويمكنه تصحيح جلسة."],
  settings: [
    "تُقفل الشاشة بعد عدم النشاط، ويمكن وسم كل جهاز متصل بأنه موثوق أو مشبوه.",
    "أداة تصميم الترويسة تحدد ما يُطبع على الوصفات والفواتير والإيصالات.",
    "لكل حاسوب دور في الشبكة: الحاسوب الرئيسي، أو جهاز مقترن به.",
  ],
  trust: [
    "تُخزَّن كلمات المرور بتجزئة Argon2، وتؤدي الأخطاء المتكررة إلى قفل تسجيل الدخول.",
    "سجل التدقيق متسلسل بتوقيع HMAC، فأي سطر محذوف يظهر.",
    "التحديثات موقّعة، ويُرفض أي تحديث بتوقيع غير صالح.",
    "التغييرات المنجزة دون اتصال تنتظر في قائمة محمية من الأعطال وتُرسل عند عودة الحاسوب الرئيسي. يعرض الشريط العلوي: متصل، مزامنة أو غير متصل.",
  ],
};

const de: Points = {
  calendar: [
    "Der Monat färbt jeden Tag nach Auslastung – freie Tage fallen sofort auf.",
    "Ziehen Sie eine Karte auf eine andere Uhrzeit oder einen anderen Tag. Sie rastet im Raster ein, die neue Zeit wird angezeigt, Überschneidungen werden abgelehnt.",
    "Notfall einfügen: Er kommt vor den nächsten freien Termin, spätere Termine rücken automatisch nach.",
    "Praxiszeiten, Abwesenheiten und Sperrzeiten sind ausgegraut. Eine Pause ist ein Klick.",
  ],
  appointments: [
    "Der Status folgt dem Besuch: Geplant, Bestätigt, In Behandlung, Abgeschlossen. Nicht erschienen und Abgesagt geben den Slot frei.",
    "Beschwerden sind Schlagwörter (Zahnschmerz, Blutung, Kontrolle …). Zahnschmerz kann die genauen Zähne benennen.",
    "Praxiszeiten und Konflikte werden schon bei der Zeitwahl geprüft.",
  ],
  record: [
    "Listen-Tabs: Neu, In Behandlung, Behandlung abgeschlossen, Rechnung offen, Akte offen.",
    "Der Kopf zeigt das Zahnschema. Fahren Sie über einen Zahn, um Befunde, Untersuchungsnotizen und Behandlungen zu sehen.",
    "Die Anamnese enthält Versicherung, Vorerkrankungen, Medikamente und Allergien, mit Unterschrift des Patienten.",
    "Exportieren Sie die Akte als PDF oder schicken Sie von dort eine Aufgabe an den Empfang.",
  ],
  clinical: [
    "Eine Untersuchung umfasst Anliegen und Schmerz, extra- und intraorale Befunde, PSI je Sextant, Blutung und Plaque, Funktion, Bildgebung, Diagnose und Plan.",
    "Der Preis kommt aus Ihrem Leistungskatalog und wird vor dem Speichern bestätigt.",
    "Behandlungen sind Geplant, In Behandlung, Abgeschlossen, Abgebrochen oder Storniert. Mehrere Sitzungen behalten ihre Sitzungsnummer.",
    "Eine Akte geht von Entwurf über In Prüfung zu Freigegeben. Eine abgelehnte Akte kommt mit Begründung zurück.",
  ],
  documents: [
    "Jede Datei hat einen Typ: Röntgen, CT, MRT, Labor, Überweisung, Einwilligung oder Sonstiges.",
    "Datei auf die Akte ziehen oder mit der Kamera ein Foto aufnehmen.",
  ],
  papers: [
    "Eine Vorlage kann mehrere Medikamente enthalten, etwa Antibiotikum, Schmerzmittel und Mundspülung nach einer Implantation.",
    "Vor dem Ausstellen wird jedes Medikament mit den Allergien der Anamnese abgeglichen. Ein Konflikt verlangt eine ausdrückliche Bestätigung.",
    "Die Korrektur eines ausgestellten Rezepts erzeugt eine neue Version. Die alte bleibt für den Prüfpfad erhalten.",
    "Bescheinigungen und Arbeitsunfähigkeiten starten aus einmal geschriebenen Vorlagen.",
  ],
  money: [
    "Der Zahlungsstatus folgt den Buchungen: Offen, Teilweise bezahlt, Bezahlt.",
    "Eine Rechnung wird zum Fälligkeitstag überfällig, eine Mahnung kann gedruckt werden.",
    "Der Tagesabschluss vergleicht jede Zahlungsart mit der Kasse und sperrt den Tag. Eine Korrektur erzeugt eine neue Version.",
    "Bestellungen gehen von Offen über Unterwegs zu Geliefert. Die Lieferung bucht den Bestand.",
  ],
  flow: [
    "Aufgabentypen: Termin, Abrechnung, Stammdaten, Druck und Sonstiges.",
    "Eine Aufgabe geht von Offen über In Bearbeitung und Erledigt – Prüfung offen zu Bestätigt. Der Ersteller kann sie mit Begründung zurückgeben.",
    "Die Übersicht zeigt offene Freigaben und zu prüfende Bestellungen – nichts bleibt liegen.",
  ],
  time: ["Sitzung starten, pausieren und beenden. Pausen zählen nicht.", "Der Zahnarzt sieht die Stunden des Teams und kann eine Sitzung korrigieren."],
  settings: [
    "Der Bildschirm sperrt nach Inaktivität. Jedes angemeldete Gerät kann als vertraut oder verdächtig markiert werden.",
    "Ein Briefkopf-Designer legt fest, was auf Rezepten, Rechnungen und Quittungen gedruckt wird.",
    "Jeder Rechner hat eine Netzwerkrolle: Hauptrechner oder gekoppeltes Gerät.",
  ],
  trust: [
    "Passwörter werden mit Argon2 gehasht. Wiederholte Fehleingaben sperren die Anmeldung.",
    "Das Audit-Protokoll ist per HMAC verkettet – eine gelöschte Zeile fällt auf.",
    "Updates sind signiert. Ein Update mit ungültiger Signatur wird abgelehnt.",
    "Offline gemachte Änderungen warten in einer absturzsicheren Warteschlange und gehen raus, sobald der Hauptrechner zurück ist. Die Kopfzeile zeigt Verbunden, Synchronisiert oder Offline.",
  ],
};

export const PRODUCT_POINTS: Record<Lang, Points> = { en, fr, ar, de };
