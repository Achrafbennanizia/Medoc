//! PDF layout of a payment reminder (split from `receivables.rs`).

use super::*;

pub(super) fn reminder_title(level: i64) -> &'static str {
    match level {
        1 => "ZAHLUNGSERINNERUNG",
        2 => "1. MAHNUNG",
        _ => "2. MAHNUNG",
    }
}

pub(super) fn reminder_layout(
    profile: &PracticeProfile,
    inv: &Invoice,
    row: &InvoiceStatusRow,
    level: i64,
    number: Option<&str>,
    fee: i64,
    pay_by: &str,
) -> Value {
    let today = Local::now().format("%d.%m.%Y").to_string();
    // The registry number is printed by the layout from `documentNumber`.
    let mut meta = vec![json!({"label": "Datum", "value": today})];
    meta.push(json!({"label": "Zu Rechnung", "value": row.document_number}));
    let intro = match level {
        1 => format!(
            "sicher ist Ihnen im Alltag entgangen, dass unsere Rechnung {} vom {} noch nicht vollständig beglichen ist. \
             Bitte überweisen Sie den offenen Betrag bis zum {}.",
            row.document_number, super::super::format_dmy(&row.date), super::super::format_dmy(pay_by)
        ),
        2 => format!(
            "leider konnten wir zu unserer Rechnung {} vom {} trotz unserer Zahlungserinnerung keinen vollständigen \
             Zahlungseingang feststellen. Sie befinden sich mit der Zahlung in Verzug (§ 286 BGB). \
             Bitte überweisen Sie den offenen Betrag bis zum {}.",
            row.document_number, super::super::format_dmy(&row.date), super::super::format_dmy(pay_by)
        ),
        _ => format!(
            "trotz Zahlungserinnerung und Mahnung ist unsere Rechnung {} vom {} weiterhin offen. \
             Wir bitten Sie letztmalig, den offenen Betrag bis zum {} zu überweisen. \
             Nach Ablauf dieser Frist werden wir die Forderung ohne weitere Ankündigung gerichtlich \
             oder durch ein Inkassounternehmen geltend machen; die dadurch entstehenden Kosten gehen zu Ihren Lasten.",
            row.document_number, super::super::format_dmy(&row.date), super::super::format_dmy(pay_by)
        ),
    };
    let mut totals = vec![
        json!({"label": "Rechnungsbetrag", "value": fmt_eur(row.total_cents)}),
        json!({"label": "Bereits gezahlt", "value": fmt_eur(row.paid_cents)}),
        json!({"label": "Offener Betrag", "value": fmt_eur(row.open_cents)}),
    ];
    if fee > 0 {
        totals.push(json!({"label": "Mahngebühr", "value": fmt_eur(fee)}));
    }
    totals
        .push(json!({"label": "Zu zahlen", "value": fmt_eur(row.open_cents + fee), "total": true}));
    let mut closing = vec![];
    let bank = profile.bank_lines();
    if !bank.is_empty() {
        closing.push(format!(
            "Bankverbindung: {}. Verwendungszweck: {}",
            bank.join(" · "),
            row.document_number
        ));
    }
    closing.push(
        "Sollten Sie den Betrag in den letzten Tagen bereits überwiesen haben, betrachten Sie dieses Schreiben bitte als gegenstandslos."
            .into(),
    );
    closing
        .push("Bei Fragen zur Rechnung erreichen Sie uns gern telefonisch oder per E-Mail.".into());
    let mut address = vec![inv.recipient_name.clone()];
    address.extend(inv.recipient_address.iter().cloned());
    json!({
        "kind": "reminder",
        "practiceLines": profile.minimal_letterhead_lines(),
        "footerLines": profile.minimal_footer_lines("de"),
        "addressLines": address,
        "documentTitle": reminder_title(level),
        "documentNumber": number,
        "metaLines": meta,
        "introParagraphs": ["Sehr geehrte Damen und Herren,", intro],
        "tables": [{
            "title": "Offene Rechnung",
            "headers": ["Rechnung", "Rechnungsdatum", "Fällig seit", "Behandelte Person", "Offen"],
            "rows": [[
                row.document_number,
                super::super::format_dmy(&row.date),
                row.due_date.as_deref().map(super::super::format_dmy).unwrap_or_default(),
                row.patient_name,
                fmt_eur(row.open_cents),
            ]]
        }],
        "totals": totals,
        "closingParagraphs": closing,
        "signatureLines": profile.minimal_signature_lines(),
        "locale": "de",
    })
}
