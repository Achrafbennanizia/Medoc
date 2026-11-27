//! The egui window: layout of the recovery and export sections.

use super::*;

impl eframe::App for RecoveryApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical()
                .id_salt("recovery_main_scroll")
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    let loc = self.locale;
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(ui_i18n::t(loc, Msg::Title))
                                .size(22.0)
                                .strong(),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            for option in Locale::ALL {
                                let selected = self.locale == option;
                                if ui
                                    .selectable_label(selected, option.label())
                                    .on_hover_text(option.code())
                                    .clicked()
                                {
                                    self.locale = option;
                                }
                            }
                        });
                    });
                    ui.label(
                        RichText::new(ui_i18n::t(loc, Msg::Subtitle))
                            .size(13.0)
                            .color(Color32::GRAY),
                    );
                    ui.label(
                        RichText::new(format!("{} {APP_VERSION}", ui_i18n::t(loc, Msg::Build)))
                            .size(12.0)
                            .color(Color32::from_rgb(90, 90, 110)),
                    );
                    ui.add_space(8.0);

                    ui.label(RichText::new(ui_i18n::t(loc, Msg::LocalStore)).strong());
                    ui.label(
                        RichText::new(&self.store_root)
                            .size(12.0)
                            .color(Color32::from_rgb(60, 60, 90)),
                    );
                    ui.horizontal(|ui| {
                        if ui.button(ui_i18n::t(loc, Msg::Rescan)).clicked() {
                            self.apply_scan(store::rescan());
                        }
                        if ui.button(ui_i18n::t(loc, Msg::OpenStore)).clicked() {
                            self.open_store_folder();
                        }
                    });

                    ui.add_space(12.0);
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::Bridge)).strong());
                    egui::ComboBox::from_id_salt("bridge")
                        .selected_text(ui_i18n::bridge_label(loc, self.bridge_idx))
                        .show_ui(ui, |ui| {
                            ui.selectable_value(
                                &mut self.bridge_idx,
                                0,
                                ui_i18n::t(loc, Msg::BridgeA),
                            );
                            ui.selectable_value(
                                &mut self.bridge_idx,
                                1,
                                ui_i18n::t(loc, Msg::BridgeB),
                            );
                            ui.selectable_value(
                                &mut self.bridge_idx,
                                2,
                                ui_i18n::t(loc, Msg::BridgeC),
                            );
                        });

                    ui.add_space(10.0);
                    match self.bridge() {
                        Bridge::A => {
                            path_field(ui, ui_i18n::t(loc, Msg::Manifest), &mut self.manifest);
                            ui.label(ui_i18n::t(loc, Msg::Passphrase));
                            ui.add(
                                egui::TextEdit::singleline(&mut self.passphrase)
                                    .password(true)
                                    .desired_width(f32::INFINITY),
                            );
                        }
                        Bridge::B => {
                            path_field(ui, ui_i18n::t(loc, Msg::AppDir), &mut self.app_dir);
                            ui.label(ui_i18n::t(loc, Msg::Passphrase));
                            ui.add(
                                egui::TextEdit::singleline(&mut self.passphrase)
                                    .password(true)
                                    .desired_width(f32::INFINITY),
                            );
                        }
                        Bridge::C => {
                            path_field(
                                ui,
                                ui_i18n::t(loc, Msg::PracticeShare),
                                &mut self.practice_share,
                            );
                            path_field(
                                ui,
                                ui_i18n::t(loc, Msg::VendorShare),
                                &mut self.vendor_share,
                            );
                            path_field(ui, ui_i18n::t(loc, Msg::VendorSk), &mut self.vendor_sk);
                        }
                    }

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    ui.checkbox(&mut self.do_write_wrap, ui_i18n::t(loc, Msg::WriteWrap));
                    if self.do_write_wrap {
                        path_field(
                            ui,
                            ui_i18n::t(loc, Msg::WriteWrapDir),
                            &mut self.write_wrap_dir,
                        );
                        ui.label(ui_i18n::t(loc, Msg::WrapPassphrase));
                        ui.add(
                            egui::TextEdit::singleline(&mut self.wrap_passphrase)
                                .password(true)
                                .desired_width(f32::INFINITY),
                        );
                    }

                    ui.add_space(8.0);
                    ui.checkbox(&mut self.do_verify, ui_i18n::t(loc, Msg::DoVerify));
                    if self.do_verify {
                        path_field(ui, ui_i18n::t(loc, Msg::VerifyDb), &mut self.verify_db);
                    }

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::DoExport)).strong());
                    ui.checkbox(&mut self.do_export, ui_i18n::t(loc, Msg::DoExport));
                    if self.do_export {
                        ui.horizontal(|ui| {
                            ui.label(ui_i18n::t(loc, Msg::ExportFormat));
                            let prev = self.export_format_idx;
                            egui::ComboBox::from_id_salt("export_fmt")
                                .selected_text(self.export_format().as_str().to_uppercase())
                                .show_ui(ui, |ui| {
                                    ui.selectable_value(&mut self.export_format_idx, 0, "JSON");
                                    ui.selectable_value(&mut self.export_format_idx, 1, "XML");
                                    ui.selectable_value(&mut self.export_format_idx, 2, "YAML");
                                });
                            if prev != self.export_format_idx {
                                self.sync_export_extension();
                            }
                        });
                        path_field(ui, ui_i18n::t(loc, Msg::ExportPath), &mut self.export_path);
                        ui.checkbox(
                            &mut self.export_include_key,
                            ui_i18n::t(loc, Msg::IncludeKey),
                        );
                    }

                    ui.add_space(14.0);
                    ui.add_enabled_ui(!self.busy, |ui| {
                        if ui
                            .add_sized(
                                Vec2::new(ui.available_width(), 40.0),
                                egui::Button::new(ui_i18n::t(loc, Msg::Recover)),
                            )
                            .clicked()
                        {
                            self.run_recover();
                        }
                    });

                    if self.recovered.is_some() {
                        ui.add_space(12.0);
                        ui.separator();
                        ui.add_space(8.0);
                        self.reset_section(ui, loc);
                    }

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    if !self.last_kcv.is_empty() {
                        ui.label(RichText::new(format!("Last KCV: {}", self.last_kcv)).strong());
                    }
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::Status)).strong());
                    ui.label(
                        RichText::new(&self.status_text)
                            .size(13.0)
                            .color(Color32::from_rgb(40, 90, 50)),
                    );
                    ui.add_space(8.0);
                    ui.label(RichText::new("Log").strong());
                    ui.add(
                        egui::TextEdit::multiline(&mut self.log)
                            .desired_width(f32::INFINITY)
                            .desired_rows(8)
                            .interactive(false),
                    );
                });
        });
    }
}

pub(super) fn path_field(ui: &mut egui::Ui, label: &str, value: &mut String) {
    ui.label(label);
    ui.add(
        egui::TextEdit::singleline(value)
            .hint_text("/path/…")
            .desired_width(f32::INFINITY),
    );
}
