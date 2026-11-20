//! Access profiles: what a staff member may do, area by area.
//!
//! The model follows role-based access control with per-user grants
//! (NIST RBAC, ISO/IEC 27002 §5.15 / §8.2), applying least privilege:
//!
//! - an **area** is one part of the practice (calendar, cash desk, billing …);
//! - a **level** says how much a person may do in that area. Levels are
//!   cumulative, CRUD style:
//!   `None` < `View` (read) < `Edit` (read + update existing records)
//!   < `Create` (read + create + update) < `Full` (everything, including
//!   delete, cancel, void, day close and export);
//! - a **template** is a predefined profile for a common job (front desk,
//!   cashier, scheduler …). The admin picks one and may raise or lower
//!   single areas for one person;
//! - a **ceiling** caps what a login role may ever receive, whatever the
//!   admin picks. A reception login never reaches clinical write access or
//!   account administration.
//!
//! Every permission string the code checks (`cash.create`, `finance.write`,
//! `appointment.read` …) is described by an [`ActionRule`]: the area level it
//! needs. A person's levels are compiled into explicit ALLOW/DENY entries, so
//! every existing `effective_allowed(action, role, overrides)` call site
//! enforces the profile without being rewritten.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::domain::rbac::{PermissionOverride, Role};

// ---------------------------------------------------------------------------
// Areas and levels
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Area {
    /// Patient master data: name, contact, insurance, consent flags.
    Patients,
    /// Clinical record: chart, findings, treatments, prescriptions, certificates.
    MedicalRecord,
    /// Files attached to a patient (scans, letters, X-ray exports).
    PatientDocuments,
    /// Appointments, waiting list, calendar workflows.
    Calendar,
    /// Cash register: payments taken, cash movements, day close (Kassenbuch).
    CashDesk,
    /// Invoices, reminders, credit notes and cancellations.
    Billing,
    /// Finance overview, period reports, statistics.
    FinanceReports,
    /// Products, suppliers, purchase orders.
    Inventory,
    /// Practice tasks, tickets, notifications.
    Tasks,
    /// Team: work plans, absences, accounts and access rights.
    Staff,
    /// Practice settings and system operations (network, pairing, licence).
    Settings,
    /// Audit trail.
    Audit,
}

impl Area {
    pub const ALL: [Area; 12] = [
        Area::Patients,
        Area::MedicalRecord,
        Area::PatientDocuments,
        Area::Calendar,
        Area::CashDesk,
        Area::Billing,
        Area::FinanceReports,
        Area::Inventory,
        Area::Tasks,
        Area::Staff,
        Area::Settings,
        Area::Audit,
    ];

    pub fn wire(self) -> &'static str {
        match self {
            Area::Patients => "patients",
            Area::MedicalRecord => "medical_record",
            Area::PatientDocuments => "patient_documents",
            Area::Calendar => "calendar",
            Area::CashDesk => "cash_desk",
            Area::Billing => "billing",
            Area::FinanceReports => "finance_reports",
            Area::Inventory => "inventory",
            Area::Tasks => "tasks",
            Area::Staff => "staff",
            Area::Settings => "settings",
            Area::Audit => "audit",
        }
    }

    pub fn parse(raw: &str) -> Option<Area> {
        let raw = raw.trim();
        Area::ALL.into_iter().find(|a| a.wire() == raw)
    }

    pub fn label(self) -> &'static str {
        match self {
            Area::Patients => "Patients (master data)",
            Area::MedicalRecord => "Medical record",
            Area::PatientDocuments => "Patient documents",
            Area::Calendar => "Calendar",
            Area::CashDesk => "Cash desk",
            Area::Billing => "Billing",
            Area::FinanceReports => "Finance reports",
            Area::Inventory => "Inventory & orders",
            Area::Tasks => "Tasks",
            Area::Staff => "Team",
            Area::Settings => "Settings",
            Area::Audit => "Audit trail",
        }
    }
}

#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
#[serde(rename_all = "snake_case")]
pub enum Level {
    #[default]
    None,
    /// Read only.
    View,
    /// Read and update existing records.
    Edit,
    /// Read, create and update.
    Create,
    /// Everything, including delete, cancel, void, close and export.
    Full,
}

