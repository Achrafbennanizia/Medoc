//! Unit tests for `pdf_export`, one module per concern.

mod chart_money_tests {
    use super::super::chart_money;

    #[test]
    fn chart_money_appends_practice_currency() {
        assert_eq!(chart_money(80.0), "80.00 EUR");
        assert_eq!(chart_money(12.5), "12.50 EUR");
    }
}

mod chart_section_gate_tests {
    use super::super::{gate_chart_sections, ChartExportSections};
    use crate::application::rbac::Role;
    use crate::domain::rbac::PermissionOverride;

    #[test]
    fn denied_document_permission_hides_attachment_names() {
        let mut sections = ChartExportSections::default();
        gate_chart_sections(
            &mut sections,
            Role::Physician,
            &[PermissionOverride {
                action: "patient.read_documents".into(),
                effect: "DENY".into(),
            }],
        );
        assert!(!sections.attachments);
        assert!(sections.patient);
    }
}

mod export_chart_pdf_args_tests {
    use super::super::{ExportChartPdfArgs, ExportDischargeLeafletPdfArgs};

    #[test]
    fn deserializes_patient_id_camel_case() {
        let j = serde_json::json!({ "patientId": "p1" });
        let a: ExportChartPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p1");
        assert!(a.sections.patient);
    }

    #[test]
    fn deserializes_patient_id_snake_case() {
        let j = serde_json::json!({ "patient_id": "p2" });
        let a: ExportChartPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p2");
    }

    #[test]
    fn deserializes_sections_partial() {
        let j = serde_json::json!({
            "patientId": "p3",
            "sections": { "patient": true, "payments": false }
        });
        let a: ExportChartPdfArgs = serde_json::from_value(j).unwrap();
        assert!(a.sections.patient);
        assert!(!a.sections.payments);
        assert!(a.sections.chart_core);
    }

    #[test]
    fn discharge_args_deserializes_camel_case() {
        let j = serde_json::json!({
            "patientId": "p1",
            "additionalNotes": "Aftercare",
            "referralNotes": "CAD"
        });
        let a: ExportDischargeLeafletPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p1");
        assert_eq!(a.additional_notes.as_deref(), Some("Aftercare"));
        assert_eq!(a.referral_notes.as_deref(), Some("CAD"));
    }
}

mod chart_label_locale_tests {
    use super::super::{certificate_kind_label, l};

    #[test]
    fn fixed_labels_cover_all_document_locales() {
        let cases = [
            (
                "de",
                "Patientenakte (Kern)",
                "Stammdaten",
                "Arbeitsunfähigkeitsbescheinigung",
            ),
            (
                "en",
                "Patient chart (core)",
                "Master data",
                "Sick-leave certificate",
            ),
            (
                "fr",
                "Dossier patient (noyau)",
                "Données de base",
                "Certificat d'incapacité de travail",
            ),
            (
                "ar",
                "ملف المريض (الأساسي)",
                "البيانات الأساسية",
                "شهادة عجز عن العمل",
            ),
        ];
        for (locale, chart_core, master, sick) in cases {
            assert_eq!(l(locale, "Patient chart (core)"), chart_core);
            assert_eq!(l(locale, "Master data"), master);
            assert_eq!(certificate_kind_label(locale, "SICK_LEAVE"), sick);
        }
    }
}
