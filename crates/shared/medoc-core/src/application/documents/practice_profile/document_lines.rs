//! Address, footer, signature, payment-terms and VAT lines of the practice profile on documents (split from `practice_profile.rs`).

use super::*;

impl PracticeProfile {
    /// Lines under the practice name. Reports print the name separately, so
    /// cells stay unjoined here.
    pub fn document_address_lines(&self) -> Vec<String> {
        let mut out = Vec::new();
        for row in self.header_table() {
            for cell in row {
                if cell.as_deref() == Some("name") {
                    continue;
                }
                if let Some(key) = cell.as_deref() {
                    self.push_header_field(&mut out, key);
                }
            }
        }
        out
    }

    pub fn bank_lines(&self) -> Vec<String> {
        let mut v = Vec::new();
        if let Some(h) = opt(&self.account_holder) {
            v.push(format!("{} {h}", header_label("holder")));
        }
        if let Some(b) = opt(&self.bank_name) {
            v.push(b.to_string());
        }
        if let Some(i) = opt(&self.bank_iban) {
            v.push(format!("IBAN {i}"));
        }
        if let Some(b) = opt(&self.bank_bic) {
            v.push(format!("BIC {b}"));
        }
        v
    }

    /// Minimal letterhead for documents with no legal content requirements (receipts, reminders,
    /// reports, record exports, leaflets): who the practice is and how to reach it. No
    /// practitioner, no professional or tax numbers, no bank details, whatever the saved header
    /// table says.
    pub fn minimal_letterhead_lines(&self) -> Vec<String> {
        let mut out = Vec::new();
        let name = self.name.trim();
        if !name.is_empty() {
            out.push(name.to_string());
        }
        out.extend(self.minimal_address_lines());
        out
    }

    /// [`Self::minimal_letterhead_lines`] without the practice name (reports print it apart).
    pub fn minimal_address_lines(&self) -> Vec<String> {
        let mut out = self.address_lines();
        if let Some(t) = opt(&self.phone) {
            out.push(format!("{} {t}", header_label("phone")));
        }
        if let Some(t) = opt(&self.email) {
            out.push(t.to_string());
        }
        out
    }

    /// Minimal footer: practice name and address.
    pub fn minimal_footer_lines(&self, locale: &str) -> Vec<String> {
        footer_lines_for_practice(
            &PracticeFooter {
                practice_name: format!(
                    "{} · {}",
                    self.name.trim(),
                    self.address_lines().join(", ")
                ),
                tax_number: None,
                vat_id: None,
                iban: None,
                bic: None,
                bank_name: None,
                chamber: None,
            },
            locale,
        )
    }

    /// Signature block without professional numbers: name and title.
    pub fn minimal_signature_lines(&self) -> Vec<String> {
        let Some(name) = opt(&self.clinician_name) else {
            return Vec::new();
        };
        let mut v = vec![name.to_string()];
        if let Some(t) = opt(&self.professional_title) {
            v.push(t.to_string());
        }
        v
    }

    /// Footer of a prescription or certificate: practice, address and chamber only.
    pub fn clinical_footer_lines(&self, locale: &str) -> Vec<String> {
        footer_lines_for_practice(
            &PracticeFooter {
                practice_name: format!(
                    "{} · {}",
                    self.name.trim(),
                    self.address_lines().join(", ")
                ),
                tax_number: None,
                vat_id: None,
                iban: None,
                bic: None,
                bank_name: None,
                chamber: opt(&self.chamber).map(String::from),
            },
            locale,
        )
    }

    pub fn footer_lines(&self, locale: &str) -> Vec<String> {
        footer_lines_for_practice(
            &PracticeFooter {
                practice_name: format!(
                    "{} · {}",
                    self.name.trim(),
                    self.address_lines().join(", ")
                ),
                tax_number: opt(&self.tax_number).map(String::from),
                vat_id: opt(&self.vat_id).map(String::from),
                iban: opt(&self.bank_iban).map(String::from),
                bic: opt(&self.bank_bic).map(String::from),
                bank_name: opt(&self.bank_name).map(String::from),
                chamber: opt(&self.chamber).map(String::from),
            },
            locale,
        )
    }