impl Level {
    pub const ALL: [Level; 5] = [
        Level::None,
        Level::View,
        Level::Edit,
        Level::Create,
        Level::Full,
    ];

    pub fn wire(self) -> &'static str {
        match self {
            Level::None => "none",
            Level::View => "view",
            Level::Edit => "edit",
            Level::Create => "create",
            Level::Full => "full",
        }
    }

    pub fn parse(raw: &str) -> Option<Level> {
        let raw = raw.trim().to_ascii_lowercase();
        Level::ALL.into_iter().find(|l| l.wire() == raw)
    }

    pub fn label(self) -> &'static str {
        match self {
            Level::None => "No access",
            Level::View => "Read only",
            Level::Edit => "Read and update",
            Level::Create => "Read, create and update",
            Level::Full => "Full access (incl. delete / cancel / close)",
        }
    }

    pub fn allows(self, needed: Level) -> bool {
        self >= needed
    }
}

/// Level per area. A missing area means [`Level::None`].
pub type Levels = BTreeMap<Area, Level>;

pub fn level_of(levels: &Levels, area: Area) -> Level {
    levels.get(&area).copied().unwrap_or(Level::None)
}

fn levels_from(pairs: &[(Area, Level)]) -> Levels {
    let mut out: Levels = Area::ALL.into_iter().map(|a| (a, Level::None)).collect();
    for (area, level) in pairs {
        out.insert(*area, *level);
    }
    out
}

// ---------------------------------------------------------------------------
// Role ceilings
// ---------------------------------------------------------------------------

/// Highest level a login role may hold in an area, whatever the profile says.
///
/// Reception: clinical documentation stays read-only (it is the dentist's
/// record), team administration stops at work plans and absences (no
/// accounts, no access rights), settings stop short of system operations
/// (network, pairing, licence), and the audit trail is read-only.
pub fn ceiling(role: Role, area: Area) -> Level {
    use Area::*;
    match role {
        Role::Physician => Level::Full,
        Role::Reception => match area {
            MedicalRecord => Level::View,
            Staff => Level::Edit,
            Settings => Level::Edit,
            Audit => Level::View,
            _ => Level::Full,
        },
        // Deferred personae: read-only in their own field, nothing else.
        Role::TaxAdvisor => match area {
            FinanceReports | Billing | CashDesk => Level::View,
            _ => Level::None,
        },
        Role::PharmaConsultant => match area {
            Inventory => Level::View,
            _ => Level::None,
        },
    }
}

pub fn clamp_to_ceiling(role: Role, levels: &mut Levels) {
    for area in Area::ALL {
        let cap = ceiling(role, area);
        let entry = levels.entry(area).or_insert(Level::None);
        if *entry > cap {
            *entry = cap;
        }
    }
}

// ---------------------------------------------------------------------------
// Predefined templates
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub struct Template {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    /// Login role the template is made for. It cannot be given to another role.
    pub base_role: Role,
    /// Areas not listed get [`Level::None`].
    pub levels: &'static [(Area, Level)],
}

impl Template {
    pub fn levels(&self) -> Levels {
        let mut out = levels_from(self.levels);
        clamp_to_ceiling(self.base_role, &mut out);
        out
    }
}

use Area as A;
use Level as L;

