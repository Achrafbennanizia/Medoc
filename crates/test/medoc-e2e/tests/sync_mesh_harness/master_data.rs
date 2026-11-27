//! Master data and documents reaching replica B.

use super::*;

#[tokio::test]
pub(super) async fn absence_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::practice::master_data::create_absence(
        &mesh.replica_a,
        &medoc_core::infrastructure::database::repos::practice::master_data::CreateAbsence {
            kind: "VACATION".into(),
            comment: None,
            from_day: "2099-01-01".into(),
            to_day: "2099-01-05".into(),
            from_time: None,
            to_time: None,
        },
    )
    .await
    .expect("absence");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "absence" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(count_id(&mesh.replica_b, "absence", &row.id).await, 1);
}

#[tokio::test]
pub(super) async fn catalog_item_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row =
        medoc_core::infrastructure::database::repos::practice::master_data::create_treatment_catalog_item(
            &mesh.replica_a,
            &medoc_core::infrastructure::database::repos::practice::master_data::CreateTreatmentCatalogItem {
                category: "Fill".into(),
                name: "Mesh Catalog".into(),
                default_cost: Some(10.0),
                sort_order: None,
            },
        )
        .await
        .expect("catalog");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "treatment_catalog" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "treatment_catalog", &row.id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn document_template_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::practice::master_data::create_document_template(
        &mesh.replica_a,
        &medoc_core::infrastructure::database::repos::practice::master_data::CreateDocumentTemplate {
            kind: "PRESCRIPTION".into(),
            title: "Mesh Rx".into(),
            payload: serde_json::json!({}),
        },
    )
    .await
    .expect("template");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "document_template" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "document_template", &row.id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn supplier_master_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::practice::master_data::create_supplier_master(
        &mesh.replica_a,
        &medoc_core::infrastructure::database::repos::practice::master_data::CreateSupplierMaster {
            name: "Mesh Supplier".into(),
            sort_order: None,
        },
    )
    .await
    .expect("supplier");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "supplier_master" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "supplier_master", &row.id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn product_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::practice::product::create(
        &mesh.replica_a,
        &medoc_core::domain::entities::product::CreateProduct {
            name: "Mesh Product".into(),
            description: None,
            category: "lab".into(),
            price: 3.5,
            stock: 1,
            min_stock: 0,
        },
    )
    .await
    .expect("product");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "product" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(count_id(&mesh.replica_b, "product", &row.id).await, 1);
}

#[tokio::test]
pub(super) async fn purchase_order_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::practice::purchase_order::create(
        &mesh.replica_a,
        &medoc_core::domain::entities::purchase_order::CreatePurchaseOrder {
            supplier: "Acme".into(),
            item: "Gloves".into(),
            expected_on: None,
            quantity: 2,
            unit: Some("box".into()),
            remark: None,
            order_number: Some("B-2099-01-0001".into()),
            pharma_consultant: None,
            total_amount: Some(4.0),
        },
        "mesh-user",
    )
    .await
    .expect("po");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "purchase_order" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "purchase_order", &row.id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn contract_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let id = uuid::Uuid::new_v4().to_string();
    medoc_core::infrastructure::database::repos::billing::contract::upsert(
        &mesh.replica_a,
        &medoc_core::infrastructure::database::repos::billing::contract::ContractRow {
            id: id.clone(),
            designation: "Lease".into(),
            partner: "Lessor".into(),
            amount: 100.0,
            interval: "MONTH".into(),
            unlimited: 0,
            period_from: None,
            period_until: None,
            created_at: "2099-01-01T00:00:00Z".into(),
            document_path: None,
            active: 1,
            deactivated_at: None,
        },
    )
    .await
    .expect("contract");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "contract" && e.entity_id == id),
        "{entries:?}"
    );
    assert_eq!(count_id(&mesh.replica_b, "contract", &id).await, 1);
}

