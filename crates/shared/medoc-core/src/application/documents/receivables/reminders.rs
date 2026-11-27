//! Payment reminders: layout, issuing, listing and copies.

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

/// Issue (or preview) the next reminder for an overdue invoice.
pub async fn issue_reminder(
    pool: &SqlitePool,
    session: &Session,
    args: ReminderArgs,
) -> Result<IssuedPdf, AppError> {
    require_permission(
        session,
        if args.preview {
            "billing.read"
        } else {
            "billing.create"
        },
    )?;
    finance_schema::ensure(pool).await?;
    let row = invoice_status(pool, session, &args.invoice_document_id).await?;
    if row.kind != "INVOICE" || row.status != "ISSUED" {
        return Err(AppError::validation_code("error.reminder.not_remindable"));
    }
    let level = row
        .next_reminder_level
        .ok_or_else(|| AppError::validation_code("error.reminder.not_due"))?;
    if args.fee_cents < 0 || (args.fee_cents > 0 && level < 2) {
        // A fee needs default (Verzug); the first reminder establishes it.
        return Err(AppError::validation_code("error.reminder.fee_not_allowed"));
    }
    let days = args.days.unwrap_or(DEFAULT_REMINDER_DAYS).clamp(7, 30);
    let pay_by = (today() + chrono::Duration::days(days))
        .format("%Y-%m-%d")
        .to_string();
    let inv: Invoice = serde_json::from_value(row.invoice.clone()).unwrap_or_default();
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    let logo = practice_logo(pool).await;

    let render = |v: &Value| -> Result<Vec<u8>, AppError> {
        let layout: ClinicalPdfLayout = serde_json::from_value(v.clone())
            .map_err(|e| AppError::Internal(format!("reminder layout: {e}")))?;
        render_clinical_layout_with_logo(&layout, logo.as_ref())
    };

    if args.preview {
        let mut v = reminder_layout(&profile, &inv, &row, level, None, args.fee_cents, &pay_by);
        v["watermark"] = Value::String(WATERMARK_PREVIEW.into());
        let bytes = render(&v)?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: sha256_hex(&bytes),
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        });
    }

    repo::ensure_numbering_authority(pool).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut conn_guard = pool.acquire().await?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *conn_guard)
        .await?;
    let result: Result<(String, Vec<u8>, String), AppError> = async {
        let conn: &mut SqliteConnection = &mut conn_guard;
        // Re-check inside the lock: two clicks must not send two reminders.
        let existing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM payment_reminder WHERE invoice_document_id = ?1 AND level >= ?2",
        )
        .bind(&row.document_id)
        .bind(level)
        .fetch_one(&mut *conn)
        .await?;
        if existing > 0 {
            return Err(AppError::validation_code("error.reminder.not_due"));
        }
        let number = repo::next_number(conn, reminder_prefix(profile.jurisdiction()), year_now()).await?;
        let v = reminder_layout(&profile, &inv, &row, level, Some(&number), args.fee_cents, &pay_by);
        // The reminder PDF carries `payment_reminder.id` as its document id.
        let bytes = crate::infrastructure::pdf::with_document_uid(&id, || render(&v))?;
        let sha = sha256_hex(&bytes);
        sqlx::query(
            "INSERT INTO payment_reminder (id, invoice_document_id, invoice_number, patient_id, level,
                document_number, open_cents, fee_cents, pay_by, sha256, payload_json, issued_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        )
        .bind(&id)
        .bind(&row.document_id)
        .bind(&row.document_number)
        .bind(&row.patient_id)
        .bind(level)
        .bind(&number)
        .bind(row.open_cents)
        .bind(args.fee_cents)
        .bind(&pay_by)
        .bind(&sha)
        .bind(v.to_string())
        .bind(&session.user_id)
        .execute(&mut *conn)
        .await?;
        Ok((number, bytes, sha))
    }
    .await;
    let (number, bytes, sha) = match result {
        Ok(v) => {
            sqlx::query("COMMIT").execute(&mut *conn_guard).await?;
            v
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *conn_guard).await;
            return Err(e);
        }
    };
    drop(conn_guard);
    if let Err(e) = crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "payment_reminder",
        &id,
        "INSERT",
        "",
    )
    .await
    {
        tracing::warn!(event = "PAYMENT_REMINDER_OUTBOX_FAILED", error = %e);
    }
    let _ = audit_repo::create(
        pool,
        &session.user_id,
        "ISSUE_DOCUMENT",
        "PAYMENT_REMINDER",
        Some(&id),
        Some(&format!(
            "nr={number} invoice={} level={level} open={} sha256={sha}",
            row.document_number, row.open_cents
        )),
    )
    .await;
    Ok(IssuedPdf {
        document_id: Some(id),
        document_number: Some(number),
        sha256: sha,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ReminderRow {
    pub id: String,
    pub invoice_document_id: String,
    pub invoice_number: String,
    pub level: i64,
    pub document_number: String,
    pub open_cents: i64,
    pub fee_cents: i64,
    pub pay_by: String,
    pub issued_by: String,
    pub issued_at: String,
}

pub async fn list_reminders(
    pool: &SqlitePool,
    session: &Session,
    invoice_document_id: &str,
) -> Result<Vec<ReminderRow>, AppError> {
    require_permission(session, "billing.read")?;
    finance_schema::ensure(pool).await?;
    Ok(sqlx::query_as::<_, ReminderRow>(
        "SELECT id, invoice_document_id, invoice_number, level, document_number, open_cents, fee_cents,
                pay_by, issued_by, issued_at
           FROM payment_reminder WHERE invoice_document_id = ?1 ORDER BY level",
    )
    .bind(invoice_document_id)
    .fetch_all(pool)
    .await?)
}

/// Print a reminder again ("KOPIE").
pub async fn reminder_copy(
    pool: &SqlitePool,
    session: &Session,
    reminder_id: &str,
) -> Result<IssuedPdf, AppError> {
    require_permission(session, "billing.read")?;
    finance_schema::ensure(pool).await?;
    let (number, payload): (String, String) =
        sqlx::query_as("SELECT document_number, payload_json FROM payment_reminder WHERE id = ?1")
            .bind(reminder_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Reminder".into()))?;
    let mut v: Value =
        serde_json::from_str(&payload).map_err(|e| AppError::Internal(e.to_string()))?;
    v["watermark"] = Value::String(WATERMARK_COPY.into());
    let layout: ClinicalPdfLayout =
        serde_json::from_value(v).map_err(|e| AppError::Internal(e.to_string()))?;
    let bytes = render_clinical_layout_with_logo(&layout, practice_logo(pool).await.as_ref())?;
    Ok(IssuedPdf {
        document_id: Some(reminder_id.to_string()),
        document_number: Some(number),
        sha256: sha256_hex(&bytes),
        pdf_base64: STANDARD.encode(&bytes),
        reprint: true,
    })
}