pub const TEMPLATES: &[Template] = &[
    // ---- Reception ---------------------------------------------------------
    Template {
        id: "reception.front_desk",
        label: "Front desk (all reception tasks)",
        description: "Registers patients, books appointments, takes payments, closes the \
                      day and issues invoices. Cannot cancel invoices or see clinical notes.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Full),
            (A::PatientDocuments, L::Create),
            (A::Calendar, L::Full),
            (A::CashDesk, L::Full),
            (A::Billing, L::Create),
            (A::Inventory, L::Create),
            (A::Tasks, L::Full),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.office_manager",
        label: "Office manager (everything a reception login may have)",
        description: "Every reception task plus invoice cancellation, finance reports, \
                      work plans and practice settings. Clinical record read-only.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Full),
            (A::MedicalRecord, L::View),
            (A::PatientDocuments, L::Full),
            (A::Calendar, L::Full),
            (A::CashDesk, L::Full),
            (A::Billing, L::Full),
            (A::FinanceReports, L::Full),
            (A::Inventory, L::Full),
            (A::Tasks, L::Full),
            (A::Staff, L::Edit),
            (A::Settings, L::Edit),
            (A::Audit, L::View),
        ],
    },
    Template {
        id: "reception.scheduler",
        label: "Scheduler (appointments & registration)",
        description: "Books, moves and cancels appointments and registers new patients. \
                      No cash desk, no billing.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Create),
            (A::PatientDocuments, L::View),
            (A::Calendar, L::Full),
            (A::Tasks, L::Create),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.cashier",
        label: "Cashier (cash desk)",
        description: "Takes payments, books and reverses cash movements, closes the day and \
                      issues invoices. Sees patients, issued documents and the calendar read-only.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::View),
            (A::PatientDocuments, L::View),
            (A::Calendar, L::View),
            (A::CashDesk, L::Full),
            (A::Billing, L::Create),
            (A::Tasks, L::Edit),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.calendar_cash",
        label: "Calendar + cash desk (limited patient access)",
        description: "Full calendar, cash desk read and update (corrections, no new \
                      bookings or reversals), patients read and update (no new patients, \
                      no deletion). Issued documents are read-only.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Edit),
            (A::PatientDocuments, L::View),
            (A::Calendar, L::Full),
            (A::CashDesk, L::Edit),
            (A::Tasks, L::Edit),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.billing",
        label: "Billing coordinator",
        description: "Invoices, reminders, cancellations and the cash desk, with finance \
                      reports read-only.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Edit),
            (A::PatientDocuments, L::View),
            (A::Calendar, L::View),
            (A::CashDesk, L::Full),
            (A::Billing, L::Full),
            (A::FinanceReports, L::View),
            (A::Tasks, L::Edit),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.inventory",
        label: "Stock & orders",
        description: "Products, suppliers and purchase orders. Calendar and issued \
                      documents are read-only.",
        base_role: Role::Reception,
        levels: &[
            (A::PatientDocuments, L::View),
            (A::Calendar, L::View),
            (A::Inventory, L::Full),
            (A::Tasks, L::Edit),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.read_only",
        label: "Trainee (read only)",
        description: "Sees patients, issued documents, the calendar and the cash desk; \
                      can only work on assigned tasks.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::View),
            (A::PatientDocuments, L::View),
            (A::Calendar, L::View),
            (A::CashDesk, L::View),
            (A::Tasks, L::Edit),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    // ---- Physician ---------------------------------------------------------
    Template {
        id: "physician.owner",
        label: "Practice owner",
        description: "Everything, including accounts, access rights and system settings.",
        base_role: Role::Physician,
        levels: &[
            (A::Patients, L::Full),
            (A::MedicalRecord, L::Full),
            (A::PatientDocuments, L::Full),
            (A::Calendar, L::Full),
            (A::CashDesk, L::Full),
            (A::Billing, L::Full),
            (A::FinanceReports, L::Full),
            (A::Inventory, L::Full),
            (A::Tasks, L::Full),
            (A::Staff, L::Full),
            (A::Settings, L::Full),
            (A::Audit, L::Full),
        ],
    },
    Template {
        id: "physician.associate",
        label: "Associate dentist",
        description: "Full clinical work and calendar, issues invoices. No finance reports, \
                      no team or system administration.",
        base_role: Role::Physician,
        levels: &[
            (A::Patients, L::Full),
            (A::MedicalRecord, L::Full),
            (A::PatientDocuments, L::Full),
            (A::Calendar, L::Full),
            (A::CashDesk, L::View),
            (A::Billing, L::Create),
            (A::Inventory, L::Create),
            (A::Tasks, L::Full),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    // ---- Deferred personae -------------------------------------------------
    Template {
        id: "tax_advisor.read_only",
        label: "Tax advisor (read only)",
        description: "Finance reports, invoices and the cash book, read-only.",
        base_role: Role::TaxAdvisor,
        levels: &[
            (A::CashDesk, L::View),
            (A::Billing, L::View),
            (A::FinanceReports, L::View),
        ],
    },
    Template {
        id: "pharma.read_only",
        label: "Pharma consultant (read only)",
        description: "Product catalogue, read-only.",
        base_role: Role::PharmaConsultant,
        levels: &[(A::Inventory, L::View)],
    },
];

pub fn template(id: &str) -> Option<&'static Template> {
    let id = id.trim();
    TEMPLATES.iter().find(|t| t.id == id)
}

/// Profile used for a role when nobody picked one.
pub fn default_template_id(role: Role) -> &'static str {
    match role {
        Role::Physician => "physician.owner",
        Role::Reception => "reception.front_desk",
        Role::TaxAdvisor => "tax_advisor.read_only",
        Role::PharmaConsultant => "pharma.read_only",
    }
}

pub fn default_levels(role: Role) -> Levels {
    template(default_template_id(role))
        .map(|t| t.levels())
        .unwrap_or_else(|| levels_from(&[]))
}

/// Template levels, then the person's own area grants, capped by the role ceiling.
///
/// A template made for another role is ignored (the role default applies),
/// so a stale or synced template id cannot lift a reception login to the
/// physician profile.
pub fn resolve_levels(role: Role, template_id: Option<&str>, custom: &Levels) -> Levels {
    let mut levels = template_id
        .and_then(template)
        .filter(|t| t.base_role == role)
        .map(|t| t.levels())
        .unwrap_or_else(|| default_levels(role));
    for (area, level) in custom {
        levels.insert(*area, *level);
    }
    clamp_to_ceiling(role, &mut levels);
    levels
}

// ---------------------------------------------------------------------------
// Action catalogue
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionKind {
    /// A name from `config/rbac.yaml`, still checked by older call sites.
    Legacy,
    /// A fine-grained name. Without a profile it falls back to `legacy`
    /// (exactly today's behaviour) or, when it has none, to the role default.
    Scoped,
}

#[derive(Debug, Clone, Copy)]
pub struct ActionRule {
    pub action: &'static str,
    pub kind: ActionKind,
    /// Allowed when any one of these is met.
    pub any_of: &'static [(Area, Level)],
    /// For `Scoped`: legacy names that decide when no profile is assigned.
    pub legacy: &'static [&'static str],
}