#[tokio::test]
pub(super) async fn day_close_protocol_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::billing::day_close_protocol::create(
        &mesh.replica_a,
        &medoc_core::domain::entities::day_close_protocol::CreateDayCloseProtocol {
            as_of_date: "2099-01-02".into(),
            counted_eur: Some(10.0),
            system_cash_eur: 10.0,
            system_income_eur: 10.0,
            variance_eur: Some(0.0),
            cash_matches: 1,
            day_payment_count: 1,
            cash_verified_count: 1,
            all_payments_verified: 1,
            note: None,
        },
    )
    .await
    .expect("day close");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "day_close_protocol" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "day_close_protocol", &row.id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn balance_sheet_snapshot_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let row = medoc_core::infrastructure::database::repos::billing::balance_sheet_snapshot::create(
        &mesh.replica_a,
        &medoc_core::domain::entities::balance_sheet_snapshot::CreateBalanceSheetSnapshot {
            period: "2099-01".into(),
            kind: "MONTH".into(),
            label: "Mesh close".into(),
            income_cents: 100,
            expenses_cents: 40,
            payload: serde_json::json!({}),
            locale: None,
        },
        "mesh-user",
    )
    .await
    .expect("balance");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "balance_sheet_snapshot" && e.entity_id == row.id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "balance_sheet_snapshot", &row.id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn invoice_document_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let patient = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Invoice Mesh".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
            sex: Sex::Male,
            insurance_number: "INV-MESH".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    let doc_id = uuid::Uuid::new_v4().to_string();
    medoc_core::infrastructure::database::repos::billing::invoice_document::insert_with_audit_trail(
        &mesh.replica_a,
        &medoc_core::infrastructure::database::repos::billing::invoice_document::InvoiceDocumentRow {
            id: doc_id.clone(),
            patient_id: patient.id.clone(),
            document_number: "RE-MESH-1".into(),
            payload_json: "{}".into(),
            total_cents: 1200,
            created_at: "2099-01-01T00:00:00Z".into(),
            created_by: "mesh-user".into(),
        },
        "excerpt",
    )
    .await
    .expect("invoice");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "invoice_document" && e.entity_id == doc_id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "invoice_document", &doc_id).await,
        1
    );
}

#[tokio::test]
pub(super) async fn work_time_session_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let staff_id = shared_staff_id(&mesh.replica_a).await;
    assert_eq!(staff_id, shared_staff_id(&mesh.replica_b).await);
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO work_time_session (id, staff_id, started_at, status, auto_recorded, pause_minutes)
         VALUES (?1, ?2, '2099-01-01T08:00:00Z', 'RUNNING', 0, 0)",
    )
    .bind(&id)
    .bind(&staff_id)
    .execute(&mesh.replica_a)
    .await
    .expect("session");
    medoc_core::infrastructure::database::sync_outbox::record_or_noop(
        &mesh.replica_a,
        "work_time_session",
        &id,
        "INSERT",
        &format!(r#"{{"id":"{id}","staff_id":"{staff_id}","status":"RUNNING"}}"#),
    )
    .await
    .expect("outbox");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "work_time_session" && e.entity_id == id),
        "{entries:?}"
    );
    assert_eq!(count_id(&mesh.replica_b, "work_time_session", &id).await, 1);
}

#[tokio::test]
pub(super) async fn sick_leave_certificate_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let staff_id = shared_staff_id(&mesh.replica_a).await;
    assert_eq!(staff_id, shared_staff_id(&mesh.replica_b).await);
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sick_leave_certificate
         (id, staff_id, note, document_ref, date_from, status, created_by, created_at)
         VALUES (?1, ?2, 'flu', 'doc-1', '2099-02-01', 'ACTIVE', ?2, '2099-02-01T00:00:00Z')",
    )
    .bind(&id)
    .bind(&staff_id)
    .execute(&mesh.replica_a)
    .await
    .expect("sick leave");
    medoc_core::infrastructure::database::sync_outbox::record_or_noop(
        &mesh.replica_a,
        "sick_leave_certificate",
        &id,
        "INSERT",
        &format!(r#"{{"id":"{id}","staff_id":"{staff_id}"}}"#),
    )
    .await
    .expect("outbox");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "sick_leave_certificate" && e.entity_id == id),
        "{entries:?}"
    );
    assert_eq!(
        count_id(&mesh.replica_b, "sick_leave_certificate", &id).await,
        1
    );
}
