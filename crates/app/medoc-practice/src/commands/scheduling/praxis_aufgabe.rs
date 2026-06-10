//! FA-AUFG-01..06 — Praxis-Aufgaben (bidirektional, Statusmaschine).
use crate::application::auth_service::Session;
use crate::application::rbac::{self, effective_allowed, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::praxis_aufgabe::{
    AddPraxisAufgabeKommentarArgs, CreatePraxisAufgabe, PraxisAufgabe, PraxisAufgabeKommentar,
    TransitionPraxisAufgabeArgs, UpdatePraxisAufgabeAdmin,
};
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::{
    audit_repo, patient_repo, personal_repo, praxis_aufgabe_repo,
};
use sqlx::SqlitePool;
use tauri::State;

const AUFGABE_TYPS: &[&str] = &["ABRECHNUNG", "TERMIN", "DRUCK", "STAMMDATEN", "SONSTIGES"];

/// Posteingang visibility or Praxis-Aufgaben admin (`verwaltung.read`).
fn assert_aufgabe_readable(
    session: &Session,
    role: Role,
    a: &PraxisAufgabe,
) -> Result<(), AppError> {
    if effective_allowed("verwaltung.read", role, &session.permission_overrides) {
        return Ok(());
    }
    crate::domain::services::aufgabe_visibility::assert_user_can_view_aufgabe(
        a,
        &session.user_id,
        role,
    )
}

fn normalize_patient_id(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn normalize_typ(raw: &str) -> Result<String, AppError> {
    let t = raw.trim().to_uppercase();
    if AUFGABE_TYPS.iter().any(|x| *x == t) {
        Ok(t)
    } else {
        Err(AppError::Validation(format!(
            "Unbekannter Aufgabentyp: {t} (erlaubt: {})",
            AUFGABE_TYPS.join(", ")
        )))
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_praxis_aufgabe(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePraxisAufgabe,
) -> Result<PraxisAufgabe, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    let titel = data.titel.trim().to_string();
    if titel.is_empty() {
        return Err(AppError::Validation("Titel darf nicht leer sein.".into()));
    }
    let patient_id = normalize_patient_id(data.patient_id.as_deref());
    let pid = patient_id
        .as_deref()
        .ok_or_else(|| AppError::Validation("Patient erforderlich.".into()))?;
    patient_repo::find_by_id(&pool, pid)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;

    let mut payload = data;
    payload.patient_id = patient_id;
    payload.typ = normalize_typ(&payload.typ)?;
    payload.titel = titel;

    match role {
        Role::Arzt => {
            if let Some(rid) = payload
                .assignee_user_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                let rez = personal_repo::find_by_id(&pool, rid)
                    .await?
                    .ok_or(AppError::NotFound("Personal".into()))?;
                if !rez.rolle.eq_ignore_ascii_case("REZEPTION") {
                    return Err(AppError::Validation(
                        "Ziel muss ein Rezeptions-Mitarbeiter sein.".into(),
                    ));
                }
                payload.assignee_role = None;
            } else {
                payload.assignee_role = Some("REZEPTION".into());
                payload.assignee_user_id = None;
            }
        }
        Role::Rezeption => {
            let aid = payload
                .assignee_user_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    AppError::Validation("Bitte Ziel-Arzt (assigneeUserId) angeben.".into())
                })?;
            let arzt = personal_repo::find_by_id(&pool, aid)
                .await?
                .ok_or(AppError::NotFound("Arzt".into()))?;
            if !arzt.rolle.eq_ignore_ascii_case("ARZT") {
                return Err(AppError::Validation("Ziel muss ein Arzt sein.".into()));
            }
            payload.assignee_role = None;
        }
        _ => return Err(AppError::Unauthorized),
    }

    let a = praxis_aufgabe_repo::insert(&pool, &payload, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PraxisAufgabe",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_praxis_aufgaben_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    match role {
        Role::Rezeption => {
            praxis_aufgabe_repo::list_for_user(&pool, &session.user_id, true, 200).await
        }
        Role::Arzt => praxis_aufgabe_repo::list_for_user(&pool, &session.user_id, false, 200).await,
        _ => Err(AppError::Unauthorized),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn transition_praxis_aufgabe(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: TransitionPraxisAufgabeArgs,
) -> Result<PraxisAufgabe, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    let st = args.status.trim().to_uppercase();
    let current = praxis_aufgabe_repo::find_by_id(&pool, &args.id)
        .await?
        .ok_or(AppError::NotFound("Aufgabe".into()))?;

    let can_admin_status =
        effective_allowed("aufgabe.status.admin", role, &session.permission_overrides);
    if !can_admin_status {
        crate::domain::services::aufgabe_visibility::assert_user_can_view_aufgabe(
            &current,
            &session.user_id,
            role,
        )?;
    }

    let can_fulfill_status = effective_allowed(
        "aufgabe.status.fulfill",
        role,
        &session.permission_overrides,
    );

    workflow_transitions::praxis_aufgabe_status_transition(
        &current.status,
        &st,
        role,
        current.assignee_role.as_deref(),
        current.assignee_user_id.as_deref(),
        &current.created_by,
        &session.user_id,
        can_fulfill_status,
        can_admin_status,
    )?;

    if st == "ERLEDIGT_REZEPTION" {
        let has_note = args
            .erledigt_notiz
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty());
        let has_zahl = args
            .zahlung_id
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty());
        if !has_note && !has_zahl {
            return Err(AppError::Validation(
                "Kurznotiz oder Zahlungs-Verknüpfung erforderlich (FA-AUFG-04).".into(),
            ));
        }
    }
    if st == "ZURUECK" {
        let reason = args.zurueck_begruendung.as_deref().unwrap_or("").trim();
        if reason.is_empty() {
            return Err(AppError::Validation(
                "Begründung für Zurück an Rezeption ist Pflicht (FA-AUFG-05).".into(),
            ));
        }
    }

    let out = praxis_aufgabe_repo::update_status(
        &pool,
        &args.id,
        &st,
        args.erledigt_notiz.as_deref(),
        args.zahlung_id.as_deref(),
        args.zurueck_begruendung.as_deref(),
    )
    .await?;

    crate::application::praxis_aufgabe_notify::notify_creator_if_aufgabe_erledigt_by_other(
        &pool,
        &current,
        &out,
        &st,
        &session.user_id,
        args.erledigt_notiz.as_deref(),
    )
    .await?;
    crate::application::praxis_aufgabe_notify::notify_assignees_if_aufgabe_zurueck(
        &pool,
        &current,
        &out,
        &st,
        &session.user_id,
        args.zurueck_begruendung.as_deref(),
    )
    .await?;

    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PraxisAufgabe",
        Some(&args.id),
        Some(&st),
    )
    .await
    .ok();
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_open_praxis_aufgaben_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    match role {
        Role::Rezeption => {
            praxis_aufgabe_repo::count_open_for_user(&pool, &session.user_id, true).await
        }
        Role::Arzt => {
            praxis_aufgabe_repo::count_open_for_user(&pool, &session.user_id, false).await
        }
        _ => Ok(0),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_praxis_aufgaben_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    rbac::require(&session_state, "verwaltung.read")?;
    praxis_aufgabe_repo::list_all_admin(&pool, 500).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_praxis_aufgabe_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePraxisAufgabe,
) -> Result<PraxisAufgabe, AppError> {
    let session = rbac::require(&session_state, "verwaltung.read")?;
    let titel = data.titel.trim().to_string();
    if titel.is_empty() {
        return Err(AppError::Validation("Titel darf nicht leer sein.".into()));
    }
    let patient_id = normalize_patient_id(data.patient_id.as_deref());
    if let Some(pid) = patient_id.as_deref() {
        patient_repo::find_by_id(&pool, pid)
            .await?
            .ok_or(AppError::NotFound("Patient".into()))?;
    }

    let mut payload = data;
    payload.patient_id = patient_id;
    payload.typ = normalize_typ(&payload.typ)?;
    payload.titel = titel;
    if payload
        .assignee_role
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_none()
        && payload
            .assignee_user_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_none()
    {
        payload.assignee_role = Some("REZEPTION".into());
    }

    let a = praxis_aufgabe_repo::insert(&pool, &payload, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PraxisAufgabe",
        Some(&a.id),
        Some("admin"),
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patch))]
pub async fn update_praxis_aufgabe_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patch: UpdatePraxisAufgabeAdmin,
) -> Result<PraxisAufgabe, AppError> {
    let session = rbac::require(&session_state, "verwaltung.read")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if patch
        .titel
        .as_deref()
        .map(str::trim)
        .is_some_and(|s| s.is_empty())
    {
        return Err(AppError::Validation("Titel darf nicht leer sein.".into()));
    }
    if let Some(t) = patch.typ.as_deref() {
        normalize_typ(t)?;
    }
    if let Some(next_status) = patch.status.as_deref() {
        let current = praxis_aufgabe_repo::find_by_id(&pool, &patch.id)
            .await?
            .ok_or(AppError::NotFound("Aufgabe".into()))?;
        let st = next_status.trim().to_uppercase();
        if st != current.status.trim().to_uppercase()
            && !effective_allowed("aufgabe.status.admin", role, &session.permission_overrides)
        {
            return Err(AppError::Unauthorized);
        }
        if st != current.status.trim().to_uppercase() {
            workflow_transitions::praxis_aufgabe_admin_status_transition(&current.status, &st)?;
        }
    }
    let out = praxis_aufgabe_repo::update_admin(&pool, &patch).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PraxisAufgabe",
        Some(&patch.id),
        Some("admin"),
    )
    .await
    .ok();
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_praxis_aufgabe_kommentare(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    aufgabe_id: String,
) -> Result<Vec<PraxisAufgabeKommentar>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    let current = praxis_aufgabe_repo::find_by_id(&pool, &aufgabe_id)
        .await?
        .ok_or(AppError::NotFound("Aufgabe".into()))?;
    assert_aufgabe_readable(&session, role, &current)?;
    praxis_aufgabe_repo::list_kommentare(&pool, &aufgabe_id, 200).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn add_praxis_aufgabe_kommentar(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: AddPraxisAufgabeKommentarArgs,
) -> Result<PraxisAufgabeKommentar, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    let current = praxis_aufgabe_repo::find_by_id(&pool, &args.aufgabe_id)
        .await?
        .ok_or(AppError::NotFound("Aufgabe".into()))?;
    assert_aufgabe_readable(&session, role, &current)?;
    let out = praxis_aufgabe_repo::insert_kommentar(
        &pool,
        &args.aufgabe_id,
        &session.user_id,
        &args.body,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PraxisAufgabeKommentar",
        Some(&out.id),
        Some(&args.aufgabe_id),
    )
    .await
    .ok();
    Ok(out)
}

#[macro_export]
macro_rules! register_praxis_aufgabe_commands {
    ($register:ident) => {
        $register!(
            $crate::commands::praxis_aufgabe_commands::create_praxis_aufgabe,
            $crate::commands::praxis_aufgabe_commands::list_praxis_aufgaben_for_me,
            $crate::commands::praxis_aufgabe_commands::transition_praxis_aufgabe,
            $crate::commands::praxis_aufgabe_commands::count_open_praxis_aufgaben_for_me,
            $crate::commands::praxis_aufgabe_commands::list_praxis_aufgaben_admin,
            $crate::commands::praxis_aufgabe_commands::create_praxis_aufgabe_admin,
            $crate::commands::praxis_aufgabe_commands::update_praxis_aufgabe_admin,
            $crate::commands::praxis_aufgabe_commands::list_praxis_aufgabe_kommentare,
            $crate::commands::praxis_aufgabe_commands::add_praxis_aufgabe_kommentar,
        );
    };
}
