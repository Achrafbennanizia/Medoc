"""i18n patch: error codes + error manual, status manual, help center (en / de / fr / ar).
Run: python3 scripts/i18n-patches/2026-11-errors-status-help.py   (idempotent; overwrites listed keys only)
"""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "packages", "shared", "locales")
T = {}
def k(key, en, de, fr, ar): T[key] = {"en": en, "de": de, "fr": fr, "ar": ar}

# ---------- new error keys ----------
k("error.app.validation", "{detail}", "{detail}", "{detail}", "{detail}")
k("error.app.database", "The data could not be saved or loaded (reference {ref}). Please try again; if it persists, contact support with this reference.",
  "Die Daten konnten nicht gespeichert oder geladen werden (Referenz {ref}). Bitte erneut versuchen; bleibt der Fehler, wenden Sie sich mit dieser Referenz an den Support.",
  "Les données n'ont pas pu être enregistrées ou chargées (référence {ref}). Réessayez ; si le problème persiste, contactez le support avec cette référence.",
  "تعذّر حفظ البيانات أو تحميلها (المرجع {ref}). يرجى المحاولة مرة أخرى؛ إذا استمرت المشكلة، تواصل مع الدعم مع ذكر هذا المرجع.")
k("error.app.internal", "An unexpected internal error occurred (reference {ref}).", "Ein unerwarteter interner Fehler ist aufgetreten (Referenz {ref}).",
  "Une erreur interne inattendue s'est produite (référence {ref}).", "حدث خطأ داخلي غير متوقع (المرجع {ref}).")
k("error.app.network", "The practice server could not be reached. Check the network connection.", "Der Praxisserver ist nicht erreichbar. Bitte Netzwerkverbindung prüfen.",
  "Le serveur du cabinet est injoignable. Vérifiez la connexion réseau.", "تعذّر الوصول إلى خادم العيادة. تحقّق من اتصال الشبكة.")
k("error.app.timeout", "The server took too long to answer. Please try again.", "Der Server hat zu lange nicht geantwortet. Bitte erneut versuchen.",
  "Le serveur a mis trop de temps à répondre. Veuillez réessayer.", "استغرق الخادم وقتًا طويلًا للرد. يرجى المحاولة مرة أخرى.")
k("error.app.offline", "This device is offline. Changes cannot be sent until the connection is back.", "Dieses Gerät ist offline. Änderungen können erst nach Wiederherstellung der Verbindung gesendet werden.",
  "Cet appareil est hors ligne. Les modifications seront envoyées une fois la connexion rétablie.", "هذا الجهاز غير متصل. لا يمكن إرسال التغييرات حتى تعود الاتصال.")
k("error.app.unknown", "Something went wrong.", "Etwas ist schiefgelaufen.", "Une erreur s'est produite.", "حدث خطأ ما.")
k("error.attachment.invalid_format", "This file type is not supported.", "Dieser Dateityp wird nicht unterstützt.", "Ce type de fichier n'est pas pris en charge.", "نوع الملف هذا غير مدعوم.")
k("error.workflow.chart_readonly", "This record is archived (read-only) and cannot be changed.", "Diese Akte ist archiviert (schreibgeschützt) und kann nicht geändert werden.",
  "Ce dossier est archivé (lecture seule) et ne peut pas être modifié.", "هذا الملف مؤرشف (للقراءة فقط) ولا يمكن تعديله.")
k("error.boundary.crash", "The screen stopped working unexpectedly.", "Die Ansicht wurde unerwartet beendet.", "L'écran s'est arrêté de façon inattendue.", "توقفت الشاشة عن العمل بشكل غير متوقع.")
k("error.entity.patient_chart", "Patient record", "Patientenakte", "Dossier patient", "ملف المريض")

