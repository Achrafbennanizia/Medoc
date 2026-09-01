#!/usr/bin/env python3
"""Rewrite German TypeScript identifiers to English. Skips strings and comments
so IPC command names, routes, i18n keys, and SQL stay unchanged.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")
SKIP_DIRS = {".git", "node_modules", "target", "dist", "coverage", "releases", ".englishify"}
SKIP_FILES = {
    "package-lock.json",
    "Cargo.lock",
}

# Longest-first identifier pairs. Enum wire tokens are translated too.
PAIRS: list[tuple[str, str]] = [
    ("ChartsZuValidierenPage", "ChartsToValidatePage"),
    ("countChartsZuValidieren", "countChartsToValidate"),
    ("setChartsZuValidierenCount", "setChartsToValidateCount"),
    ("chartsZuValidierenCount", "chartsToValidateCount"),
    ("ChartsZuValidieren", "ChartsToValidate"),
    ("chartsZuValidieren", "chartsToValidate"),
    ("ZuValidieren", "ToValidate"),
    ("zuValidieren", "toValidate"),
    ("behandler_berufsbezeichnung", "clinician_professional_title"),
    ("BehandlerBerufsbezeichnung", "ClinicianProfessionalTitle"),
    ("berufsbezeichnung", "professional_title"),
    ("Berufsbezeichnung", "ProfessionalTitle"),
    ("passwort_aendern_erforderlich", "password_change_required"),
    ("behandlungsbestaetigung", "treatment_confirmation"),
    ("kontrolluntersuchung", "checkup"),
    ("fachzahnarzt_oralchirurgie", "specialist_oral_surgery"),
    ("dev-seed-vertraege", "dev-seed-contracts"),
    ("zahlungsziel", "payment_terms"),
    ("rezepttyp", "prescription_kind"),
    ("terminregeln", "appointment_rules"),
    ("direktzahlung", "direct_payment"),
    ("fachzahnarzt", "specialist_dentist"),
    ("unbefristet", "unlimited"),
    ("befristet", "fixed_term"),
    ("bezeichnung", "designation"),
    ("Bezeichnung", "Designation"),
    ("document_pfad", "document_path"),
    ("periode_von", "period_from"),
    ("periode_bis", "period_until"),
    ("periodeVon", "periodFrom"),
    ("periodeBis", "periodUntil"),
    ("IN_BEHANDLUNG", "IN_TREATMENT"),
    ("krankenkasse", "health_insurance"),
    ("krankenhaus", "hospital"),
    ("bestellwesen", "ordering"),
    ("bestellstamm", "order_master"),
    ("bestellnr", "order_number"),
    ("zahnarzt", "dentist"),
    ("vertraege", "contracts"),
    ("Vertraege", "Contracts"),
    ("intervall", "interval"),
    ("Intervall", "Interval"),
    ("laufzeit", "term"),
    ("erezept", "e_prescription"),
    ("bestellt", "ordered"),
    ("validieren", "validate"),
    ("aendern", "change"),
    ("erforderlich", "required"),
    ("behandler", "clinician"),
    ("WOCHE", "WEEK"),
    ("MONAT", "MONTH"),
    ("JAHR", "YEAR"),
    ("TAG", "DAY"),
    ("pfad", "path"),
    ("berufs", "professional"),
    ("bezug", "reference"),
    ("lager", "inventory"),
    ("zeit", "time"),
    ("KrankenbescheinigungFormPage", "SickLeaveCertificateFormPage"),
    ("krankenbescheinigung", "sick_leave_certificate"),
    ("Krankenbescheinigung", "SickLeaveCertificate"),
    ("TagesabschlussProtokoll", "DayCloseProtocol"),
    ("tagesabschluss_protokoll", "day_close_protocol"),
    ("tagesabschluss", "day_close"),
    ("Tagesabschluss", "DayClose"),
    ("includeVersicherungsnummer", "includeInsuranceNumber"),
    ("include_versicherungsnummer", "include_insurance_number"),
    ("versicherungsnummer", "insurance_number"),
    ("PraxisAufgabe", "PracticeTask"),
    ("praxisAufgabe", "practiceTask"),
    ("praxis_aufgabe", "practice_task"),
    ("listZahnbefunde", "listDentalFindings"),
    ("Zahnbefunde", "DentalFindings"),
    ("zahnbefunde", "dental_findings"),
    ("CreateZahnbefund", "CreateDentalFinding"),
    ("Zahnbefund", "DentalFinding"),
    ("zahnbefund", "dental_finding"),
    ("Patientenakte", "PatientChart"),
    ("patientenakte", "patient_chart"),
    ("Anamnesebogen", "AnamnesisForm"),
    ("anamnesebogen", "anamnesis_form"),
    ("saveAnamnesebogen", "saveAnamnesisForm"),
    ("getAnamnesebogen", "getAnamnesisForm"),
    ("BehandlungsKatalogItem", "TreatmentCatalogItem"),
    ("BehandlungsKatalog", "TreatmentCatalog"),
    ("behandlungs_katalog", "treatment_catalog"),
    ("behandlungsnummer", "treatment_number"),
    ("behandlung_status", "treatment_status"),
    ("behandlung_datum", "treatment_date"),
    ("listBehandlungen", "listTreatments"),
    ("Behandlungen", "Treatments"),
    ("behandlungen", "treatments"),
    ("CreateBehandlung", "CreateTreatment"),
    ("UpdateBehandlung", "UpdateTreatment"),
    ("Behandlung", "Treatment"),
    ("behandlung", "treatment"),
    ("Untersuchungen", "Examinations"),
    ("untersuchungen", "examinations"),
    ("Untersuchung", "Examination"),
    ("untersuchung", "examination"),
    ("listBestellungen", "listPurchaseOrders"),
    ("CreateBestellung", "CreatePurchaseOrder"),
    ("UpdateBestellung", "UpdatePurchaseOrder"),
    ("Bestellungen", "PurchaseOrders"),
    ("bestellungen", "purchase_orders"),
    ("Bestellung", "PurchaseOrder"),
    ("bestellung", "purchase_order"),
    ("bestellnummer", "order_number"),
    ("EinstellungenPage", "SettingsPage"),
    ("Einstellungen", "Settings"),
    ("einstellungen", "settings"),
    ("VerwaltungPage", "AdministrationPage"),
    ("Verwaltung", "Administration"),
    ("verwaltung", "administration"),
    ("ZahlungsArt", "PaymentMethod"),
    ("ZahlungsStatus", "PaymentStatus"),
    ("zahlungsart", "payment_method"),
    ("CreateZahlung", "CreatePayment"),
    ("UpdateZahlung", "UpdatePayment"),
    ("listZahlungen", "listPayments"),
    ("Zahlungen", "Payments"),
    ("zahlungen", "payments"),
    ("Zahlung", "Payment"),
    ("zahlung", "payment"),
    ("listTermineByDate", "listAppointmentsByDate"),
    ("list_termine_by_date", "list_appointments_by_date"),
    ("listTermine", "listAppointments"),
    ("createTermin", "createAppointment"),
    ("updateTermin", "updateAppointment"),
    ("deleteTermin", "deleteAppointment"),
    ("getTermin", "getAppointment"),
    ("CreateTermin", "CreateAppointment"),
    ("UpdateTermin", "UpdateAppointment"),
    ("TerminePage", "AppointmentsPage"),
    ("TerminArt", "AppointmentKind"),
    ("TerminStatus", "AppointmentStatus"),
    ("Termine", "Appointments"),
    ("termine", "appointments"),
    ("Termin", "Appointment"),
    ("termin", "appointment"),
    ("listPatienten", "listPatients"),
    ("searchPatienten", "searchPatients"),
    ("PatientenPage", "PatientsPage"),
    ("Patienten", "Patients"),
    ("patienten", "patients"),
    ("RezeptCreate", "PrescriptionCreate"),
    ("RezeptEdit", "PrescriptionEdit"),
    ("listRezepte", "listPrescriptions"),
    ("CreateRezept", "CreatePrescription"),
    ("UpdateRezept", "UpdatePrescription"),
    ("Rezepte", "Prescriptions"),
    ("rezepte", "prescriptions"),
    ("rezept_typ", "prescription_type"),
    ("Rezept", "Prescription"),
    ("rezept", "prescription"),
    ("listAtteste", "listCertificates"),
    ("CreateAttest", "CreateCertificate"),
    ("Atteste", "Certificates"),
    ("atteste", "certificates"),
    ("Attest", "Certificate"),
    ("attest", "certificate"),
    ("CreateLeistung", "CreateServiceItem"),
    ("UpdateLeistung", "UpdateServiceItem"),
    ("Leistungen", "Services"),
    ("leistungen", "services"),
    ("Leistung", "ServiceItem"),
    ("leistung", "service_item"),
    ("leistungsname", "service_name"),
    ("BilanzSnapshot", "BalanceSheetSnapshot"),
    ("bilanz_snapshot", "balance_sheet_snapshot"),
    ("getBilanz", "getBalanceSheet"),
    ("Bilanz", "BalanceSheet"),
    ("bilanz", "balance_sheet"),
    ("StatistikOverview", "StatisticsOverview"),
    ("StatistikPage", "StatisticsPage"),
    ("statistik", "statistics"),
    ("Statistik", "Statistics"),
    ("Anamnese", "Anamnesis"),
    ("anamnese", "anamnesis"),
    ("DatenschutzPage", "PrivacyPage"),
    ("datenschutz", "privacy"),
    ("Datenschutz", "Privacy"),
    ("Posteingang", "Inbox"),
    ("posteingang", "inbox"),
    ("FinanzenPage", "FinancePage"),
    ("FinanzenKasse", "FinanceCash"),
    ("finanzen", "finance"),
    ("Finanzen", "Finance"),
    ("ProduktePage", "ProductsPage"),
    ("produkte", "products"),
    ("Produkt", "Product"),
    ("produkt", "product"),
    ("listPersonal", "listStaff"),
    ("createPersonal", "createStaff"),
    ("CreatePersonal", "CreateStaff"),
    ("UpdatePersonal", "UpdateStaff"),
    ("PersonalPage", "StaffPage"),
    ("personal", "staff"),
    ("Personal", "Staff"),
    ("Arbeitsplan", "WorkPlan"),
    ("arbeitsplan", "work_plan"),
    ("Arbeitszeit", "WorkTime"),
    ("arbeitszeiten", "work_hours"),
    ("arbeitszeit", "work_time"),
    ("Arbeitstage", "WorkDays"),
    ("arbeitstage", "work_days"),
    ("LieferantPharmaVorlage", "SupplierPharmaTemplate"),
    ("LieferantStamm", "SupplierMaster"),
    ("lieferant", "supplier"),
    ("Lieferant", "Supplier"),
    ("PharmaberaterStamm", "PharmaConsultantMaster"),
    ("pharmaberater", "pharma_consultant"),
    ("Pharmaberater", "PharmaConsultant"),
    ("DokumentVorlage", "DocumentTemplate"),
    ("dokument_vorlage", "document_template"),
    ("dokument", "document"),
    ("Dokument", "Document"),
    ("listAbwesenheiten", "listAbsences"),
    ("CreateAbwesenheit", "CreateAbsence"),
    ("Abwesenheit", "Absence"),
    ("abwesenheit", "absence"),
    ("Quittung", "Receipt"),
    ("quittung", "receipt"),
    ("Merkblatt", "Leaflet"),
    ("merkblatt", "leaflet"),
    ("AkteAnlage", "ChartAttachment"),
    ("akte_anlage", "chart_attachment"),
    ("behandlung_id", "treatment_id"),
    ("untersuchung_id", "examination_id"),
    ("ergebnisse", "results"),
    ("untersuchungsnummer", "examination_number"),
    ("akte_id", "chart_id"),
    ("listAkteAnlagen", "listChartAttachments"),
    ("createAkteAnlageFromPath", "createChartAttachmentFromPath"),
    ("createAkteAnlage", "createChartAttachment"),
    ("renameAkteAnlage", "renameChartAttachment"),
    ("setAkteAnlageDocumentKind", "setChartAttachmentDocumentKind"),
    ("openAkteAnlageExternally", "openChartAttachmentExternally"),
    ("duplicateAkteAnlage", "duplicateChartAttachment"),
    ("exportAktePdf", "exportChartPdf"),
    ("AkteAnlagen", "ChartAttachments"),
    ("AkteAnlage", "ChartAttachment"),
    ("AktenStatus", "ChartStatus"),
    ("akten", "charts"),
    ("Akte", "Chart"),
    ("akte", "chart"),
    ("PraxisTickets", "PracticeTickets"),
    ("Praxisplanung", "PracticePlanning"),
    ("praxisplanung", "practice_planning"),
    ("PraxisPraeferenzen", "PracticePreferences"),
    ("praxis_praeferenzen", "practice_preferences"),
    ("praxis", "practice"),
    ("Praxis", "Practice"),
    ("Vertrag", "Contract"),
    ("vertrag", "contract"),
    ("Lizenz", "License"),
    ("lizenz", "license"),
    ("Verbund", "Cluster"),
    ("verbund", "cluster"),
    ("Vorlage", "Template"),
    ("vorlage", "template"),
    ("vorlagen", "templates"),
    ("Aufgabe", "Task"),
    ("aufgabe", "task"),
    ("aufgaben", "tasks"),
    ("Rechnung", "Invoice"),
    ("rechnung", "invoice"),
    ("freigegeben_von_arzt_id", "released_by_physician_id"),
    ("freigegeben_am", "released_at"),
    ("kasse_geprueft", "cash_verified"),
    ("kasseGeprueft", "cashVerified"),
    ("betrag_erwartet", "amount_expected"),
    ("anzahl_zahlungen", "payment_count"),
    ("patienten_gesamt", "patients_total"),
    ("termine_heute", "appointments_today"),
    ("einnahmen_monat", "revenue_month"),
    ("produkte_niedrig", "products_low"),
    ("default_kosten", "default_cost"),
    ("gesamtkosten", "total_cost"),
    ("termin_erforderlich", "appointment_required"),
    ("zahn_nummer", "tooth_number"),
    ("geburtsdatum", "date_of_birth"),
    ("taetigkeitsbereich", "activity_area"),
    ("fachrichtung", "specialty"),
    ("verfuegbar", "available"),
    ("unterschrieben", "signed"),
    ("antworten", "answers"),
    ("befunde", "findings"),
    ("befund", "finding"),
    ("diagnose", "diagnosis"),
    ("beschreibung", "description"),
    ("beschwerden", "chief_complaint"),
    ("notizen", "notes"),
    ("zaehne", "teeth"),
    ("kategorie", "category"),
    ("kategorien", "categories"),
    ("zahlungsart", "payment_method"),
    ("betrag", "amount"),
    ("einnahmen", "income"),
    ("ausgaben", "expenses"),
    ("ausstehend", "outstanding"),
    ("storniert", "cancelled"),
    ("bestand", "stock"),
    ("mindestbestand", "min_stock"),
    ("preis", "price"),
    ("aktiv", "active"),
    ("titel", "title"),
    ("passwort", "password"),
    ("telefon", "phone"),
    ("adresse", "address"),
    ("geschlecht", "sex"),
    ("Geschlecht", "Sex"),
    ("rolle", "role"),
    ("Rolle", "Role"),
    ("arzt_id", "physician_id"),
    ("Arzt", "Physician"),
    ("aerzte", "physicians"),
    ("Aerzte", "Physicians"),
    ("listAerzte", "listPhysicians"),
    ("sitzung", "session_number"),
    ("medikament", "medication"),
    ("wirkstoff", "active_ingredient"),
    ("dosierung", "dosage"),
    ("dauer", "duration"),
    ("hinweise", "instructions"),
    ("darreichungsform", "dosage_form"),
    ("packungsgroesse", "pack_size"),
    ("verordnender_arzt_id", "prescribing_physician_id"),
    ("ausstellender_arzt_id", "issuing_physician_id"),
    ("gueltig_von", "valid_from"),
    ("gueltig_bis", "valid_until"),
    ("arbeitgeber", "employer"),
    ("inhalt", "body_text"),
    ("erwartet_am", "expected_on"),
    ("bemerkung", "remark"),
    ("gesamtbetrag", "total_amount"),
    ("einheit", "unit"),
    ("artikel", "item"),
    ("menge", "quantity"),
    ("betreff", "subject"),
    ("nachricht", "message"),
    ("referenz", "reference"),
    ("zeitraum", "period"),
    ("kommentar", "comment"),
    ("von_tag", "from_day"),
    ("bis_tag", "to_day"),
    ("von_uhrzeit", "from_time"),
    ("bis_uhrzeit", "to_time"),
    ("uhrzeit", "time"),
    ("datum", "date"),
    ("altersgruppen", "age_groups"),
    ("geschlechter", "sexes"),
    ("krankheitsbilder_top", "disease_patterns_top"),
    ("krankheitsbilder_verlauf_pro_monat", "disease_patterns_monthly"),
    ("medikamente_top", "medications_top"),
    ("behandlungen_nach_kategorie", "treatments_by_category"),
    ("behandlungen_pro_monat", "treatments_per_month"),
    ("patienten_neu_pro_monat", "new_patients_per_month"),
    ("patienten_kumuliert_pro_monat", "patients_cumulative_per_month"),
    ("termine_pro_monat", "appointments_per_month"),
    ("termin_status", "appointment_status"),
    ("termin_art", "appointment_kind"),
    ("einnahmen_pro_monat", "income_per_month"),
    ("umsatz_nach_zahlungsart", "revenue_by_payment_method"),
    ("einnahmen_aktueller_monat", "income_current_month"),
    ("bestellungen_nach_status", "orders_by_status"),
    ("bestellungen_pro_monat", "orders_per_month"),
    ("BestellStatus", "OrderStatus"),
    ("FeedbackKategorie", "FeedbackCategory"),
    ("kasse", "cash"),
    ("typ", "kind"),
    ("art", "kind"),
    ("uhrzeitToMinutes", "timeToMinutes"),
    ("minutesToUhrzeit", "minutesToTime"),
    ("normUhrzeitHm", "normTimeHm"),
    ("parseTerminDurationMin", "parseAppointmentDurationMin"),
    ("hasTerminOverlapForArzt", "hasAppointmentOverlapForPhysician"),
    ("buildTerminSlotGrid", "buildAppointmentSlotGrid"),
    ("preferredUhrzeit", "preferredTime"),
    ("zusatzHinweise", "additionalNotes"),
    ("ueberweisungHinweise", "referralNotes"),
    ("setZusatzHinweise", "setAdditionalNotes"),
    ("setUeberweisungHinweise", "setReferralNotes"),
    ("deleteAkteAnlage", "deleteChartAttachment"),
    ("AkteExportSectionsState", "ChartExportSectionsState"),
    ("AkteAnlageRowDto", "ChartAttachmentRowDto"),
    ("exportDischargeMerkblattPdf", "exportDischargeLeafletPdf"),
    ("goNeuerTermin", "goNewAppointment"),
    ("terminIstNotfallMarkiert", "appointmentIsEmergencyMarked"),
    ("TERMIN_DEFAULT_DUR_MIN", "APPOINTMENT_DEFAULT_DUR_MIN"),
    ("createZahnbefund", "createDentalFinding"),
    ("createBehandlung", "createTreatment"),
    ("updateBehandlung", "updateTreatment"),
    ("deleteBehandlung", "deleteTreatment"),
    ("releaseBehandlungForBilling", "releaseTreatmentForBilling"),
    ("formatZahlungBezugLine", "formatPaymentReferenceLine"),
    ("zahlungsartLabel", "paymentMethodLabel"),
    ("zahlStatusDisplay", "paymentStatusDisplay"),
    ("zahlungArtSelectOptions", "paymentMethodSelectOptions"),
    ("zahlCountsTowardPaid", "paymentCountsTowardPaid"),
    ("buildFinanzenReportBundle", "buildFinanceReportBundle"),
    ("finanzVorgangText", "financeTransactionText"),
    ("suggestQuittungExportBasename", "suggestReceiptExportBasename"),
    ("suggestQuittungHtmlFilename", "suggestReceiptHtmlFilename"),
    ("suggestAttestExportBasename", "suggestCertificateExportBasename"),
    ("suggestRezeptExportBasename", "suggestPrescriptionExportBasename"),
    ("suggestRezeptComboExportBasename", "suggestPrescriptionComboExportBasename"),
    ("suggestAttestHtmlFilename", "suggestCertificateHtmlFilename"),
    ("suggestRezeptHtmlFilename", "suggestPrescriptionHtmlFilename"),
    ("buildAttestPdfLayout", "buildCertificatePdfLayout"),
    ("buildQuittungPdfLayout", "buildReceiptPdfLayout"),
    ("buildRezeptPdfLayout", "buildPrescriptionPdfLayout"),
    ("buildRezeptComboPdfLayout", "buildPrescriptionComboPdfLayout"),
    ("rezeptStatusLabel", "prescriptionStatusLabel"),
    ("leistung_id", "service_item_id"),
    ("produkt_id", "product_id"),
    ("produkt_name", "product_name"),
    ("produkt_kategorie", "product_category"),
    ("produkt_preis", "product_price"),
    ("produkt_aktiv", "product_active"),
    ("lieferant_id", "supplier_id"),
    ("lieferant_name", "supplier_name"),
    ("pharmaberater_id", "pharma_consultant_id"),
    ("pharmaberater_name", "pharma_consultant_name"),
    ("ausgestellt_am", "issued_at"),
    ("abwesenheiten", "absences"),
    ("personalId", "staffId"),
    ("PraxisArbeitszeitenConfig", "PracticeWorkHoursConfig"),
    ("readPraxisArbeitszeitenConfig", "readPracticeWorkHoursConfig"),
    ("loadPraxisArbeitszeitenConfig", "loadPracticeWorkHoursConfig"),
    ("usePraxisArbeitszeitenStore", "usePracticeWorkHoursStore"),
    ("PraxisDayKey", "PracticeDayKey"),
    ("PraxisDayPlan", "PracticeDayPlan"),
    ("VerwaltungPageHeader", "AdministrationPageHeader"),
    ("PlanNextTerminV2", "PlanNextAppointmentV2"),
    ("getInvoicePraxisFromStorage", "getInvoicePracticeFromStorage"),
    ("InvoicePraxis", "InvoicePractice"),
    ("RezeptLine", "PrescriptionLine"),
    ("arztToneMap", "physicianToneMap"),
    ("PatientDetailAkteTab", "PatientDetailChartTab"),
    ("currentDatum", "currentDate"),
    ("terminArtHint", "appointmentKindHint"),
    ("isRezeption", "isReception"),
    ("isArzt", "isPhysician"),
    ("canReadFinanzen", "canReadFinance"),
    ("canWriteZahlung", "canWritePayment"),
    ("canFinanzenWrite", "canFinanceWrite"),
    ("canEditPraxis", "canEditPractice"),
    ("setPraxis", "setPractice"),
    ("setTermine", "setAppointments"),
    ("setPersonal", "setStaff"),
    ("setBehandlungen", "setTreatments"),
    ("setZahlungen", "setPayments"),
    ("PraxisAufgabeStatus", "PracticeTaskStatus"),
    ("PraxisAufgabeTyp", "PracticeTaskKind"),
    ("countOpenPraxisAufgabenForMe", "countOpenPracticeTasksForMe"),
    ("listDokumentVorlagen", "listDocumentTemplates"),
    ("behandlungsKatalogCategoryLabel", "treatmentCatalogCategoryLabel"),
    ("normalizeAkteDocumentKind", "normalizeChartDocumentKind"),
    ("getVerwaltungBackTarget", "getAdministrationBackTarget"),
    ("emptyPlanNextTermin", "emptyPlanNextAppointment"),
    ("emptyRezeptLine", "emptyPrescriptionLine"),
    ("resetRezeptWizard", "resetPrescriptionWizard"),
    ("resetAttestWizard", "resetCertificateWizard"),
    ("setAttestForm", "setCertificateForm"),
    ("attestForm", "certificateForm"),
    ("rezeptEditForm", "prescriptionEditForm"),
    ("rezeptDraft", "prescriptionDraft"),
    ("rezeptWizardStep", "prescriptionWizardStep"),
    ("attestWizardStep", "certificateWizardStep"),
    ("onBearbeiten", "onEdit"),
    ("bestellStatusDisplay", "orderStatusDisplay"),
    ("terminArtLabelFromTermin", "appointmentKindLabelFromAppointment"),
    ("TerminDoctorTone", "AppointmentDoctorTone"),
    ("VerwaltungTocHubId", "AdministrationTocHubId"),
    ("VerwaltungHubPage", "AdministrationHubPage"),
    ("praxisCfg", "practiceCfg"),
    ("praxisPlanCfg", "practicePlanCfg"),
    ("checkPraxisDocumentReadiness", "checkPracticeDocumentReadiness"),
    ("maskPraxisExportToken", "maskPracticeExportToken"),
    ("AkteSavePending", "ChartSavePending"),
    ("akteSaveConfirm", "chartSaveConfirm"),
    ("anamneseJson", "anamnesisJson"),
    ("beschwerdenTags", "chiefComplaintTags"),
    ("lieferantId", "supplierId"),
    ("lieferanten", "suppliers"),
    ("PersonalArbeitsBlock", "StaffWorkBlock"),
    ("zahlungenPatient", "paymentsPatient"),
    ("TerminArtNotizen", "AppointmentKindNotes"),
    ("ZahlRowActionsMenu", "PaymentRowActionsMenu"),
    ("ZahlRowAction", "PaymentRowAction"),
    ("ZahlZuordnungSummaryRow", "PaymentAssignmentSummaryRow"),
    ("ZahlNewFormState", "PaymentNewFormState"),
    ("zahlNewForm", "paymentNewForm"),
    ("BehandFormState", "TreatmentFormState"),
    ("setBehandForm", "setTreatmentForm"),
    ("behandForm", "treatmentForm"),
    ("EMPTY_BEHAND_FORM", "EMPTY_TREATMENT_FORM"),
    ("CreateBilanzSnapshot", "CreateBalanceSheetSnapshot"),
    ("listBilanzSnapshots", "listBalanceSheetSnapshots"),
    ("getBilanzSnapshot", "getBalanceSheetSnapshot"),
    ("createBilanzSnapshot", "createBalanceSheetSnapshot"),
    ("deleteBilanzSnapshot", "deleteBalanceSheetSnapshot"),
    ("einnahmen_cents", "income_cents"),
    ("ausgaben_cents", "expenses_cents"),
    ("saldo_cents", "balance_cents"),
    ("gezaehlt_eur", "counted_eur"),
    ("bar_laut_system_eur", "system_cash_eur"),
    ("bar_stimmt", "cash_matches"),
    ("zurueck_begruendung", "return_reason"),
    ("geliefert_am", "delivered_on"),
    ("stichtag", "as_of_date"),
    ("saldo", "balance"),
    ("ROLLE_VALUES", "ROLE_VALUES"),
    ("GESCHLECHT_VALUES", "SEX_VALUES"),
    ("TERMIN_ART_VALUES", "APPOINTMENT_KIND_VALUES"),
    ("TERMIN_STATUS_VALUES", "APPOINTMENT_STATUS_VALUES"),
    ("AKTEN_STATUS_VALUES", "CHART_STATUS_VALUES"),
    ("ZAHLUNGS_ART_VALUES", "PAYMENT_METHOD_VALUES"),
    ("ZAHLUNGS_STATUS_VALUES", "PAYMENT_STATUS_VALUES"),
    ("BESTELL_STATUS_VALUES", "ORDER_STATUS_VALUES"),
    ("FEEDBACK_KATEGORIE_VALUES", "FEEDBACK_CATEGORY_VALUES"),
    ("RolleSchema", "RoleSchema"),
    ("GeschlechtSchema", "SexSchema"),
    ("TerminArtSchema", "AppointmentKindSchema"),
    ("TerminStatusSchema", "AppointmentStatusSchema"),
    ("AktenStatusSchema", "ChartStatusSchema"),
    ("ZahlungsartSchema", "PaymentMethodSchema"),
    ("ZahlungStatusSchema", "PaymentStatusSchema"),
    ("FeedbackKategorieSchema", "FeedbackCategorySchema"),
    ("BestellStatus", "OrderStatus"),
    ("AktenStatus", "ChartStatus"),
    ("FeedbackKategorie", "FeedbackCategory"),
    ("NichtErschienen", "NoShow"),
    ("Durchgefuehrt", "Completed"),
    ("Bestaetigt", "Confirmed"),
    ("Geplant", "Planned"),
    ("Abgesagt", "Cancelled"),
    ("Erstbesuch", "FirstVisit"),
    ("Maennlich", "Male"),
    ("Weiblich", "Female"),
    ("InBearbeitung", "InProgress"),
    ("Entwurf", "Draft"),
    ("Validiert", "Validated"),
    ("Ausstehend", "Outstanding"),
    ("Bezahlt", "Paid"),
    ("Teilbezahlt", "PartiallyPaid"),
    ("Storniert", "Cancelled"),
    ("Ueberweisung", "BankTransfer"),
    ("Rechnung", "Invoice"),
    ("Karte", "Card"),
    ("Steuerberater", "TaxAdvisor"),
    ("Pharmaberater", "PharmaConsultant"),
    ("Rezeption", "Reception"),
    ("STATUS_UNTERWEGS", "STATUS_IN_TRANSIT"),
    ("STATUS_GELIEFERT", "STATUS_DELIVERED"),
    ("STATUS_STORNIERT", "STATUS_CANCELLED"),
    ("STATUS_OFFEN", "STATUS_OPEN"),
]


def to_camel(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:] if p)


def expand_pairs(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(a: str, b: str) -> None:
        if a not in seen:
            out.append((a, b))
            seen.add(a)

    for old, new in pairs:
        add(old, new)
        if "_" in old:
            add(to_camel(old), to_camel(new))
        # CreateTermin → createTermin (controllers / helpers)
        if old[:1].isupper():
            add(old[:1].lower() + old[1:], new[:1].lower() + new[1:])
        # CreateTerminSchema is a single token, not covered by CreateTermin
        if old.startswith(("Create", "Update", "Delete")):
            add(old + "Schema", new + "Schema")
    out.sort(key=lambda kv: len(kv[0]), reverse=True)
    return out


IDENT = expand_pairs(PAIRS)
IDENT_MAP = {a: b for a, b in IDENT}

# Applied only to .rs (recharts `Bar`, etc. must stay in TS).
RUST_ONLY_PAIRS: list[tuple[str, str]] = [
    ("Bar", "Cash"),
    ("Kontrolle", "Checkup"),
    ("Beratung", "Consultation"),
    ("Aktiv", "Active"),
    ("Neu", "New"),
    ("Divers", "Diverse"),
]
RUST_ONLY_MAP = {a: b for a, b in expand_pairs(RUST_ONLY_PAIRS)}

KEEP_TOKENS: set[str] = set()

EXTRA_STEMS = {
    "zahl": "payment",
    "behand": "treatment",
    "behandlungs": "treatment",
    "bestell": "order",
    "bestellstamm": "order_master",
    "validieren": "validate",
    "bezeichnung": "designation",
    "vertraege": "contracts",
    "unbefristet": "unlimited",
    "befristet": "fixed_term",
    "intervall": "interval",
    "laufzeit": "term",
    "zahlungsziel": "payment_terms",
    "behandler": "clinician",
    "berufs": "professional",
    "pfad": "path",
    "lager": "inventory",
    "zeit": "time",
    "untersuch": "examination",
    "saldo": "balance",
    "stichtag": "as_of_date",
    "gezaehlt": "counted",
    "zurueck": "back",
    "begruendung": "reason",
    "geliefert": "delivered",
    "unterwegs": "in_transit",
    "bearbeitung": "processing",
    "erledigt": "done",
    "einnahmen": "income",
    "ausgaben": "expenses",
    "katalog": "catalog",
    "stamm": "master",
    "sonder": "special",
    "sperrzeiten": "blocked_times",
    "sperrzeit": "blocked_time",
    "praeferenzen": "preferences",
    "praeferenz": "preference",
    "anlage": "attachment",
    "anlagen": "attachments",
    "aerzt": "physician",
    "protokoll": "protocol",
    "protokolle": "protocols",
    "kommentar": "comment",
    "kommentare": "comments",
    "finanz": "finance",
    "werkzeuge": "tools",
    "sonstiges": "other",
    "stammdaten": "master_data",
    "abrechnung": "billing",
    "tagesbericht": "daily_report",
    "einverstaendnis": "consent",
    "roentgen": "xray",
    "ueberblick": "overview",
    "ueberfaellig": "overdue",
}

CAMEL_RE = re.compile(r"[A-ZÄÖÜ]?[a-zäöüß]+|[A-ZÄÖÜ]+(?![a-zäöüß])|[0-9]+")
IDENT_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def to_snake(s: str) -> str:
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", s)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return s.replace("-", "_").lower()


def to_pascal(s: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in to_snake(s).split("_") if p)


def shape_like(src: str, dst: str) -> str:
    if src.isupper() and len(src) > 1:
        return to_snake(dst).upper()
    if "_" in src:
        return to_snake(dst)
    if src[:1].isupper():
        return to_pascal(dst)
    c = to_pascal(dst)
    return c[:1].lower() + c[1:] if c else c


def split_ident(tok: str) -> list[str]:
    parts: list[str] = []
    for chunk in re.split(r"[_\-]+", tok):
        if not chunk:
            continue
        bits = CAMEL_RE.findall(chunk)
        parts.extend(bits if bits else [chunk])
    return parts


def map_part(part: str, table: dict[str, str]) -> str:
    if part in KEEP_TOKENS:
        return part
    if part in table:
        return table[part]
    low = part.lower()
    if low in table:
        return shape_like(part, table[low])
    pas = part[:1].upper() + part[1:] if part else part
    if pas in table:
        return shape_like(part, table[pas])
    if low in EXTRA_STEMS:
        return shape_like(part, EXTRA_STEMS[low])
    return part


def compose_ident(tok: str, table: dict[str, str]) -> str:
    parts = split_ident(tok)
    if len(parts) < 2:
        low = tok.lower()
        if low in EXTRA_STEMS:
            return shape_like(tok, EXTRA_STEMS[low])
        return tok
    new_parts = [map_part(p, table) for p in parts]
    if new_parts == parts:
        return tok
    if tok.isupper() and "_" in tok:
        return "_".join(to_snake(p).upper() for p in new_parts)
    if "_" in tok:
        return "_".join(to_snake(p) for p in new_parts)
    if tok[:1].isupper():
        return "".join(to_pascal(p) for p in new_parts)
    return to_camel(new_parts[0]) + "".join(to_pascal(p) for p in new_parts[1:])


def map_ident(tok: str, table: dict[str, str] | None = None) -> str:
    table = table or IDENT_MAP
    if tok in KEEP_TOKENS:
        return tok
    if tok in table:
        return table[tok]
    return compose_ident(tok, table)


def rewrite_code(src: str, table: dict[str, str] | None = None) -> str:
    """Rewrite identifiers in code and in `${…}` template interpolations.

    Plain string / template *text* is left unchanged so IPC command names,
    routes, i18n keys, and XML tags stay German.
    """
    table = table or IDENT_MAP
    n = len(src)

    def parse(i: int, end_on_rbrace: bool) -> tuple[str, int]:
        out: list[str] = []
        brace_depth = 0
        prev_sig = ""
        while i < n:
            ch = src[i]
            nxt = src[i + 1] if i + 1 < n else ""
            if ch == "/" and nxt == "/":
                j = src.find("\n", i)
                if j < 0:
                    out.append(src[i:])
                    return "".join(out), n
                out.append(src[i:j])
                i = j
                continue
            if ch == "/" and nxt == "*":
                j = src.find("*/", i + 2)
                if j < 0:
                    out.append(src[i:])
                    return "".join(out), n
                out.append(src[i : j + 2])
                i = j + 2
                continue
            if ch == "/" and not (prev_sig.isalnum() or prev_sig in "$_)]"):
                # Regex literal (not division). Character classes may contain quotes.
                j = i + 1
                in_class = False
                closed = False
                while j < n:
                    c = src[j]
                    if c == "\\":
                        j += 2
                        continue
                    if c == "\n":
                        break
                    if c == "[" and not in_class:
                        in_class = True
                        j += 1
                        continue
                    if c == "]" and in_class:
                        in_class = False
                        j += 1
                        continue
                    if c == "/" and not in_class:
                        j += 1
                        while j < n and src[j] in "gimsuyd":
                            j += 1
                        closed = True
                        break
                    j += 1
                if closed:
                    out.append(src[i:j])
                    prev_sig = "1"  # regex is a primary → following `/` is division
                    i = j
                    continue
            if ch in "'\"":
                q = ch
                j = i + 1
                while j < n:
                    if src[j] == "\\":
                        j += 2
                        continue
                    if src[j] == q:
                        j += 1
                        break
                    j += 1
                out.append(src[i:j])
                prev_sig = q
                i = j
                continue
            if ch == "`":
                out.append("`")
                i += 1
                while i < n:
                    if src[i] == "\\":
                        out.append(src[i : i + 2] if i + 1 < n else src[i])
                        i += 2
                        continue
                    if src[i] == "`":
                        out.append("`")
                        i += 1
                        break
                    if src[i] == "$" and i + 1 < n and src[i + 1] == "{":
                        out.append("${")
                        i += 2
                        inner, i = parse(i, True)
                        out.append(inner)
                        if i < n and src[i] == "}":
                            out.append("}")
                            i += 1
                        continue
                    out.append(src[i])
                    i += 1
                prev_sig = "`"
                continue
            if end_on_rbrace and ch == "}" and brace_depth == 0:
                return "".join(out), i
            if end_on_rbrace and ch == "{":
                brace_depth += 1
                out.append(ch)
                prev_sig = ch
                i += 1
                continue
            if end_on_rbrace and ch == "}":
                brace_depth -= 1
                out.append(ch)
                prev_sig = ch
                i += 1
                continue
            m = IDENT_RE.match(src, i)
            if m:
                tok = m.group(0)
                mapped = map_ident(tok, table)
                out.append(mapped)
                prev_sig = mapped[-1]
                i = m.end()
                continue
            out.append(ch)
            if not ch.isspace():
                prev_sig = ch
            i += 1
        return "".join(out), i

    body, _ = parse(0, False)
    return body


def iter_ts_files() -> list[Path]:
    files: list[Path] = []
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        if p.suffix not in {".ts", ".tsx"}:
            continue
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if p.name in SKIP_FILES:
            continue
        if any(parent.is_symlink() for parent in p.parents if str(parent).startswith(str(ROOT))):
            continue
        if "locales" in rel.parts:
            continue
        files.append(p)
    return files


def iter_rs_files() -> list[Path]:
    files: list[Path] = []
    for p in ROOT.rglob("*.rs"):
        if not p.is_file() or p.is_symlink():
            continue
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        files.append(p)
    return files


def rust_table() -> dict[str, str]:
    return {**IDENT_MAP, **RUST_ONLY_MAP}


def inject_tauri_renames(src: str, table: dict[str, str]) -> str:
    pat = re.compile(
        r"(#\[tauri::command)(\([^\]]*\))?(\]\s*(?:#\[[^\]]*\]\s*)*)"
        r"(pub\s+(?:async\s+)?fn\s+)([A-Za-z_][A-Za-z0-9_]*)",
        re.M,
    )

    def repl(m: re.Match[str]) -> str:
        args = m.group(2) or ""
        fn = m.group(5)
        new = map_ident(fn, table)
        if new == fn or "rename" in args:
            return m.group(0)
        return f'{m.group(1)}(rename = "{fn}"){m.group(3)}{m.group(4)}{fn}'

    return pat.sub(repl, src)


def _advance_rust_literal(src: str, i: int) -> int | None:
    n = len(src)
    if i >= n:
        return None
    ch = src[i]
    nxt = src[i + 1] if i + 1 < n else ""
    if ch == "/" and nxt == "/":
        j = src.find("\n", i)
        return n if j < 0 else j
    if ch == "/" and nxt == "*":
        j = src.find("*/", i + 2)
        return n if j < 0 else j + 2
    # raw strings: r#"..."# / br#"..."# / r"..."
    raw_at = i
    if ch in "bcr" and i + 1 < n and src[i + 1] in "br":
        raw_at = i + 1
    if src.startswith("r#", raw_at) or src.startswith('r"', raw_at) or src.startswith("r#", i) or src.startswith('r"', i):
        k = i
        if src[k] in "bc":
            k += 1
        if k < n and src[k] == "r":
            k += 1
            hashes = 0
            while k < n and src[k] == "#":
                hashes += 1
                k += 1
            if k < n and src[k] == '"':
                k += 1
                close = '"' + "#" * hashes
                j = src.find(close, k)
                return n if j < 0 else j + len(close)
    if ch == '"':
        j = i + 1
        while j < n:
            if src[j] == "\\":
                j += 2
                continue
            if src[j] == '"':
                return j + 1
            j += 1
        return n
    if ch == "'":
        if i + 2 < n and src[i + 1] == "\\" and src[i + 2] != "'":
            j = i + 2
            while j < n and src[j] != "'":
                j += 1
            return j + 1 if j < n else n
        if i + 2 < n and src[i + 2] == "'":
            return i + 3
        return i + 1
    return None


def inject_struct_field_renames(src: str, table: dict[str, str]) -> str:
    """Insert serde/sqlx rename attrs on German fields of derived structs (original names)."""
    n = len(src)
    out: list[str] = []
    i = 0
    derive_pat = re.compile(r"#\[derive\(([^)]*)\)\]")
    struct_pat = re.compile(r"(?:pub(?:\([^)]+\))?\s+)?(?:struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)")
    field_pat = re.compile(r"(pub(?:\([^)]+\))?\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:")

    while i < n:
        m = derive_pat.search(src, i)
        if not m:
            out.append(src[i:])
            break
        out.append(src[i : m.start()])
        derives = m.group(1)
        j = m.end()
        # skip whitespace/other attributes until struct/enum
        k = j
        while k < n:
            while k < n and src[k].isspace():
                k += 1
            if src.startswith("#[", k):
                close = src.find("]", k)
                if close < 0:
                    break
                k = close + 1
                continue
            break
        sm = struct_pat.match(src, k)
        if not sm:
            out.append(src[m.start() : j])
            i = j
            continue
        brace = src.find("{", sm.end())
        if brace < 0 or brace > sm.end() + 80:
            out.append(src[m.start() : j])
            i = j
            continue
        depth = 0
        p = brace
        while p < n:
            lit = _advance_rust_literal(src, p)
            if lit is not None and lit > p:
                p = lit
                continue
            if src[p] == "{":
                depth += 1
            elif src[p] == "}":
                depth -= 1
                if depth == 0:
                    p += 1
                    break
            p += 1
        block = src[m.start() : p]
        want_serde = "Serialize" in derives or "Deserialize" in derives
        want_sqlx = "FromRow" in derives
        if want_serde or want_sqlx:
            inner_start = brace - m.start() + 1
            inner_end = len(block) - 1
            inner = block[inner_start:inner_end]
            rebuilt: list[str] = []
            q = 0
            while q < len(inner):
                lit = _advance_rust_literal(inner, q)
                if lit is not None and lit > q:
                    rebuilt.append(inner[q:lit])
                    q = lit
                    continue
                fm = field_pat.match(inner, q)
                if fm:
                    name = fm.group(2)
                    new = map_ident(name, table)
                    already = inner[max(0, q - 120) : q]
                    if new != name and f'rename = "{name}"' not in already:
                        line_start = inner.rfind("\n", 0, q) + 1
                        indent = inner[line_start:q]
                        if not indent.strip():
                            while rebuilt and rebuilt[-1] in (" ", "\t"):
                                rebuilt.pop()
                            attrs = ""
                            if want_serde:
                                attrs += f'{indent}#[serde(rename = "{name}")]\n'
                            if want_sqlx:
                                attrs += f'{indent}#[sqlx(rename = "{name}")]\n'
                            rebuilt.append(attrs)
                            rebuilt.append(indent)
                    rebuilt.append(inner[q : fm.end()])
                    q = fm.end()
                    continue
                rebuilt.append(inner[q])
                q += 1
            block = block[:inner_start] + "".join(rebuilt) + block[inner_end:]
        out.append(block)
        i = p
    return "".join(out)


def rewrite_rust_code(src: str, table: dict[str, str]) -> str:
    n = len(src)
    out: list[str] = []
    i = 0
    while i < n:
        lit = _advance_rust_literal(src, i)
        if lit is not None and lit > i and src[i] in "/\"'rbcr":
            # only consume if it really is a literal start
            ch = src[i]
            nxt = src[i + 1] if i + 1 < n else ""
            is_lit = (
                (ch == "/" and nxt in "/*")
                or ch == '"'
                or (
                    ch == "'"
                    and not (
                        i + 1 < n
                        and (src[i + 1].isalpha() or src[i + 1] == "_")
                        and not (i + 2 < n and src[i + 2] == "'")
                    )
                )
                or (ch == "r" and nxt in '"#')
                or (ch == "b" and nxt == '"')
                or (ch == "b" and nxt == "r" and i + 2 < n and src[i + 2] in '"#')
            )
            if is_lit:
                out.append(src[i:lit])
                i = lit
                continue
        m = IDENT_RE.match(src, i)
        if m:
            tok = m.group(0)
            out.append(map_ident(tok, table))
            i = m.end()
            continue
        out.append(src[i])
        i += 1
    return "".join(out)


def convert_rust_source(src: str) -> str:
    table = rust_table()
    src = inject_tauri_renames(src, table)
    src = inject_struct_field_renames(src, table)
    return rewrite_rust_code(src, table)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--lang", choices=("ts", "rs", "all"), default="all")
    ap.add_argument(
        "--no-inject",
        action="store_true",
        help="Do not re-insert serde/sqlx/tauri German rename attributes.",
    )
    args = ap.parse_args()
    n = 0
    if args.lang in {"ts", "all"}:
        for p in iter_ts_files():
            src = p.read_text(encoding="utf-8")
            dst = rewrite_code(src)
            if src != dst:
                n += 1
                print(p.relative_to(ROOT))
                if args.apply:
                    p.write_text(dst, encoding="utf-8")
    if args.lang in {"rs", "all"}:
        table = rust_table()
        for p in iter_rs_files():
            src = p.read_text(encoding="utf-8")
            dst = rewrite_rust_code(src, table) if args.no_inject else convert_rust_source(src)
            if src != dst:
                n += 1
                print(p.relative_to(ROOT))
                if args.apply:
                    p.write_text(dst, encoding="utf-8")
    print(("rewrote" if args.apply else "would rewrite"), n, "files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