const fn scoped(
    action: &'static str,
    any_of: &'static [(Area, Level)],
    legacy: &'static [&'static str],
) -> ActionRule {
    ActionRule {
        action,
        kind: ActionKind::Scoped,
        any_of,
        legacy,
    }
}

const fn legacy(action: &'static str, any_of: &'static [(Area, Level)]) -> ActionRule {
    ActionRule {
        action,
        kind: ActionKind::Legacy,
        any_of,
        legacy: &[],
    }
}

/// Every permission the code checks, and what it needs.
///
/// Adding a new check: add its rule here. `tests::every_rbac_yaml_action_has_a_rule`
/// fails for a matrix action that is missing, so a new screen cannot bypass
/// the profiles by accident.
pub const ACTION_RULES: &[ActionRule] = &[
    // ---- Patients ----------------------------------------------------------
    scoped(
        "patients.read",
        &[(A::Patients, L::View)],
        &["patient.read"],
    ),
    scoped(
        "patients.update",
        &[(A::Patients, L::Edit)],
        &["patient.write"],
    ),
    scoped(
        "patients.create",
        &[(A::Patients, L::Create)],
        &["patient.write"],
    ),
    scoped(
        "patients.delete",
        &[(A::Patients, L::Full)],
        &["patient.write"],
    ),
    // ---- Medical record ----------------------------------------------------
    scoped(
        "medical.read",
        &[(A::MedicalRecord, L::View)],
        &["patient.read_medical"],
    ),
    scoped(
        "medical.update",
        &[(A::MedicalRecord, L::Edit)],
        &["patient.write_medical"],
    ),
    scoped(
        "medical.create",
        &[(A::MedicalRecord, L::Create)],
        &["patient.write_medical"],
    ),
    scoped(
        "medical.delete",
        &[(A::MedicalRecord, L::Full)],
        &["patient.write_medical"],
    ),
    scoped("medical.export", &[(A::MedicalRecord, L::Full)], &[]),
    // ---- Patient documents -------------------------------------------------
    scoped(
        "documents.read",
        &[(A::PatientDocuments, L::View)],
        &["patient.read_documents"],
    ),
    scoped("documents.update", &[(A::PatientDocuments, L::Edit)], &[]),
    scoped("documents.create", &[(A::PatientDocuments, L::Create)], &[]),
    scoped("documents.delete", &[(A::PatientDocuments, L::Full)], &[]),
    // ---- Calendar ----------------------------------------------------------
    scoped(
        "calendar.read",
        &[(A::Calendar, L::View)],
        &["appointment.read"],
    ),
    scoped(
        "calendar.update",
        &[(A::Calendar, L::Edit)],
        &["appointment.write"],
    ),
    scoped(
        "calendar.create",
        &[(A::Calendar, L::Create)],
        &["appointment.write"],
    ),
    scoped(
        "calendar.delete",
        &[(A::Calendar, L::Full)],
        &["appointment.write"],
    ),
    // ---- Cash desk ---------------------------------------------------------
    scoped("cash.read", &[(A::CashDesk, L::View)], &["finance.read"]),
    scoped("cash.update", &[(A::CashDesk, L::Edit)], &["finance.write"]),
    scoped(
        "cash.create",
        &[(A::CashDesk, L::Create)],
        &["finance.write"],
    ),
    scoped("cash.delete", &[(A::CashDesk, L::Full)], &["finance.write"]),
    scoped(
        "cash.day_close",
        &[(A::CashDesk, L::Full)],
        &["finance.day_close.write"],
    ),
    // ---- Billing -----------------------------------------------------------
    scoped("billing.read", &[(A::Billing, L::View)], &["finance.read"]),
    scoped(
        "billing.update",
        &[(A::Billing, L::Edit)],
        &["finance.write"],
    ),
    scoped(
        "billing.create",
        &[(A::Billing, L::Create)],
        &["finance.write"],
    ),
    scoped(
        "billing.cancel",
        &[(A::Billing, L::Full)],
        &["finance.write"],
    ),
    // ---- Finance reports ---------------------------------------------------
    scoped(
        "reports.read",
        &[(A::FinanceReports, L::View)],
        &["finance.read"],
    ),
    scoped(
        "reports.create",
        &[(A::FinanceReports, L::Create)],
        &["finance.write"],
    ),
    scoped(
        "reports.statistics",
        &[(A::FinanceReports, L::View)],
        &["statistics.read"],
    ),
    // ---- Inventory ---------------------------------------------------------
    scoped("inventory.read", &[(A::Inventory, L::View)], &[]),
    scoped("inventory.update", &[(A::Inventory, L::Edit)], &[]),
    scoped("inventory.create", &[(A::Inventory, L::Create)], &[]),
    scoped("inventory.delete", &[(A::Inventory, L::Full)], &[]),
    // ---- Tasks -------------------------------------------------------------
    scoped("tasks.read", &[(A::Tasks, L::View)], &[]),
    scoped("tasks.update", &[(A::Tasks, L::Edit)], &[]),
    scoped("tasks.create", &[(A::Tasks, L::Create)], &[]),
    scoped("tasks.delete", &[(A::Tasks, L::Full)], &[]),
    // ---- Team --------------------------------------------------------------
    scoped("staff.read", &[(A::Staff, L::View)], &[]),
    scoped(
        "staff.plan.update",
        &[(A::Staff, L::Edit)],
        &["staff.write"],
    ),
    scoped("staff.manage", &[(A::Staff, L::Full)], &["staff.write"]),
    scoped("access.manage", &[(A::Staff, L::Full)], &["staff.write"]),
    // ---- Settings ----------------------------------------------------------
    scoped("settings.read", &[(A::Settings, L::View)], &[]),
    scoped("settings.update", &[(A::Settings, L::Edit)], &[]),
    scoped(
        "settings.system",
        &[(A::Settings, L::Full)],
        &["ops.system"],
    ),
    // ---- Audit -------------------------------------------------------------
    scoped("audit.view", &[(A::Audit, L::View)], &["audit.read"]),
    // ---- Legacy names (config/rbac.yaml) -----------------------------------
    legacy("patient.read", &[(A::Patients, L::View)]),
    legacy("patient.write", &[(A::Patients, L::Edit)]),
    legacy("patient.read_documents", &[(A::PatientDocuments, L::View)]),
    legacy("patient.read_medical", &[(A::MedicalRecord, L::View)]),
    legacy("patient.write_medical", &[(A::MedicalRecord, L::Edit)]),
    legacy("chart.csv", &[(A::MedicalRecord, L::Full)]),
    legacy("appointment.read", &[(A::Calendar, L::View)]),
    legacy("appointment.write", &[(A::Calendar, L::Edit)]),
    legacy("finance.reception.view", &[(A::CashDesk, L::View)]),
    legacy("finance.read", &[(A::FinanceReports, L::View)]),
    // Older call sites use one name for invoices and cash movements.
    legacy(
        "finance.write",
        &[(A::Billing, L::Create), (A::CashDesk, L::Create)],
    ),
    legacy("finance.day_close.write", &[(A::CashDesk, L::Full)]),
    legacy("statistics.read", &[(A::FinanceReports, L::View)]),
    legacy("audit.read", &[(A::Audit, L::View)]),
    legacy("staff.write", &[(A::Staff, L::Full)]),
    legacy("ops.system", &[(A::Settings, L::Full)]),
    legacy(
        "patient.treatments_list_for_payment",
        &[(A::Billing, L::View)],
    ),
    legacy("appointment.list_physicians", &[(A::Calendar, L::View)]),
    legacy("product.read", &[(A::Inventory, L::View)]),
    legacy("product.write", &[(A::Inventory, L::Create)]),
    legacy("purchase_order.read", &[(A::Inventory, L::View)]),
    legacy("purchase_order.write", &[(A::Inventory, L::Create)]),
    legacy("administration.read", &[(A::Settings, L::View)]),
    legacy("administration.inventory.read", &[(A::Inventory, L::View)]),
    legacy(
        "administration.inventory.write",
        &[(A::Inventory, L::Create)],
    ),
    legacy("administration.contracts.read", &[(A::Inventory, L::View)]),
    legacy(
        "administration.contracts.write",
        &[(A::Inventory, L::Create)],
    ),
    legacy("administration.catalogs.read", &[(A::Billing, L::View)]),
    legacy("administration.catalogs.write", &[(A::Billing, L::Edit)]),
    legacy("administration.templates.read", &[(A::Settings, L::View)]),
    legacy("administration.templates.write", &[(A::Settings, L::Edit)]),
    legacy("administration.team.read", &[(A::Staff, L::View)]),
    legacy(
        "administration.practice_planning.read",
        &[(A::Staff, L::View)],
    ),
    legacy(
        "administration.practice_planning.write",
        &[(A::Staff, L::Edit)],
    ),
    legacy("templates.read", &[(A::Settings, L::View)]),
    legacy("templates.write", &[(A::Settings, L::Edit)]),
    legacy("ops.backup", &[(A::Settings, L::Full)]),
    legacy("ops.dsgvo", &[(A::Settings, L::Full)]),
    legacy("ops.migration", &[(A::Settings, L::Full)]),
    legacy("ops.logs", &[(A::Settings, L::Full)]),
    legacy("ops.audit_chain_ack", &[(A::Settings, L::Full)]),
    legacy("task.status.fulfill", &[(A::Tasks, L::Edit)]),
    legacy("task.status.admin", &[(A::Tasks, L::Full)]),
    legacy("work_time.self", &[(A::Staff, L::View)]),
    legacy("work_time.team.read", &[(A::Staff, L::View)]),
    legacy("work_time.admin", &[(A::Staff, L::Full)]),
];

