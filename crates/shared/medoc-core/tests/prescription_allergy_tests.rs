//! A prescription whose active substance matches a recorded allergy is refused with
//! `error.prescription.allergy_conflict` until the doctor confirms it.

use chrono::NaiveDate;
use medoc_core::application::prescription_allergy_check::{
    check_prescription_allergies, ALLERGY_CONFLICT_KEY,
};
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Sex;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection;
use medoc_core::infrastructure::database::repos::clinical::patient as patient_repo;
use sqlx::SqlitePool;

async fn patient_with_allergies(answers: &str) -> (SqlitePool, String) {
    let pool = connection::test_memory_pool().await.expect("memory pool");
    connection::run_migrations(&pool).await.expect("migrations");
    let p = patient_repo::create(
        &pool,
        &CreatePatient {
            name: "Allergy Test".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1980, 5, 1).unwrap(),
            sex: Sex::Female,
            insurance_number: "V-ALLERGY".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    sqlx::query("UPDATE anamnesis_form SET answers = ?1 WHERE patient_id = ?2")
        .bind(answers)
        .bind(&p.id)
        .execute(&pool)
        .await
        .unwrap();
    (pool, p.id)
}

#[tokio::test]
async fn matching_substance_is_refused_until_confirmed() {
    let (pool, pid) =
        patient_with_allergies(r#"{"version":1,"allergies":{"medications":"Penicillin"}}"#).await;

    let err = check_prescription_allergies(&pool, &pid, "Amoxi 1000", Some("Amoxicillin"), false)
        .await
        .expect_err("allergy conflict");
    match err {
        AppError::ValidationCode(code) => {
            assert!(code.starts_with(ALLERGY_CONFLICT_KEY), "{code}");
            assert!(code.contains("substance=Amoxicillin"), "{code}");
            assert!(code.contains("allergen=Penicillin"), "{code}");
        }
        other => panic!("unexpected {other:?}"),
    }

    let confirmed =
        check_prescription_allergies(&pool, &pid, "Amoxi 1000", Some("Amoxicillin"), true)
            .await
            .expect("confirmed");
    assert!(confirmed.is_some());
}

#[tokio::test]
async fn medication_name_is_compared_when_no_substance_given() {
    let (pool, pid) = patient_with_allergies(r#"{"allergies":"Ibuprofen"}"#).await;
    assert!(
        check_prescription_allergies(&pool, &pid, "Ibuprofen 600", None, false)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn unrelated_substance_or_no_allergy_passes() {
    let (pool, pid) = patient_with_allergies(r#"{"allergies":{"medications":"Penicillin"}}"#).await;
    let ok =
        check_prescription_allergies(&pool, &pid, "Paracetamol 500", Some("Paracetamol"), false)
            .await
            .expect("no conflict");
    assert!(ok.is_none());

    let (pool, pid) = patient_with_allergies(r#"{"allergies":{"medications":"None known"}}"#).await;
    assert!(
        check_prescription_allergies(&pool, &pid, "Amoxicillin", None, false)
            .await
            .unwrap()
            .is_none()
    );
}
