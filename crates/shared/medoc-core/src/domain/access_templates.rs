//! Predefined roles ("templates"): a named set of area levels for a common job. The admin picks
//! one for a person and may adjust single areas; the login role's ceiling always applies.
//! Labels and descriptions shown to users come from the locale files (`access.role.<id>.*`);
//! the texts here are for logs and tests.

use crate::domain::access::{
    clamp_to_ceiling, levels_from, Area, Area as A, Level, Level as L, Levels,
};
use crate::domain::rbac::Role;

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
    Template {
        id: "physician.employed_dentist",
        label: "Employed dentist",
        description: "Full clinical work and calendar; invoices and cash read-only. No team, \
                      finance or system administration.",
        base_role: Role::Physician,
        levels: &[
            (A::Patients, L::Full),
            (A::MedicalRecord, L::Full),
            (A::PatientDocuments, L::Full),
            (A::Calendar, L::Full),
            (A::CashDesk, L::View),
            (A::Billing, L::View),
            (A::Inventory, L::View),
            (A::Tasks, L::Full),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "physician.practice_manager",
        label: "Practice manager",
        description: "Runs the practice: team, access rights, finance, settings and audit. \
                      Reads the medical record but does not change it.",
        base_role: Role::Physician,
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
            (A::Staff, L::Full),
            (A::Settings, L::Full),
            (A::Audit, L::View),
        ],
    },
    Template {
        id: "physician.trainee",
        label: "Trainee dentist",
        description: "Documents treatments and updates the calendar; cannot delete records, \
                      bill or see finance.",
        base_role: Role::Physician,
        levels: &[
            (A::Patients, L::Edit),
            (A::MedicalRecord, L::Create),
            (A::PatientDocuments, L::Create),
            (A::Calendar, L::Create),
            (A::Tasks, L::Create),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.dental_assistant",
        label: "Dental assistant",
        description: "Prepares patients and the calendar, reads the medical record, files \
                      documents and keeps stock. No cash desk or billing.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Edit),
            (A::MedicalRecord, L::View),
            (A::PatientDocuments, L::Create),
            (A::Calendar, L::Full),
            (A::Inventory, L::Edit),
            (A::Tasks, L::Full),
            (A::Staff, L::View),
            (A::Settings, L::View),
        ],
    },
    Template {
        id: "reception.trainee",
        label: "Reception trainee",
        description: "Looks up patients, books appointments and works on tasks. \
                      Cannot take payments or change patient data.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::View),
            (A::PatientDocuments, L::View),
            (A::Calendar, L::Create),
            (A::Tasks, L::Edit),
            (A::Staff, L::View),
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
    // ---- Solo guest (cap-guest-inbox) --------------------------------------
    // The guest proposes; the admin adds or dismisses (editions-plan.md §4.2). The write levels
    // here only open the forms: `rbac::effective_allowed` refuses every guest write, and the
    // proposal goes to the inbox instead.
    Template {
        id: GUEST_TEMPLATE,
        label: "Guest (proposes, the admin integrates)",
        description: "Proposes patients, appointments and cash payments for the admin to add; \
                      sees stock and may confirm deliveries. No clinical record, documents, \
                      statistics or settings.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Create),
            (A::Calendar, L::Create),
            (A::CashDesk, L::Create),
            // Edit: confirm / receive deliveries; Create (new orders) stays denied.
            (A::Inventory, L::Edit),
        ],
    },
    Template {
        id: GUEST_CLINICAL_TEMPLATE,
        label: "Guest with clinical read access",
        description: "As the guest, and may read the clinical record.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Create),
            (A::Calendar, L::Create),
            (A::CashDesk, L::Create),
            (A::Inventory, L::Edit),
            (A::MedicalRecord, L::View),
        ],
    },
    Template {
        id: GUEST_DOCUMENTS_TEMPLATE,
        label: "Guest with patient documents read access",
        description: "As the guest, and may read patient documents (prescriptions, certificates).",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Create),
            (A::Calendar, L::Create),
            (A::CashDesk, L::Create),
            (A::Inventory, L::Edit),
            (A::PatientDocuments, L::View),
        ],
    },
    Template {
        id: GUEST_CLINICAL_DOCUMENTS_TEMPLATE,
        label: "Guest with clinical and documents read access",
        description: "As the guest, and may read the clinical record and patient documents.",
        base_role: Role::Reception,
        levels: &[
            (A::Patients, L::Create),
            (A::Calendar, L::Create),
            (A::CashDesk, L::Create),
            (A::Inventory, L::Edit),
            (A::MedicalRecord, L::View),
            (A::PatientDocuments, L::View),
        ],
    },
];

/// Guest profile of the Solo edition.
pub const GUEST_TEMPLATE: &str = "solo.guest";
/// Guest profile with clinical read access (Settings > Guest switch).
pub const GUEST_CLINICAL_TEMPLATE: &str = "solo.guest_clinical";
/// Guest profile with patient-documents read access (Settings > Guest switch).
pub const GUEST_DOCUMENTS_TEMPLATE: &str = "solo.guest_documents";
/// Guest profile with clinical + documents read access.
pub const GUEST_CLINICAL_DOCUMENTS_TEMPLATE: &str = "solo.guest_clinical_documents";

/// Whether this build offers the template: guest templates only in guest-inbox editions.
pub fn template_available(t: &Template) -> bool {
    cfg!(feature = "cap-guest-inbox") || !t.id.starts_with("solo.")
}

pub fn template(id: &str) -> Option<&'static Template> {
    let id = id.trim();
    TEMPLATES
        .iter()
        .find(|t| t.id == id)
        .filter(|t| template_available(t))
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