# ---------- error presentation ----------
k("errors.code_label", "Code {code}", "Code {code}", "Code {code}", "الرمز {code}")
k("errors.open_manual", "What does this mean?", "Was bedeutet das?", "Qu'est-ce que cela signifie ?", "ماذا يعني هذا؟")
k("errors.copy_details", "Copy details for support", "Details für Support kopieren", "Copier les détails pour le support", "نسخ التفاصيل للدعم")
k("errors.copied", "Details copied", "Details kopiert", "Détails copiés", "تم نسخ التفاصيل")
k("errors.severity.warning", "Needs your input", "Eingabe erforderlich", "Action de votre part", "يتطلب إدخالك")
k("errors.severity.error", "Action blocked", "Aktion blockiert", "Action bloquée", "تم حظر الإجراء")
k("errors.severity.critical", "System problem", "Systemproblem", "Problème système", "مشكلة في النظام")
k("errors.retryable", "Retrying can help", "Erneuter Versuch kann helfen", "Réessayer peut aider", "قد تفيد إعادة المحاولة")
for kind,(en_c,en_a),(de_c,de_a),(fr_c,fr_a),(ar_c,ar_a) in [
 ("validation",("A value you entered is missing or has the wrong format.","Correct the highlighted field and save again."),
  ("Ein eingegebener Wert fehlt oder hat ein falsches Format.","Markiertes Feld korrigieren und erneut speichern."),
  ("Une valeur saisie est manquante ou mal formatée.","Corrigez le champ indiqué puis enregistrez à nouveau."),
  ("قيمة أدخلتها مفقودة أو بتنسيق خاطئ.","صحّح الحقل المشار إليه ثم احفظ مرة أخرى.")),
 ("state",("The item is in a status that does not allow this action.","Check the item's current status (see Status guide) and use one of the allowed next steps."),
  ("Das Element hat einen Status, der diese Aktion nicht erlaubt.","Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen."),
  ("L'élément est dans un statut qui n'autorise pas cette action.","Vérifiez le statut actuel (voir le guide des statuts) et choisissez une étape autorisée."),
  ("العنصر في حالة لا تسمح بهذا الإجراء.","تحقّق من الحالة الحالية (راجع دليل الحالات) واختر خطوة مسموح بها.")),
 ("not_found",("The item no longer exists or was removed on another device.","Refresh the list (Ctrl/⌘ R) and open the item again."),
  ("Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt.","Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen."),
  ("L'élément n'existe plus ou a été supprimé sur un autre appareil.","Actualisez la liste (Ctrl/⌘ R) et rouvrez l'élément."),
  ("العنصر لم يعد موجودًا أو تمت إزالته من جهاز آخر.","حدّث القائمة (Ctrl/⌘ R) وافتح العنصر مرة أخرى.")),
 ("conflict",("The change conflicts with existing data (duplicate or competing edit).","Use a different value, or reload and apply your change again."),
  ("Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung).","Anderen Wert verwenden oder neu laden und Änderung erneut anwenden."),
  ("La modification entre en conflit avec des données existantes (doublon ou édition concurrente).","Utilisez une autre valeur, ou rechargez et appliquez à nouveau la modification."),
  ("التغيير يتعارض مع بيانات موجودة (تكرار أو تعديل متزامن).","استخدم قيمة مختلفة، أو أعد التحميل وطبّق التغيير مرة أخرى.")),
 ("permission",("Your role does not have the permission for this action.","Ask a physician or administrator to perform it or to grant the permission."),
  ("Ihre Rolle hat für diese Aktion keine Berechtigung.","Ärztin/Arzt oder Administration bitten, die Aktion auszuführen oder die Berechtigung zu erteilen."),
  ("Votre rôle n'a pas l'autorisation pour cette action.","Demandez à un médecin ou à l'administrateur de l'effectuer ou de vous accorder l'autorisation."),
  ("دورك لا يملك صلاحية هذا الإجراء.","اطلب من طبيب أو من المسؤول تنفيذه أو منحك الصلاحية.")),
 ("auth",("Sign-in or two-factor verification is required or has failed.","Sign in again; if you are locked out, wait the shown time or ask an administrator."),
  ("Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen.","Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren."),
  ("Connexion ou vérification à deux facteurs requise ou échouée.","Reconnectez-vous ; si vous êtes bloqué, attendez le délai indiqué ou contactez l'administrateur."),
  ("مطلوب تسجيل الدخول أو التحقق الثنائي أو أنه فشل.","سجّل الدخول مجددًا؛ إذا تم حظرك، انتظر المدة المعروضة أو تواصل مع المسؤول.")),
 ("connectivity",("This device cannot reach the practice host or LAN server.","Check Wi-Fi/LAN, make sure the practice host is running, then retry. Settings → Network shows the connection."),
  ("Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht.","WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung."),
  ("Cet appareil ne parvient pas à joindre l'hôte du cabinet ou le serveur LAN.","Vérifiez le Wi-Fi/LAN, assurez-vous que l'hôte fonctionne, puis réessayez. Paramètres → Réseau affiche la connexion."),
  ("هذا الجهاز لا يستطيع الوصول إلى مضيف العيادة أو خادم الشبكة المحلية.","تحقّق من الشبكة، وتأكد من تشغيل مضيف العيادة، ثم أعد المحاولة. الإعدادات ← الشبكة تعرض حالة الاتصال.")),
 ("integrity",("A file or signature failed an integrity check. Nothing was changed.","Use the original, unmodified file. Do not retry with the same file."),
  ("Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert.","Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen."),
  ("Un fichier ou une signature a échoué au contrôle d'intégrité. Rien n'a été modifié.","Utilisez le fichier original non modifié. Ne réessayez pas avec le même fichier."),
  ("فشل ملف أو توقيع في فحص السلامة. لم يتم تغيير أي شيء.","استخدم الملف الأصلي غير المعدّل. لا تعد المحاولة بنفس الملف.")),
 ("system",("An unexpected technical problem occurred on this device or the server.","Retry once. If it repeats, note the code and reference and contact support (Help → Recent errors → Copy).") ,
  ("Auf diesem Gerät oder dem Server ist ein unerwartetes technisches Problem aufgetreten.","Einmal erneut versuchen. Wiederholt es sich, Code und Referenz notieren und Support kontaktieren (Hilfe → Letzte Fehler → Kopieren)."),
  ("Un problème technique inattendu s'est produit sur cet appareil ou le serveur.","Réessayez une fois. Si cela se répète, notez le code et la référence et contactez le support (Aide → Erreurs récentes → Copier)."),
  ("حدثت مشكلة تقنية غير متوقعة على هذا الجهاز أو الخادم.","أعد المحاولة مرة واحدة. إذا تكررت، دوّن الرمز والمرجع وتواصل مع الدعم (المساعدة ← الأخطاء الأخيرة ← نسخ).")),
]:
    k(f"errors.kind.{kind}.cause", en_c, de_c, fr_c, ar_c)
    k(f"errors.kind.{kind}.action", en_a, de_a, fr_a, ar_a)
    names={"validation":("Input","Eingabe","Saisie","إدخال"),"state":("Status rule","Statusregel","Règle de statut","قاعدة الحالة"),
     "not_found":("Not found","Nicht gefunden","Introuvable","غير موجود"),"conflict":("Conflict","Konflikt","Conflit","تعارض"),
     "permission":("Permission","Berechtigung","Autorisation","صلاحية"),"auth":("Sign-in","Anmeldung","Connexion","تسجيل الدخول"),
     "connectivity":("Connection","Verbindung","Connexion réseau","الاتصال"),"integrity":("Integrity","Integrität","Intégrité","السلامة"),
     "system":("System","System","Système","النظام")}[kind]
    k(f"errors.kind.{kind}.label", *names)
for dom,names in {
 "app":("General","Allgemein","Général","عام"),"auth":("Sign-in & two-factor","Anmeldung & Zwei-Faktor","Connexion et double authentification","تسجيل الدخول والتحقق الثنائي"),
 "attachment":("Attachments","Anhänge","Pièces jointes","المرفقات"),"backup":("Backup & restore","Sicherung & Wiederherstellung","Sauvegarde et restauration","النسخ الاحتياطي والاستعادة"),
 "billing":("Billing release","Abrechnungsfreigabe","Validation de facturation","اعتماد الفوترة"),"boundary":("Screen crash","Ansichtsabsturz","Plantage d'écran","تعطل الشاشة"),
 "break_glass":("Emergency access","Notfallzugriff","Accès d'urgence","الوصول الطارئ"),"chart":("Patient record","Patientenakte","Dossier patient","ملف المريض"),
 "cluster":("Practice network (cluster)","Praxisverbund (Cluster)","Réseau du cabinet (cluster)","شبكة العيادة (العنقود)"),"device_session":("Device sessions","Gerätesitzungen","Sessions d'appareils","جلسات الأجهزة"),
 "export":("Export","Export","Export","التصدير"),"lan":("LAN connection","LAN-Verbindung","Connexion LAN","اتصال الشبكة المحلية"),
 "master":("Master data","Stammdaten","Données de base","البيانات الأساسية"),"pairing":("Device pairing","Gerätekopplung","Appairage d'appareils","إقران الأجهزة"),
 "payment":("Payments","Zahlungen","Paiements","المدفوعات"),"practice_task":("Practice tasks","Praxisaufgaben","Tâches du cabinet","مهام العيادة"),
 "profile":("Profile","Profil","Profil","الملف الشخصي"),"staff":("Staff","Personal","Personnel","الموظفون"),
 "work_time":("Work time","Arbeitszeit","Temps de travail","وقت العمل"),"workflow":("Status workflow","Status-Workflow","Flux de statuts","مسار الحالات"),
}.items(): k(f"errors.domain.{dom}", *names)