    /// Signature block lines: name, title, ZANR/BSNR.
    pub fn signature_lines(&self) -> Vec<String> {
        let Some(name) = opt(&self.clinician_name) else {
            return Vec::new();
        };
        let own_id = if self.german_ids() {
            opt(&self.zanr)
        } else if self.is_morocco() {
            opt(&self.ma_inpe)
        } else if self.jurisdiction() == Some("fr") {
            opt(&self.fr_rpps)
        } else {
            None
        };
        self.signature_lines_for(name, opt(&self.professional_title), own_id)
    }

    /// Signature block of a given doctor (§5.1): their name, title and own professional id
    /// (ZANR in Germany, INPE in Morocco, RPPS in France); the practice's BSNR stays.
    pub fn signature_lines_for(
        &self,
        name: &str,
        title: Option<&str>,
        professional_id: Option<&str>,
    ) -> Vec<String> {
        let name = name.trim();
        if name.is_empty() {
            return Vec::new();
        }
        let mut v = vec![name.to_string()];
        if let Some(t) = title.map(str::trim).filter(|t| !t.is_empty()) {
            v.push(t.to_string());
        }
        let pid = professional_id.map(str::trim).filter(|p| !p.is_empty());
        let ids: Vec<String> = if self.german_ids() {
            vec![
                pid.map(|z| format!("ZANR {z}")),
                opt(&self.bsnr).map(|b| format!("BSNR {b}")),
            ]
        } else if self.is_morocco() {
            vec![pid.map(|i| format!("INPE {i}"))]
        } else if self.jurisdiction() == Some("fr") {
            vec![pid.map(|r| format!("RPPS {r}"))]
        } else {
            Vec::new()
        }
        .into_iter()
        .flatten()
        .collect();
        if !ids.is_empty() {
            v.push(ids.join(" · "));
        }
        v
    }

    pub fn payment_terms_text(&self) -> String {
        self.payment_terms_text_for("de")
    }

    /// Default payment-terms line in the document language.
    pub fn payment_terms_text_for(&self, locale: &str) -> String {
        let days = self.payment_terms_days.unwrap_or(14).max(1).to_string();
        crate::infrastructure::pdf::i18n::trf(locale, "invoice.payment_terms", &[("days", &days)])
    }

    /// Jurisdiction for legal wording: the chosen country, else Morocco for MAD practices,
    /// else unknown (the document language decides).
    pub fn jurisdiction(&self) -> Option<&'static str> {
        match opt(&self.country).map(|c| c.to_ascii_uppercase()) {
            Some(c) if c == "MA" => Some("ma"),
            Some(c) if c == "DE" => Some("de"),
            Some(c) if c == "FR" => Some("fr"),
            Some(c) if c == "EU" => Some("eu"),
            _ if self.is_morocco() => Some("ma"),
            _ => None,
        }
    }

    /// ZANR / BSNR / KZV / Steuer-Nr. are printed (Germany, or no country on a euro practice).
    pub fn german_ids(&self) -> bool {
        uses_german_ids(opt(&self.country), opt(&self.currency))
    }

    /// Practices billing in dirhams get the Moroccan invoice (CGI art. 145) instead of the GOZ one.
    pub fn is_morocco(&self) -> bool {
        let country_ma = opt(&self.country).is_some_and(|c| c.eq_ignore_ascii_case("MA"));
        country_ma
            || self
                .currency
                .as_deref()
                .map(str::trim)
                .is_some_and(|c| c.eq_ignore_ascii_case("MAD"))
    }

    pub fn morocco_ids(&self) -> crate::infrastructure::pdf::MoroccoIds {
        crate::infrastructure::pdf::MoroccoIds {
            ice: opt(&self.ma_ice).map(String::from),
            if_number: opt(&self.ma_if).map(String::from),
            tp: opt(&self.ma_tp).map(String::from),
            rc: opt(&self.ma_rc).map(String::from),
            cnss: opt(&self.ma_cnss).map(String::from),
            inpe: opt(&self.ma_inpe).map(String::from),
        }
    }

    pub fn vat_notice(&self) -> String {
        self.vat_notice_for("de")
    }

    /// VAT notice in the document language. The default notice was stored
    /// in whatever UI language Settings was first opened in and then printed
    /// on every document; it now follows the document. A notice the practice
    /// typed itself is kept as written.
    pub fn vat_notice_for(&self, locale: &str) -> String {
        localized_vat_notice(opt(&self.vat_exemption_notice).unwrap_or(""), locale)
    }
}
