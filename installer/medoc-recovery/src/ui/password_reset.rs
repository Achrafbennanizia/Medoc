//! Staff password reset: load accounts, reset a password and the reset section of the window.

use super::*;

impl RecoveryApp {
    pub(super) fn runtime() -> Result<tokio::runtime::Runtime, String> {
        tokio::runtime::Runtime::new().map_err(|e| e.to_string())
    }

    pub(super) fn load_accounts(&mut self) {
        let Some((key, _)) = self.recovered.as_ref() else {
            return;
        };
        let db = password::practice_db(PathBuf::from(self.practice_dir.trim()).as_path());
        let out = Self::runtime().and_then(|rt| {
            rt.block_on(password::list_accounts(&db, key))
                .map_err(|e| format!("{e:#}"))
        });
        match out {
            Ok(list) => {
                let msg = format!("{} account(s) in {}", list.len(), db.display());
                self.accounts = list;
                self.account_idx = 0;
                self.push_log(&msg);
            }
            Err(e) => {
                self.accounts.clear();
                let msg = format!("Load accounts failed: {e}");
                self.status_text = msg.clone();
                self.push_log(&msg);
            }
        }
    }

    pub(super) fn run_reset(&mut self) {
        let Some((key, bridge)) = self.recovered.as_ref() else {
            return;
        };
        let Some(account) = self.accounts.get(self.account_idx).cloned() else {
            self.status_text = "Load the accounts and pick one first.".into();
            return;
        };
        if self.new_login_pw != self.new_login_pw2 {
            self.status_text = "The two passwords differ.".into();
            return;
        }
        let db = password::practice_db(PathBuf::from(self.practice_dir.trim()).as_path());
        let out = Self::runtime().and_then(|rt| {
            rt.block_on(password::reset_password(
                &db,
                key,
                &account.id,
                &self.new_login_pw,
                bridge,
            ))
            .map_err(|e| format!("{e:#}"))
        });
        let msg = match out {
            Ok(r) => {
                self.new_login_pw.clear();
                self.new_login_pw2.clear();
                format!(
                    "New login password set for {} ({}). {} session(s) ended, {} lockout(s) cleared. Audit log: {}.",
                    r.account.email,
                    r.account.role,
                    r.sessions_ended,
                    r.lockouts_cleared,
                    if r.audit_logged { "written" } else { "not written (no audit key on this computer); see logs/recovery.log" }
                )
            }
            Err(e) => format!("Password reset failed: {e}"),
        };
        self.status_text = msg.clone();
        self.push_log(&msg);
    }

    pub(super) fn reset_section(&mut self, ui: &mut egui::Ui, loc: Locale) {
        ui.label(RichText::new(ui_i18n::t(loc, Msg::ResetTitle)).strong());
        ui.label(
            RichText::new(ui_i18n::t(loc, Msg::ResetHint))
                .size(12.0)
                .color(Color32::GRAY),
        );
        path_field(
            ui,
            ui_i18n::t(loc, Msg::PracticeDir),
            &mut self.practice_dir,
        );
        if ui.button(ui_i18n::t(loc, Msg::LoadAccounts)).clicked() {
            self.load_accounts();
        }
        if self.accounts.is_empty() {
            return;
        }
        ui.label(ui_i18n::t(loc, Msg::Account));
        let label = |a: &Account| format!("{} — {} ({})", a.name, a.email, a.role);
        egui::ComboBox::from_id_salt("reset_account")
            .width(ui.available_width())
            .selected_text(
                self.accounts
                    .get(self.account_idx)
                    .map(label)
                    .unwrap_or_default(),
            )
            .show_ui(ui, |ui| {
                for (i, a) in self.accounts.iter().enumerate() {
                    ui.selectable_value(&mut self.account_idx, i, label(a));
                }
            });
        ui.label(ui_i18n::t(loc, Msg::NewLoginPassword));
        ui.add(
            egui::TextEdit::singleline(&mut self.new_login_pw)
                .password(true)
                .desired_width(f32::INFINITY),
        );
        ui.label(ui_i18n::t(loc, Msg::RepeatLoginPassword));
        ui.add(
            egui::TextEdit::singleline(&mut self.new_login_pw2)
                .password(true)
                .desired_width(f32::INFINITY),
        );
        let policy =
            medoc_core::infrastructure::crypto::evaluate_password_policy(&self.new_login_pw);
        ui.label(
            RichText::new(ui_i18n::t(loc, Msg::PasswordPolicy))
                .size(12.0)
                .color(if policy.valid {
                    Color32::from_rgb(40, 110, 60)
                } else {
                    Color32::GRAY
                }),
        );
        let ready = policy.valid && self.new_login_pw == self.new_login_pw2;
        ui.add_enabled_ui(ready, |ui| {
            if ui
                .add_sized(
                    Vec2::new(ui.available_width(), 36.0),
                    egui::Button::new(ui_i18n::t(loc, Msg::ResetButton)),
                )
                .clicked()
            {
                self.run_reset();
            }
        });
    }
}

pub(super) fn fill_if_found(field: &mut String, value: Option<&str>) {
    if let Some(v) = value {
        if !v.is_empty() {
            *field = v.to_string();
        }
    }
}