# ---------- status manual ----------
S = {
 "appointment": (("Appointment","Termin","Rendez-vous","موعد"), {
   "planned": (("Planned","Geplant","Planifié","مخطط"),("Booked, not yet confirmed by the patient or practice.","Gebucht, noch nicht von Patient oder Praxis bestätigt.","Réservé, pas encore confirmé par le patient ou le cabinet.","محجوز، لم يؤكده المريض أو العيادة بعد.")),
   "confirmed": (("Confirmed","Bestätigt","Confirmé","مؤكد"),("Confirmed; the patient is expected at the booked time.","Bestätigt; der Patient wird zur gebuchten Zeit erwartet.","Confirmé ; le patient est attendu à l'heure prévue.","مؤكد؛ المريض متوقع في الوقت المحجوز.")),
   "completed": (("Completed","Abgeschlossen","Terminé","مكتمل"),("The visit took place. Ready for documentation and billing.","Der Besuch hat stattgefunden. Bereit für Dokumentation und Abrechnung.","La visite a eu lieu. Prête pour la documentation et la facturation.","تمت الزيارة. جاهزة للتوثيق والفوترة.")),
   "no_show": (("No-show","Nicht erschienen","Absent","لم يحضر"),("The patient did not attend and did not cancel. Final.","Der Patient ist ohne Absage nicht erschienen. Endgültig.","Le patient ne s'est pas présenté sans annuler. Définitif.","لم يحضر المريض ولم يلغِ. نهائي.")),
   "cancelled": (("Cancelled","Storniert","Annulé","ملغى"),("Cancelled by the patient or practice. The slot is free again. Final.","Von Patient oder Praxis storniert. Der Termin ist wieder frei. Endgültig.","Annulé par le patient ou le cabinet. Le créneau est libéré. Définitif.","ألغاه المريض أو العيادة. أصبح الموعد متاحًا. نهائي.")),
 }, {"rescheduled":("Rescheduled","Verschoben","Reporté","أعيدت جدولته"),"emergency":("Emergency","Notfall","Urgence","طارئ")}),
 "patient": (("Patient","Patient","Patient","مريض"), {
   "new": (("New","Neu","Nouveau","جديد"),("First-time visitor; master data not yet complete.","Erstbesuch; Stammdaten noch nicht vollständig.","Première visite ; données de base incomplètes.","زيارة أولى؛ البيانات الأساسية غير مكتملة.")),
   "active": (("Active","Aktiv","Actif","نشط"),("Patient in ongoing care.","Patient in laufender Behandlung.","Patient en cours de suivi.","مريض قيد الرعاية.")),
   "validated": (("Validated","Validiert","Validé","معتمد"),("Master data and record checked by a physician.","Stammdaten und Akte von ärztlicher Seite geprüft.","Données et dossier vérifiés par un médecin.","تم التحقق من البيانات والملف من قبل طبيب.")),
   "readonly": (("Archived","Archiviert","Archivé","مؤرشف"),("Archived: kept for retention, read-only. Final.","Archiviert: zur Aufbewahrung, schreibgeschützt. Endgültig.","Archivé : conservé, lecture seule. Définitif.","مؤرشف: محفوظ للقراءة فقط. نهائي.")),
 }, {}),
 "patient_chart": (("Patient record","Patientenakte","Dossier patient","ملف المريض"), {
   "draft": (("Draft","Entwurf","Brouillon","مسودة"),("Being documented; not yet sent for review.","In Dokumentation; noch nicht zur Prüfung gesendet.","En cours de documentation ; pas encore envoyé pour revue.","قيد التوثيق؛ لم يُرسل للمراجعة بعد.")),
   "in_progress": (("In review","In Prüfung","En revue","قيد المراجعة"),("Sent to a physician and waiting in the validation queue.","An Ärztin/Arzt gesendet, wartet in der Validierungsliste.","Envoyé à un médecin, en attente de validation.","أُرسل إلى طبيب وينتظر في قائمة الاعتماد.")),
   "declined": (("Declined","Abgelehnt","Refusé","مرفوض"),("Returned by the physician; needs correction before resubmitting.","Von ärztlicher Seite zurückgewiesen; vor erneutem Senden korrigieren.","Renvoyé par le médecin ; à corriger avant nouvel envoi.","أعاده الطبيب؛ يحتاج تصحيحًا قبل الإرسال مجددًا.")),
   "validated": (("Validated","Validiert","Validé","معتمد"),("Approved by a physician. Billing can be released.","Ärztlich freigegeben. Abrechnung kann freigegeben werden.","Approuvé par un médecin. La facturation peut être validée.","اعتمده الطبيب. يمكن اعتماد الفوترة.")),
   "readonly": (("Archived","Archiviert","Archivé","مؤرشف"),("Locked for retention; no further changes. Final.","Zur Aufbewahrung gesperrt; keine Änderungen mehr. Endgültig.","Verrouillé pour conservation ; plus de modifications. Définitif.","مقفل للحفظ؛ لا تغييرات بعد الآن. نهائي.")),
 }, {}),
 "payment": (("Payment","Zahlung","Paiement","دفعة"), {
   "outstanding": (("Outstanding","Offen","En attente","مستحق"),("Nothing paid yet.","Noch nichts bezahlt.","Rien n'a encore été payé.","لم يُدفع شيء بعد.")),
   "partially_paid": (("Partially paid","Teilweise bezahlt","Partiellement payé","مدفوع جزئيًا"),("Part of the amount is paid; the rest is still open.","Ein Teil ist bezahlt; der Rest ist offen.","Une partie est payée ; le reste est dû.","دُفع جزء من المبلغ؛ والباقي مستحق.")),
   "paid": (("Paid","Bezahlt","Payé","مدفوع"),("Fully paid. Final.","Vollständig bezahlt. Endgültig.","Entièrement payé. Définitif.","مدفوع بالكامل. نهائي.")),
   "cancelled": (("Cancelled","Storniert","Annulé","ملغى"),("Voided; does not count toward revenue. Final.","Storniert; zählt nicht zum Umsatz. Endgültig.","Annulé ; non compté dans le chiffre d'affaires. Définitif.","ملغاة؛ لا تُحتسب ضمن الإيرادات. نهائي.")),
 }, {}),
 "purchase_order": (("Purchase order","Bestellung","Commande","طلب شراء"), {
   "open": (("Open","Offen","Ouverte","مفتوح"),("Created, not yet shipped by the supplier.","Angelegt, vom Lieferanten noch nicht versandt.","Créée, pas encore expédiée par le fournisseur.","تم إنشاؤه، لم يشحنه المورد بعد.")),
   "in_transit": (("In transit","Unterwegs","En transit","قيد الشحن"),("Shipped and on its way.","Versandt und unterwegs.","Expédiée et en route.","تم الشحن وفي الطريق.")),
   "delivered": (("Delivered","Geliefert","Livrée","تم التسليم"),("Received and booked into stock. Final.","Erhalten und eingelagert. Endgültig.","Reçue et mise en stock. Définitif.","تم الاستلام والإدخال إلى المخزون. نهائي.")),
   "cancelled": (("Cancelled","Storniert","Annulée","ملغى"),("Order withdrawn. Final.","Bestellung zurückgezogen. Endgültig.","Commande retirée. Définitif.","تم سحب الطلب. نهائي.")),
 }, {"overdue":("Overdue","Überfällig","En retard","متأخر")}),
 "practice_task": (("Practice task","Praxisaufgabe","Tâche du cabinet","مهمة العيادة"), {
   "back": (("Returned","Zurückgegeben","Renvoyée","مُعادة"),("Returned by the creator with a reason; needs rework first.","Vom Ersteller mit Begründung zurückgegeben; zuerst nacharbeiten.","Renvoyée par le créateur avec un motif ; à retravailler en priorité.","أعادها المنشئ مع سبب؛ تحتاج إعادة عمل أولًا.")),
   "open": (("Open","Offen","Ouverte","مفتوحة"),("Waiting for the assignee to start.","Wartet auf Beginn durch die zuständige Person.","En attente de prise en charge.","بانتظار أن يبدأ المكلّف.")),
   "in_progress": (("In progress","In Bearbeitung","En cours","قيد التنفيذ"),("The assignee is working on it.","Die zuständige Person bearbeitet sie.","La personne assignée y travaille.","يعمل عليها المكلّف.")),
   "done_reception": (("Done — awaiting review","Erledigt — wartet auf Prüfung","Terminée — en attente de revue","منجزة — بانتظار المراجعة"),("Completed by the assignee; the creator must validate or return it.","Von der zuständigen Person erledigt; Ersteller validiert oder gibt zurück.","Terminée par l'assigné ; le créateur doit valider ou renvoyer.","أنجزها المكلّف؛ على المنشئ اعتمادها أو إعادتها.")),
   "validated": (("Validated","Validiert","Validée","معتمدة"),("Checked and closed by the creator. Final.","Vom Ersteller geprüft und abgeschlossen. Endgültig.","Vérifiée et clôturée par le créateur. Définitif.","راجعها المنشئ وأغلقها. نهائي.")),
 }, {}),
 "practice_ticket": (("Ticket","Ticket","Ticket","تذكرة"), {
   "open": (("Open","Offen","Ouvert","مفتوحة"),("New message for a physician.","Neue Nachricht an Ärztin/Arzt.","Nouveau message pour un médecin.","رسالة جديدة لطبيب.")),
   "in_progress": (("In progress","In Bearbeitung","En cours","قيد التنفيذ"),("Being handled.","Wird bearbeitet.","En cours de traitement.","قيد المعالجة.")),
   "done": (("Done","Erledigt","Terminé","منجزة"),("Resolved. Final.","Erledigt. Endgültig.","Résolu. Définitif.","تم الحل. نهائي.")),
 }, {}),
 "feedback": (("Feedback report","Rückmeldung","Retour","ملاحظة"), {
   "open": (("Open","Offen","Ouvert","مفتوحة"),("Submitted, not yet reviewed.","Eingereicht, noch nicht gesichtet.","Soumis, pas encore examiné.","مُرسلة، لم تُراجع بعد.")),
   "in_progress": (("In progress","In Bearbeitung","En cours","قيد التنفيذ"),("Under review.","In Prüfung.","En cours d'examen.","قيد المراجعة.")),
   "done": (("Done","Erledigt","Traité","منجزة"),("Handled. Final.","Bearbeitet. Endgültig.","Traité. Définitif.","تمت المعالجة. نهائي.")),
 }, {}),
 "prescription": (("Prescription","Rezept","Ordonnance","وصفة"), {
   "draft": (("Draft","Entwurf","Brouillon","مسودة"),("Editable; not yet given to the patient.","Bearbeitbar; noch nicht ausgehändigt.","Modifiable ; pas encore remise au patient.","قابلة للتعديل؛ لم تُسلّم للمريض بعد.")),
   "issued": (("Issued","Ausgestellt","Délivrée","صادرة"),("Signed and handed out or sent. Final.","Unterschrieben und ausgehändigt bzw. gesendet. Endgültig.","Signée et remise ou envoyée. Définitif.","موقعة وسُلّمت أو أُرسلت. نهائي.")),
 }, {}),
 "device_trust": (("Device session trust","Vertrauensstatus Gerätesitzung","Confiance de session d'appareil","ثقة جلسة الجهاز"), {
   "suspected": (("Suspicious","Verdächtig","Suspecte","مشبوهة"),("Flagged as suspicious; review and end it if unknown.","Als verdächtig markiert; prüfen und bei Unbekanntheit beenden.","Signalée suspecte ; vérifiez et terminez-la si inconnue.","وُسمت بأنها مشبوهة؛ راجعها وأنهها إن كانت مجهولة.")),
   "unchecked": (("Unchecked","Ungeprüft","Non vérifiée","غير متحقق منها"),("New sign-in from this device; not yet reviewed.","Neue Anmeldung von diesem Gerät; noch nicht geprüft.","Nouvelle connexion depuis cet appareil ; non vérifiée.","تسجيل دخول جديد من هذا الجهاز؛ لم يُراجع بعد.")),
   "trusted": (("Trusted","Vertrauenswürdig","Approuvée","موثوقة"),("Marked as a known practice device.","Als bekanntes Praxisgerät markiert.","Marquée comme appareil connu du cabinet.","وُسمت كجهاز معروف للعيادة.")),
 }, {}),
 "pairing": (("Device pairing","Gerätekopplung","Appairage","إقران الجهاز"), {
   "pending": (("Pending","Ausstehend","En attente","معلق"),("Request received; waiting for approval on the host.","Anfrage eingegangen; wartet auf Freigabe am Host.","Demande reçue ; en attente d'approbation sur l'hôte.","تم استلام الطلب؛ بانتظار الموافقة على المضيف.")),
   "accepted": (("Accepted","Angenommen","Acceptée","مقبول"),("Device is paired and may sync.","Gerät ist gekoppelt und darf synchronisieren.","L'appareil est appairé et peut synchroniser.","الجهاز مقترن ويمكنه المزامنة.")),
   "rejected": (("Rejected","Abgelehnt","Refusée","مرفوض"),("Request denied. Final.","Anfrage abgelehnt. Endgültig.","Demande refusée. Définitif.","تم رفض الطلب. نهائي.")),
   "revoked": (("Revoked","Widerrufen","Révoquée","ملغى"),("Previously accepted device was removed. Final.","Zuvor gekoppeltes Gerät wurde entfernt. Endgültig.","Appareil auparavant accepté retiré. Définitif.","أزيل الجهاز المقبول سابقًا. نهائي.")),
 }, {"awaiting_code":("Confirm code","Code bestätigen","Confirmer le code","تأكيد الرمز")}),
 "work_session": (("Work-time session","Arbeitszeitsitzung","Session de temps de travail","جلسة وقت العمل"), {
   "running": (("Running","Läuft","En cours","جارية"),("Time is being recorded.","Zeit wird erfasst.","Le temps est enregistré.","يتم تسجيل الوقت.")),
   "paused": (("Paused","Pausiert","En pause","متوقفة مؤقتًا"),("Break; time is not counted until resumed.","Pause; Zeit zählt erst nach Fortsetzen.","Pause ; le temps n'est pas compté jusqu'à la reprise.","استراحة؛ لا يُحتسب الوقت حتى الاستئناف.")),
   "ended": (("Ended","Beendet","Terminée","منتهية"),("Session closed. Final.","Sitzung beendet. Endgültig.","Session clôturée. Définitif.","أُغلقت الجلسة. نهائي.")),
 }, {}),
}
LOCS=["en","de","fr","ar"]
for ent,(names,states,flags) in S.items():
    k(f"status.entity.{ent}", *names)
    for st,(lab,desc) in states.items():
        k(f"status.{ent}.{st}.label", *lab); k(f"status.{ent}.{st}.description", *desc)
    for fl,lab in flags.items(): k(f"status.{ent}.flag.{fl}", *lab)
