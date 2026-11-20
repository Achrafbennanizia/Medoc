# Access profiles

Who may do what in MeDoc is decided per **area** and **level**. Source of truth:
`crates/shared/medoc-core/src/domain/access.rs`.

## Levels (cumulative)

| Level | Allows |
|---|---|
| None | Nothing |
| View | Read |
| Edit | Read and update existing records |
| Create | Read, create and update |
| Full | Everything, including delete, cancel, void, day close and export |

## Predefined profiles

| Profile | Role | Patients (master data) | Medical record | Patient documents | Calendar | Cash desk | Billing | Finance reports | Inventory & orders | Tasks | Team | Settings | Audit trail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `reception.front_desk` Front desk (all reception tasks) | Reception | Full | – | Create | Full | Full | Create | – | Create | Full | View | View | – |
| `reception.office_manager` Office manager (everything a reception login may have) | Reception | Full | View | Full | Full | Full | Full | Full | Full | Full | Edit | Edit | View |
| `reception.scheduler` Scheduler (appointments & registration) | Reception | Create | – | View | Full | – | – | – | – | Create | View | View | – |
| `reception.cashier` Cashier (cash desk) | Reception | View | – | – | View | Full | Create | – | – | Edit | View | View | – |
| `reception.calendar_cash` Calendar + cash desk (limited patient access) | Reception | Edit | – | – | Full | Edit | – | – | – | Edit | View | View | – |
| `reception.billing` Billing coordinator | Reception | Edit | – | View | View | Full | Full | View | – | Edit | View | View | – |
| `reception.inventory` Stock & orders | Reception | – | – | – | View | – | – | – | Full | Edit | View | View | – |
| `reception.read_only` Trainee (read only) | Reception | View | – | – | View | View | – | – | – | Edit | View | View | – |
| `physician.owner` Practice owner | Physician | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| `physician.associate` Associate dentist | Physician | Full | Full | Full | Full | View | Create | – | Create | Full | View | View | – |
| `tax_advisor.read_only` Tax advisor (read only) | TaxAdvisor | – | – | – | – | View | View | View | – | – | – | – | – |
| `pharma.read_only` Pharma consultant (read only) | PharmaConsultant | – | – | – | – | – | – | – | View | – | – | – | – |

An admin picks a profile and may change single areas for one person
(for example *Scheduler* plus cash desk *Full*).

## Hard limits for reception logins

Whatever the profile says, a reception login never gets more than:
medical record **View**, team **Edit** (work plans and absences, no accounts or
access rights), settings **Edit** (no network, pairing or licence),
audit trail **View**. A higher request is refused, not silently reduced.

## Rules when changing access

- Only someone with `access.manage` (team area at *Full*) changes access, and
  only on the main device. Rows replicate to every replica from there; a
  replica or mesh peer cannot push them.
- Nobody changes their own access.
- Nobody grants more than they hold, area by area.
- The last person able to manage access keeps that right.
- Every change is written to the audit trail and ends the person's LAN tokens.

## Precedence

1. A hand-set per-person ALLOW/DENY for one action.
2. The person's profile (template plus area changes).
3. Without a profile: the role matrix in `config/rbac.yaml`, exactly as before.

## Adding a new permission check

Add a rule to `ACTION_RULES` in `domain/access.rs`. The test
`every_rbac_yaml_action_has_a_rule` fails for a matrix action without a rule.
