//! The recovery run: decrypt, check and write the recovery file (split from `ui.rs`).

use super::*;

impl RecoveryApp {
    pub(super) fn run_recover(&mut self) {
        if self.busy {
            return;
        }
        self.busy = true;
        self.persist_vendor_fields_to_store();

        let bridge = self.bridge();
        let mut req = RecoverRequest {
            bridge: Some(bridge),
            ..Default::default()
        };

        match bridge {
            Bridge::A => {
                if self.manifest.trim().is_empty() || self.passphrase.is_empty() {
                    self.status_text = "Bridge A needs activation.json path and passphrase.".into();
                    self.busy = false;
                    return;
                }
                req.manifest = Some(PathBuf::from(self.manifest.trim()));
                req.passphrase = Some(self.passphrase.clone());
            }
            Bridge::B => {
                if self.app_dir.trim().is_empty() || self.passphrase.is_empty() {
                    self.status_text =
                        "Bridge B needs app-data directory and wrap passphrase.".into();
                    self.busy = false;
                    return;
                }
                req.app_dir = Some(PathBuf::from(self.app_dir.trim()));
                req.passphrase = Some(self.passphrase.clone());
            }
            Bridge::C => {
                if self.practice_share.trim().is_empty()
                    || self.vendor_share.trim().is_empty()
                    || self.vendor_sk.trim().is_empty()
                {
                    self.status_text =
                        "Bridge C needs practice share, vendor share, and vendor-recovery.sk.\nClick Rescan or drop files into the store folder.".into();
                    self.busy = false;
                    return;
                }
                req.practice_share = Some(PathBuf::from(self.practice_share.trim()));
                req.vendor_share = Some(PathBuf::from(self.vendor_share.trim()));
                req.vendor_sk = Some(PathBuf::from(self.vendor_sk.trim()));
            }
        }

        if self.do_write_wrap {
            if self.write_wrap_dir.trim().is_empty() {
                self.status_text = "Write-wrap is on — set an app-data directory.".into();
                self.busy = false;
                return;
            }
            let wrap_pw = if !self.wrap_passphrase.is_empty() {
                self.wrap_passphrase.clone()
            } else if !self.passphrase.is_empty() {
                self.passphrase.clone()
            } else {
                self.status_text =
                    "Set a new wrap passphrase (or Bridge A/B passphrase) before writing wrap."
                        .into();
                self.busy = false;
                return;
            };
            req.write_wrap_dir = Some(PathBuf::from(self.write_wrap_dir.trim()));
            req.wrap_passphrase = Some(wrap_pw);
        }

        if self.do_verify {
            if self.verify_db.trim().is_empty() {
                self.status_text = "Verify DB is on — set medoc.db path.".into();
                self.busy = false;
                return;
            }
            req.verify_db = Some(PathBuf::from(self.verify_db.trim()));
        }

        match recover(&req) {
            Ok((key, mut result)) => {
                self.last_kcv = result.kcv_b64.clone();
                self.recovered = Some((Zeroizing::new(key.to_vec()), result.bridge.clone()));
                if self.practice_dir.trim().is_empty() {
                    let guess = [&self.app_dir, &self.write_wrap_dir]
                        .into_iter()
                        .map(|d| d.trim())
                        .find(|d| !d.is_empty() && password::practice_db(d.as_ref()).is_file());
                    if let Some(d) = guess {
                        self.practice_dir = d.to_string();
                    }
                }
                if !self.practice_dir.trim().is_empty() {
                    self.load_accounts();
                }
                let mut msg = format!(
                    "Recover OK (bridge {}). KCV {}",
                    result.bridge, result.kcv_b64
                );
                if let Some(ref w) = result.wrap_written {
                    msg.push_str(&format!("\nWrote wrap under {w}"));
                }
                if let Some(ref v) = result.verify_db {
                    msg.push_str(&format!("\nverify-db: {v}"));
                }

                if self.do_export {
                    if self.export_path.trim().is_empty() {
                        self.status_text = "Export is on — set an output file path.".into();
                        self.busy = false;
                        return;
                    }
                    if self.export_include_key {
                        result.key_hex = Some(hex::encode(&*key));
                        msg.push_str("\nWARNING: export includes plaintext key_hex");
                    }
                    let fmt = self.export_format();
                    match write_recovery_file(
                        PathBuf::from(self.export_path.trim()).as_path(),
                        &result,
                        fmt,
                    ) {
                        Ok(()) => {
                            msg.push_str(&format!(
                                "\nCreated {} ({})",
                                self.export_path.trim(),
                                fmt.as_str()
                            ));
                        }
                        Err(e) => {
                            msg.push_str(&format!("\nExport failed: {e:#}"));
                        }
                    }
                }

                self.status_text = msg.clone();
                self.push_log(&msg);
            }
            Err(e) => {
                let err = format!("Recover failed: {e:#}");
                self.status_text = err.clone();
                self.push_log(&err);
            }
        }
        self.busy = false;
    }
}