for ph,n in {"attention":("Needs attention","Handlungsbedarf","À traiter en priorité","يحتاج انتباهًا"),"todo":("To do","Zu erledigen","À faire","للتنفيذ"),
  "active":("In progress","In Arbeit","En cours","قيد التنفيذ"),"review":("Awaiting review","Wartet auf Prüfung","En attente de revue","بانتظار المراجعة"),
  "done":("Done","Erledigt","Terminé","منجز"),"closed":("Closed","Geschlossen","Clôturé","مغلق")}.items(): k(f"status.phase.{ph}", *n)

# ---------- corrected legacy labels (status meaning was wrong) ----------
k("enum.patient_status.readonly","Archived","Archiviert","Archivé","مؤرشف")
k("enum.charts_status.declined","Declined","Abgelehnt","Refusé","مرفوض")
k("practice.tasks.status.done_reception","Done — awaiting review","Erledigt — wartet auf Prüfung","Terminée — en attente de revue","منجزة — بانتظار المراجعة")
k("practice.tasks.status.back","Returned","Zurückgegeben","Renvoyée","مُعادة")
k("appointment.calendar.status.in_treatment","Confirmed","Bestätigt","Confirmé","مؤكد")

k("appointment.keyboard.hint","D day · W week · M month · T today · N new · ←/→ previous/next","D Tag · W Woche · M Monat · T heute · N neu · ←/→ zurück/weiter","D jour · W semaine · M mois · T aujourd'hui · N nouveau · ←/→ précédent/suivant","D يوم · W أسبوع · M شهر · T اليوم · N جديد · ←/→ السابق/التالي")