/// Matrix actions that every signed-in person keeps, whatever the profile.
pub const UNSCOPED_ACTIONS: &[&str] = &["dashboard.read"];

pub fn rule(action: &str) -> Option<&'static ActionRule> {
    ACTION_RULES.iter().find(|r| r.action == action)
}

pub fn rule_allows(levels: &Levels, rule: &ActionRule) -> bool {
    rule.any_of
        .iter()
        .any(|(area, needed)| level_of(levels, *area).allows(*needed))
}

/// Explicit ALLOW/DENY for every catalogued action.
pub fn compile_overrides(levels: &Levels) -> Vec<PermissionOverride> {
    ACTION_RULES
        .iter()
        .map(|rule| PermissionOverride {
            action: rule.action.to_string(),
            effect: if rule_allows(levels, rule) {
                "ALLOW".to_string()
            } else {
                "DENY".to_string()
            },
        })
        .collect()
}

/// `(area, level)` an action needs, for messages and the access screen.
pub fn first_requirement(action: &str) -> Option<(Area, Level)> {
    rule(action).and_then(|r| r.any_of.first().copied())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_are_cumulative() {
        assert!(Level::Full.allows(Level::Create));
        assert!(Level::Create.allows(Level::Edit));
        assert!(Level::Edit.allows(Level::View));
        assert!(!Level::Edit.allows(Level::Create));
        assert!(!Level::None.allows(Level::View));
    }

    #[test]
    fn template_ids_are_unique_and_within_the_ceiling() {
        let mut seen = std::collections::HashSet::new();
        for t in TEMPLATES {
            assert!(seen.insert(t.id), "duplicate template {}", t.id);
            for (area, level) in t.levels {
                assert!(
                    *level <= ceiling(t.base_role, *area),
                    "{} gives {:?} {:?} above the role ceiling",
                    t.id,
                    area,
                    level
                );
            }
        }
    }

    #[test]
    fn reception_never_gets_clinical_write_or_account_admin() {
        let mut custom = Levels::new();
        custom.insert(Area::MedicalRecord, Level::Full);
        custom.insert(Area::Staff, Level::Full);
        custom.insert(Area::Settings, Level::Full);
        let levels = resolve_levels(Role::Reception, Some("reception.office_manager"), &custom);
        assert_eq!(level_of(&levels, Area::MedicalRecord), Level::View);
        assert_eq!(level_of(&levels, Area::Staff), Level::Edit);
        assert_eq!(level_of(&levels, Area::Settings), Level::Edit);
        let compiled = compile_overrides(&levels);
        let deny = |a: &str| compiled.iter().any(|o| o.action == a && o.effect == "DENY");
        assert!(deny("patient.write_medical"));
        assert!(deny("access.manage"));
        assert!(deny("staff.write"));
        assert!(deny("ops.system"));
    }

    #[test]
    fn a_physician_template_is_ignored_for_a_reception_login() {
        let levels = resolve_levels(Role::Reception, Some("physician.owner"), &Levels::new());
        assert_eq!(levels, default_levels(Role::Reception));
    }

    #[test]
    fn calendar_and_cash_example_matches_the_request() {
        // "cash (edit), calendar (full), patient (half access)"
        let levels = resolve_levels(
            Role::Reception,
            Some("reception.calendar_cash"),
            &Levels::new(),
        );
        let compiled = compile_overrides(&levels);
        let allowed = |a: &str| {
            compiled
                .iter()
                .any(|o| o.action == a && o.effect == "ALLOW")
        };
        assert!(allowed("calendar.delete"));
        assert!(allowed("cash.read"));
        assert!(allowed("cash.update"));
        assert!(!allowed("cash.create"));
        assert!(!allowed("cash.day_close"));
        assert!(allowed("patients.update"));
        assert!(!allowed("patients.create"));
        assert!(!allowed("patients.delete"));
        assert!(!allowed("medical.read"));
        assert!(!allowed("billing.read"));
    }

    #[test]
    fn every_scoped_action_lists_a_real_area_requirement() {
        for r in ACTION_RULES {
            assert!(!r.any_of.is_empty(), "{} has no requirement", r.action);
            if r.kind == ActionKind::Legacy {
                assert!(
                    r.legacy.is_empty(),
                    "{}: legacy rules have no fallback",
                    r.action
                );
            }
        }
        let mut seen = std::collections::HashSet::new();
        for r in ACTION_RULES {
            assert!(seen.insert(r.action), "duplicate rule {}", r.action);
        }
    }

    #[test]
    fn wire_names_round_trip() {
        for a in Area::ALL {
            assert_eq!(Area::parse(a.wire()), Some(a));
            assert_eq!(
                serde_json::to_string(&a).unwrap(),
                format!("\"{}\"", a.wire())
            );
        }
        for l in Level::ALL {
            assert_eq!(Level::parse(l.wire()), Some(l));
        }
    }
}
