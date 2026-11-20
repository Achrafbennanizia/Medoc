//! Write recovery results to a new file as JSON, XML, or YAML.

use std::path::Path;

use anyhow::{bail, Context, Result};

use crate::RecoveryResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Xml,
    Yaml,
}

impl ExportFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            ExportFormat::Json => "json",
            ExportFormat::Xml => "xml",
            ExportFormat::Yaml => "yaml",
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            ExportFormat::Json => "json",
            ExportFormat::Xml => "xml",
            ExportFormat::Yaml => "yaml",
        }
    }

    pub fn parse(s: &str) -> Result<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "json" => Ok(ExportFormat::Json),
            "xml" => Ok(ExportFormat::Xml),
            "yaml" | "yml" => Ok(ExportFormat::Yaml),
            _ => bail!("format must be json, xml, or yaml"),
        }
    }

    pub fn all() -> &'static [ExportFormat] {
        &[ExportFormat::Json, ExportFormat::Xml, ExportFormat::Yaml]
    }
}

/// Serialize `result` and create/overwrite `path` with that content.
pub fn write_recovery_file(
    path: &Path,
    result: &RecoveryResult,
    format: ExportFormat,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create parent {}", parent.display()))?;
        }
    }
    let body = match format {
        ExportFormat::Json => {
            serde_json::to_string_pretty(result).context("serialize recovery JSON")?
        }
        ExportFormat::Yaml => serde_yaml::to_string(result).context("serialize recovery YAML")?,
        ExportFormat::Xml => to_xml(result),
    };
    std::fs::write(path, body).with_context(|| format!("write {}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = if result.key_hex.is_some() {
            0o600
        } else {
            0o644
        };
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode));
    }
    Ok(())
}

fn xml_escape(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '&' => "&amp;".into(),
            '<' => "&lt;".into(),
            '>' => "&gt;".into(),
            '"' => "&quot;".into(),
            '\'' => "&apos;".into(),
            c => c.to_string(),
        })
        .collect()
}

fn to_xml(r: &RecoveryResult) -> String {
    let mut out = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    out.push_str("<medoc-recovery-result version=\"1\">\n");
    out.push_str(&format!("  <kind>{}</kind>\n", xml_escape(&r.kind)));
    out.push_str(&format!("  <bridge>{}</bridge>\n", xml_escape(&r.bridge)));
    out.push_str(&format!(
        "  <recovered_at>{}</recovered_at>\n",
        xml_escape(&r.recovered_at)
    ));
    out.push_str(&format!(
        "  <kcv_b64>{}</kcv_b64>\n",
        xml_escape(&r.kcv_b64)
    ));
    if let Some(w) = &r.wrap_written {
        out.push_str(&format!(
            "  <wrap_written>{}</wrap_written>\n",
            xml_escape(w)
        ));
    }
    if let Some(v) = &r.verify_db {
        out.push_str(&format!("  <verify_db>{}</verify_db>\n", xml_escape(v)));
    }
    if let Some(k) = &r.key_hex {
        out.push_str(&format!("  <key_hex>{}</key_hex>\n", xml_escape(k)));
    }
    out.push_str("</medoc-recovery-result>\n");
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::RecoveryResult;

    #[test]
    fn json_xml_yaml_roundtrip_shape() {
        let r = RecoveryResult {
            kind: "medoc-recovery-result.v1".into(),
            bridge: "c".into(),
            recovered_at: "123".into(),
            kcv_b64: "YWJj".into(),
            wrap_written: Some("/tmp/app".into()),
            verify_db: Some("ok".into()),
            key_hex: None,
        };
        let dir = tempfile::tempdir().unwrap();
        for fmt in ExportFormat::all() {
            let p = dir.path().join(format!("out.{}", fmt.extension()));
            write_recovery_file(&p, &r, *fmt).unwrap();
            let s = std::fs::read_to_string(&p).unwrap();
            assert!(s.contains("medoc-recovery-result"));
            assert!(s.contains("YWJj"));
        }
    }
}