k("appointment.create.toast_confirm_failed","Appointment saved, but it could not be confirmed automatically — it is still Planned.","Termin gespeichert, konnte aber nicht automatisch bestätigt werden — er ist weiterhin Geplant.","Rendez-vous enregistré, mais il n'a pas pu être confirmé automatiquement — il reste Planifié.","تم حفظ الموعد، لكن تعذّر تأكيده تلقائيًا — لا يزال مخططًا.")

k("settings.security.idle_warning","No activity — you will be signed out in {seconds} s. Move the mouse or press a key to stay signed in.","Keine Aktivität — Abmeldung in {seconds} s. Maus bewegen oder Taste drücken, um angemeldet zu bleiben.","Aucune activité — déconnexion dans {seconds} s. Bougez la souris ou appuyez sur une touche pour rester connecté.","لا يوجد نشاط — سيتم تسجيل خروجك خلال {seconds} ثانية. حرّك الفأرة أو اضغط مفتاحًا للبقاء متصلًا.")
k("settings.security.idle_signed_out","You were signed out after inactivity to protect patient data.","Sie wurden zum Schutz der Patientendaten nach Inaktivität abgemeldet.","Vous avez été déconnecté après inactivité pour protéger les données des patients.","تم تسجيل خروجك بعد عدم النشاط لحماية بيانات المرضى.")
k("settings.security.idle_minutes_aria","Inactivity time before sign-out","Inaktivitätsdauer bis zur Abmeldung","Durée d'inactivité avant déconnexion","مدة عدم النشاط قبل تسجيل الخروج")
k("settings.security.idle_minutes_option","{minutes} min","{minutes} Min.","{minutes} min","{minutes} دقيقة")

# ---------- notifications ----------
k("app.notifications.appointment_soon","{name} in {minutes} min","{name} in {minutes} Min.","{name} dans {minutes} min","{name} خلال {minutes} دقيقة")
k("app.notifications.device_suspected","Suspicious sign-in on your account","Verdächtige Anmeldung in Ihrem Konto","Connexion suspecte sur votre compte","تسجيل دخول مشبوه إلى حسابك")
k("app.notifications.low_stock","Low stock: {name}","Niedriger Bestand: {name}","Stock bas : {name}","مخزون منخفض: {name}")
k("app.notifications.low_stock_detail","{stock} left (minimum {min})","Noch {stock} (Minimum {min})","{stock} restant(s) (minimum {min})","المتبقي {stock} (الحد الأدنى {min})")
k("app.notifications.filter_aria","Filter notifications","Benachrichtigungen filtern","Filtrer les notifications","تصفية الإشعارات")
k("app.notifications.partial","Some sources could not be loaded; the list may be incomplete.","Einige Quellen konnten nicht geladen werden; die Liste ist evtl. unvollständig.","Certaines sources n'ont pas pu être chargées ; la liste peut être incomplète.","تعذّر تحميل بعض المصادر؛ قد تكون القائمة غير مكتملة.")
k("app.notifications.settings","Notification settings","Benachrichtigungseinstellungen","Paramètres des notifications","إعدادات الإشعارات")
k("app.notifications.bell_aria_unread","Notifications, {count} unread","Benachrichtigungen, {count} ungelesen","Notifications, {count} non lues","الإشعارات، {count} غير مقروءة")
for c,n in {"all":("All","Alle","Toutes","الكل"),"task":("Tasks","Aufgaben","Tâches","المهام"),"appointment":("Appointments","Termine","Rendez-vous","المواعيد"),
  "clinical":("Clinical","Klinisch","Clinique","سريري"),"inventory":("Stock","Lager","Stock","المخزون"),"security":("Security","Sicherheit","Sécurité","الأمان"),
  "system":("System","System","Système","النظام")}.items(): k(f"app.notifications.category.{c}",*n)
k("settings.notifications.channel_unavailable","Not available: this delivery channel is not activated for your practice.","Nicht verfügbar: Dieser Zustellkanal ist für Ihre Praxis nicht aktiviert.","Indisponible : ce canal d'envoi n'est pas activé pour votre cabinet.","غير متاح: قناة الإرسال هذه غير مفعّلة لعيادتك.")
k("settings.notifications.os_unsupported","System notifications are not supported on this device; alerts appear inside the app.","Systembenachrichtigungen werden auf diesem Gerät nicht unterstützt; Hinweise erscheinen in der App.","Les notifications système ne sont pas prises en charge sur cet appareil ; les alertes s'affichent dans l'application.","إشعارات النظام غير مدعومة على هذا الجهاز؛ تظهر التنبيهات داخل التطبيق.")
k("settings.notifications.push_detail","New tasks, returned tasks, appointments starting soon, low stock. Shown as system notification when MeDoc is in the background.","Neue und zurückgegebene Aufgaben, bald beginnende Termine, niedriger Bestand. Als Systembenachrichtigung, wenn MeDoc im Hintergrund ist.","Nouvelles tâches, tâches renvoyées, rendez-vous imminents, stock bas. Notification système quand MeDoc est en arrière-plan.","مهام جديدة ومعادة، مواعيد قريبة، مخزون منخفض. تظهر كإشعار نظام عندما يكون MeDoc في الخلفية.")
k("settings.notifications.critical_detail","Out of stock, suspicious sign-ins — always shown as an alert, even while you work.","Kein Bestand, verdächtige Anmeldungen — immer als Hinweis, auch während der Arbeit.","Rupture de stock, connexions suspectes — toujours affichés comme alerte.","نفاد المخزون، تسجيلات دخول مشبوهة — تظهر دائمًا كتنبيه أثناء العمل.")

# ---------- help center ----------
H = {
 "help.tab.start":("Getting started","Erste Schritte","Premiers pas","البدء"),
 "help.tab.shortcuts":("Keyboard shortcuts","Tastenkürzel","Raccourcis clavier","اختصارات لوحة المفاتيح"),
 "help.tab.statuses":("Status guide","Statusleitfaden","Guide des statuts","دليل الحالات"),
 "help.tab.errors":("Error codes","Fehlercodes","Codes d'erreur","رموز الأخطاء"),
 "help.tab.recent":("Recent errors","Letzte Fehler","Erreurs récentes","الأخطاء الأخيرة"),
 "help.tab.about":("About & support","Über & Support","À propos et support","حول ودعم"),
 "help.search_placeholder":("Search help, shortcuts, codes…","Hilfe, Kürzel, Codes durchsuchen…","Rechercher aide, raccourcis, codes…","ابحث في المساعدة والاختصارات والرموز…"),
 "help.search_aria":("Search the help center","Hilfecenter durchsuchen","Rechercher dans le centre d'aide","ابحث في مركز المساعدة"),
 "help.no_results":("No matches for “{q}”.","Keine Treffer für „{q}“.","Aucun résultat pour « {q} ».","لا نتائج لـ «{q}»."),
 "help.result_count":("{count} entries","{count} Einträge","{count} entrées","{count} عنصر"),
 "help.print":("Print","Drucken","Imprimer","طباعة"),
 "help.shortcuts.group.global":("Everywhere","Überall","Partout","في كل مكان"),
 "help.shortcuts.group.navigation":("Navigation","Navigation","Navigation","التنقل"),
 "help.shortcuts.group.view":("View","Ansicht","Affichage","العرض"),
 "help.shortcuts.group.calendar":("Schedule","Terminplan","Agenda","جدول المواعيد"),
 "help.shortcuts.group.dialogs":("Dialogs & lists","Dialoge & Listen","Dialogues et listes","مربعات الحوار والقوائم"),
 "help.shortcuts.cmdk":("Open the command palette (search patients, pages, actions)","Befehlspalette öffnen (Patienten, Seiten, Aktionen suchen)","Ouvrir la palette de commandes (patients, pages, actions)","فتح لوحة الأوامر (بحث عن مرضى وصفحات وإجراءات)"),
 "help.shortcuts.new_appointment":("New appointment","Neuer Termin","Nouveau rendez-vous","موعد جديد"),
 "help.shortcuts.help":("Open this help center","Dieses Hilfecenter öffnen","Ouvrir ce centre d'aide","فتح مركز المساعدة هذا"),
 "help.shortcuts.reload":("Reload data","Daten neu laden","Recharger les données","إعادة تحميل البيانات"),
 "help.shortcuts.nav_n":("Go to sidebar entry 1–9","Zu Seitenleisten-Eintrag 1–9","Aller à l'entrée 1–9 de la barre latérale","الانتقال إلى عنصر الشريط الجانبي 1–9"),
 "help.shortcuts.zoom_in":("Zoom in","Vergrößern","Zoom avant","تكبير"),
 "help.shortcuts.zoom_out":("Zoom out","Verkleinern","Zoom arrière","تصغير"),
 "help.shortcuts.zoom_reset":("Reset zoom","Zoom zurücksetzen","Réinitialiser le zoom","إعادة ضبط التكبير"),
 "help.shortcuts.cal_day":("Day view","Tagesansicht","Vue jour","عرض اليوم"),
 "help.shortcuts.cal_week":("Week view","Wochenansicht","Vue semaine","عرض الأسبوع"),
 "help.shortcuts.cal_month":("Month view","Monatsansicht","Vue mois","عرض الشهر"),
 "help.shortcuts.cal_today":("Jump to today","Zu heute springen","Aller à aujourd'hui","الانتقال إلى اليوم"),
 "help.shortcuts.cal_prev_next":("Previous / next period","Vorheriger / nächster Zeitraum","Période précédente / suivante","الفترة السابقة / التالية"),
 "help.shortcuts.esc":("Close dialog, drawer or palette","Dialog, Seitenleiste oder Palette schließen","Fermer dialogue, panneau ou palette","إغلاق مربع الحوار أو اللوحة"),
 "help.shortcuts.tab":("Move focus forward / back","Fokus vor / zurück","Déplacer le focus avant / arrière","نقل التركيز للأمام / للخلف"),
 "help.shortcuts.arrows":("Move through list or palette results","In Listen- oder Palettenergebnissen bewegen","Parcourir les résultats","التنقل بين النتائج"),
 "help.shortcuts.enter":("Open / confirm the selected entry","Ausgewählten Eintrag öffnen / bestätigen","Ouvrir / confirmer l'entrée sélectionnée","فتح / تأكيد العنصر المحدد"),
 "help.shortcuts.typing_note":("Shortcuts are ignored while you type in a field.","Kürzel sind beim Tippen in einem Feld deaktiviert.","Les raccourcis sont ignorés pendant la saisie dans un champ.","يتم تجاهل الاختصارات أثناء الكتابة في حقل."),
 "help.statuses.intro":("Every item has exactly one status. Flags (e.g. “Rescheduled”) are extra hints shown next to it and never replace the status. Lists are always ordered: needs attention → to do → in progress → awaiting review → done → closed.",
   "Jedes Element hat genau einen Status. Markierungen (z. B. „Verschoben“) sind Zusatzhinweise daneben und ersetzen nie den Status. Listen sind immer so sortiert: Handlungsbedarf → zu erledigen → in Arbeit → wartet auf Prüfung → erledigt → geschlossen.",
   "Chaque élément a exactement un statut. Les indicateurs (p. ex. « Reporté ») sont des indications affichées à côté et ne remplacent jamais le statut. Les listes sont toujours triées : à traiter en priorité → à faire → en cours → en attente de revue → terminé → clôturé.",
   "لكل عنصر حالة واحدة فقط. المؤشرات (مثل «أعيدت جدولته») تلميحات إضافية تظهر بجانبها ولا تحل محلها. تُرتّب القوائم دائمًا: يحتاج انتباهًا ← للتنفيذ ← قيد التنفيذ ← بانتظار المراجعة ← منجز ← مغلق."),
 "help.statuses.col_status":("Status","Status","Statut","الحالة"),
 "help.statuses.col_meaning":("Meaning","Bedeutung","Signification","المعنى"),
 "help.statuses.col_phase":("Phase","Phase","Phase","المرحلة"),
 "help.statuses.col_next":("Can change to","Kann wechseln zu","Peut passer à","يمكن أن تتحول إلى"),
 "help.statuses.final":("Final — no further change","Endgültig — keine weitere Änderung","Définitif — plus de changement","نهائي — لا تغيير بعد ذلك"),
 "help.statuses.flags":("Flags (not statuses)","Markierungen (kein Status)","Indicateurs (pas des statuts)","مؤشرات (ليست حالات)"),
 "help.statuses.initial":("Starts as","Beginnt als","Commence par","تبدأ بـ"),
 "help.errors.intro":("Every error message shows a code such as MD-PAY-004. Search it here to see what happened and what to do. Codes never change between versions.",
   "Jede Fehlermeldung zeigt einen Code wie MD-PAY-004. Suchen Sie ihn hier, um Ursache und Lösung zu sehen. Codes bleiben über Versionen gleich.",
   "Chaque message d'erreur affiche un code comme MD-PAY-004. Recherchez-le ici pour connaître la cause et la solution. Les codes ne changent jamais d'une version à l'autre.",
   "تعرض كل رسالة خطأ رمزًا مثل MD-PAY-004. ابحث عنه هنا لمعرفة ما حدث وما يجب فعله. لا تتغير الرموز بين الإصدارات."),
 "help.errors.col_code":("Code","Code","Code","الرمز"),
 "help.errors.col_message":("Message","Meldung","Message","الرسالة"),
 "help.errors.cause":("Why it happens","Warum es auftritt","Pourquoi","السبب"),
 "help.errors.action":("What to do","Was tun","Que faire","ما العمل"),
 "help.errors.filter_all":("All areas","Alle Bereiche","Tous les domaines","كل المجالات"),
 "help.errors.filter_aria":("Filter error codes by area","Fehlercodes nach Bereich filtern","Filtrer les codes par domaine","تصفية الرموز حسب المجال"),
 "help.recent.intro":("Errors shown in this window since it was opened. Copy them when contacting support — no patient data is included.",
   "In diesem Fenster seit dem Öffnen angezeigte Fehler. Beim Support-Kontakt kopieren — es sind keine Patientendaten enthalten.",
   "Erreurs affichées dans cette fenêtre depuis son ouverture. Copiez-les pour le support — aucune donnée patient n'est incluse.",
   "الأخطاء التي ظهرت في هذه النافذة منذ فتحها. انسخها عند التواصل مع الدعم — لا تتضمن بيانات المرضى."),
 "help.recent.empty":("No errors so far. 🎉","Bisher keine Fehler. 🎉","Aucune erreur pour l'instant. 🎉","لا أخطاء حتى الآن. 🎉"),
 "help.recent.copy_all":("Copy all for support","Alles für Support kopieren","Tout copier pour le support","نسخ الكل للدعم"),
 "help.recent.clear":("Clear list","Liste leeren","Vider la liste","مسح القائمة"),
 "help.recent.col_time":("Time","Zeit","Heure","الوقت"),
 "help.recent.col_page":("Page","Seite","Page","الصفحة"),
 "help.start.intro":("The essentials for a smooth day in the practice.","Das Wichtigste für einen reibungslosen Praxistag.","L'essentiel pour une journée fluide au cabinet.","الأساسيات ليوم سلس في العيادة."),
 "help.start.step1.title":("Find anything with ⌘K / Ctrl+K","Alles finden mit ⌘K / Strg+K","Tout trouver avec ⌘K / Ctrl+K","اعثر على أي شيء بـ ⌘K / Ctrl+K"),
 "help.start.step1.body":("Type a patient name, page or action and press Enter.","Patientenname, Seite oder Aktion eintippen und Enter drücken.","Tapez un nom de patient, une page ou une action puis Entrée.","اكتب اسم مريض أو صفحة أو إجراء ثم اضغط Enter."),
 "help.start.step2.title":("Plan the day in the schedule","Den Tag im Terminplan planen","Planifier la journée dans l'agenda","خطط اليوم في جدول المواعيد"),
 "help.start.step2.body":("Create appointments with ⌘N / Ctrl+N; drag to reschedule when enabled in Settings → Workflows.","Termine mit ⌘N / Strg+N anlegen; per Ziehen verschieben, wenn in Einstellungen → Abläufe aktiviert.","Créez des rendez-vous avec ⌘N / Ctrl+N ; glissez pour reporter si activé dans Paramètres → Flux.","أنشئ مواعيد بـ ⌘N / Ctrl+N؛ اسحب لإعادة الجدولة إذا كان مفعّلًا في الإعدادات ← سير العمل."),
 "help.start.step3.title":("Hand over work with tasks","Arbeit per Aufgaben übergeben","Déléguer avec les tâches","سلّم العمل عبر المهام"),
 "help.start.step3.body":("Tasks move Open → In progress → Done — awaiting review → Validated. Returned tasks always appear first.","Aufgaben laufen Offen → In Bearbeitung → Erledigt — wartet auf Prüfung → Validiert. Zurückgegebene Aufgaben stehen immer oben.","Les tâches passent Ouverte → En cours → Terminée — en attente de revue → Validée. Les tâches renvoyées apparaissent toujours en premier.","تنتقل المهام: مفتوحة ← قيد التنفيذ ← منجزة بانتظار المراجعة ← معتمدة. المهام المعادة تظهر دائمًا أولًا."),
 "help.start.step4.title":("Close the day","Tag abschließen","Clôturer la journée","أغلق اليوم"),
 "help.start.step4.body":("Finance → Day close reconciles cash. A reminder appears at the time set in Settings.","Finanzen → Tagesabschluss gleicht die Kasse ab. Zur in den Einstellungen gewählten Zeit erscheint eine Erinnerung.","Finances → Clôture rapproche la caisse. Un rappel apparaît à l'heure définie dans les Paramètres.","المالية ← إغلاق اليوم يطابق النقد. يظهر تذكير في الوقت المحدد في الإعدادات."),
 "help.start.step5.title":("When something goes wrong","Wenn etwas schiefgeht","En cas de problème","عند حدوث خطأ"),
 "help.start.step5.body":("Every error has a code. Click “What does this mean?” in the message or look it up under Error codes.","Jeder Fehler hat einen Code. In der Meldung auf „Was bedeutet das?“ klicken oder unter Fehlercodes nachschlagen.","Chaque erreur a un code. Cliquez sur « Qu'est-ce que cela signifie ? » ou consultez Codes d'erreur.","لكل خطأ رمز. انقر «ماذا يعني هذا؟» في الرسالة أو ابحث عنه في رموز الأخطاء."),
 "help.about.version":("Version","Version","Version","الإصدار"),
 "help.about.time_source":("Clock","Uhrzeit","Horloge","الساعة"),
 "help.about.time_synced":("Synchronised with practice host (offset {offset})","Mit Praxis-Host synchronisiert (Abweichung {offset})","Synchronisée avec l'hôte du cabinet (décalage {offset})","متزامنة مع مضيف العيادة (الفرق {offset})"),
 "help.about.time_local":("This device's clock","Uhr dieses Geräts","Horloge de cet appareil","ساعة هذا الجهاز"),
 "help.about.timezone":("Time zone","Zeitzone","Fuseau horaire","المنطقة الزمنية"),
}
for key,v in H.items(): k(key,*v)

def main():
    for loc in LOCS:
        p=os.path.join(ROOT,f"{loc}.json")
        d=json.load(open(p,encoding="utf-8"))
        for key,vals in T.items(): d[key]=vals[loc]
        with open(p,"w",encoding="utf-8") as f:
            json.dump(d,f,ensure_ascii=False,indent=2); f.write("\n")
    print(f"applied {len(T)} keys to {len(LOCS)} locales")
if __name__=="__main__": main()
