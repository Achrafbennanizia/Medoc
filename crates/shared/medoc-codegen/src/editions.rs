//! Codegen for `config/editions.yaml` → Rust `OUT_DIR/edition_generated.rs` +
//! `packages/shared/src/lib/edition.generated.ts` (docs/architecture/editions-plan.md §3.1).
//!
//! Also checks that the calling crate's `Cargo.toml` declares one `cap-<name>` feature per
//! capability, so a capability cannot exist in the YAML without a Cargo switch.

use std::env;
use std::fs;
use std::path::Path;

#[derive(serde::Deserialize)]
struct EditionsYaml {
    capabilities: serde_yaml::Mapping,
    #[serde(default)]
    exclusive: Vec<Vec<String>>,
    editions: serde_yaml::Mapping,
}

#[derive(serde::Deserialize)]
struct EditionYaml {
    devices: u32,
    admins: u32,
    accounts: u32,
    doctors: u32,
    caps: Vec<String>,
}

struct Edition {
    id: String,
    spec: EditionYaml,
}

struct Model {
    caps: Vec<(String, String)>,
    editions: Vec<Edition>,
}

/// Run the editions codegen.
///
/// - `yaml_path` — `config/editions.yaml`.
/// - `ts_out_dir` — directory that receives `edition.generated.ts` (its parent gets
///   `edition-defines.generated.d.ts`).
/// - `cargo_toml` — the calling crate's manifest, checked for `cap-*` features.
pub fn run(yaml_path: &Path, ts_out_dir: &Path, cargo_toml: &Path) {
    let src = fs::read_to_string(yaml_path)
        .unwrap_or_else(|e| panic!("read {}: {e}", yaml_path.display()));
    let model = parse(&src).unwrap_or_else(|e| panic!("{}: {e}", yaml_path.display()));

    let manifest = fs::read_to_string(cargo_toml)
        .unwrap_or_else(|e| panic!("read {}: {e}", cargo_toml.display()));
    for (cap, _) in &model.caps {
        let feature = format!("{} = ", cargo_feature(cap));
        if !manifest
            .lines()
            .any(|l| l.trim_start().starts_with(&feature))
        {
            panic!(
                "{} declares capability `{cap}` but {} has no feature `{}`",
                yaml_path.display(),
                cargo_toml.display(),
                cargo_feature(cap)
            );
        }
    }

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR");
    fs::write(
        Path::new(&out_dir).join("edition_generated.rs"),
        render_rust(&model),
    )
    .expect("write edition_generated.rs");
    crate::write_if_changed(&ts_out_dir.join("edition.generated.ts"), &render_ts(&model));
    // `packages/shared/src/` (parent of `lib/`), see `render_dts`.
    crate::write_if_changed(
        &ts_out_dir.join("../edition-defines.generated.d.ts"),
        &render_dts(&model),
    );

    println!("cargo:rerun-if-changed={}", yaml_path.display());
    println!("cargo:rerun-if-changed={}", cargo_toml.display());
}

fn parse(src: &str) -> Result<Model, String> {
    let doc: EditionsYaml = serde_yaml::from_str(src).map_err(|e| e.to_string())?;

    let mut caps = Vec::new();
    for (k, v) in &doc.capabilities {
        let id = k
            .as_str()
            .ok_or("capability ids must be strings")?
            .to_string();
        check_ident(&id)?;
        let about = v.as_str().unwrap_or_default().to_string();
        caps.push((id, about));
    }
    let known = |c: &str| caps.iter().any(|(id, _)| id == c);

    for group in &doc.exclusive {
        for c in group {
            if !known(c) {
                return Err(format!("exclusive: unknown capability `{c}`"));
            }
        }
    }

    let mut editions = Vec::new();
    for (k, v) in &doc.editions {
        let id = k.as_str().ok_or("edition ids must be strings")?.to_string();
        check_ident(&id)?;
        let spec: EditionYaml =
            serde_yaml::from_value(v.clone()).map_err(|e| format!("edition `{id}`: {e}"))?;
        for c in &spec.caps {
            if !known(c) {
                return Err(format!("edition `{id}`: unknown capability `{c}`"));
            }
        }
        for group in &doc.exclusive {
            let on: Vec<&String> = group.iter().filter(|c| spec.caps.contains(c)).collect();
            if on.len() > 1 {
                return Err(format!("edition `{id}`: capabilities {on:?} are exclusive"));
            }
        }
        if spec.devices == 0 || spec.admins == 0 || spec.admins > spec.devices {
            return Err(format!("edition `{id}`: need 1 <= admins <= devices"));
        }
        editions.push(Edition { id, spec });
    }
    if editions.is_empty() {
        return Err("no editions".into());
    }
    Ok(Model { caps, editions })
}

fn check_ident(id: &str) -> Result<(), String> {
    let ok = id.starts_with(|c: char| c.is_ascii_lowercase())
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
    if ok {
        Ok(())
    } else {
        Err(format!("`{id}`: ids must be snake_case"))
    }
}

/// `multi_staff` → `cap-multi-staff`.
pub fn cargo_feature(cap: &str) -> String {
    format!("cap-{}", cap.replace('_', "-"))
}

/// `multi_staff` → `multiStaff`.
fn camel(id: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for c in id.chars() {
        if c == '_' {
            upper = true;
        } else if upper {
            out.push(c.to_ascii_uppercase());
            upper = false;
        } else {
            out.push(c);
        }
    }
    out
}

fn render_rust(m: &Model) -> String {
    let mut o =
        String::from("// @generated by build.rs from config/editions.yaml — DO NOT EDIT\n\n");

    o.push_str("/// Capabilities of a build (config/editions.yaml).\n");
    o.push_str("#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]\n");
    o.push_str("#[serde(rename_all = \"camelCase\")]\npub struct Caps {\n");
    for (id, about) in &m.caps {
        o.push_str(&format!("    /// {about}\n    pub {id}: bool,\n"));
    }
    o.push_str("}\n\nimpl Caps {\n");
    o.push_str("    /// Field-by-field equality usable in `const` assertions.\n");
    o.push_str("    pub const fn same_as(&self, other: &Caps) -> bool {\n        true");
    for (id, _) in &m.caps {
        o.push_str(&format!("\n            && self.{id} == other.{id}"));
    }
    o.push_str("\n    }\n\n");
    o.push_str("    /// Ids of the capabilities that are on, in YAML order.\n");
    o.push_str(
        "    pub fn enabled(&self) -> Vec<&'static str> {\n        let mut v = Vec::new();\n",
    );
    for (id, _) in &m.caps {
        o.push_str(&format!(
            "        if self.{id} {{\n            v.push(\"{id}\");\n        }}\n"
        ));
    }
    o.push_str("        v\n    }\n}\n\n");

    o.push_str("/// Every capability id, in YAML order.\n");
    o.push_str("pub const ALL_CAPABILITIES: &[&str] = &[");
    o.push_str(
        &m.caps
            .iter()
            .map(|(id, _)| format!("\"{id}\""))
            .collect::<Vec<_>>()
            .join(", "),
    );
    o.push_str("];\n\n");

    o.push_str("/// Capabilities compiled into this crate (its `cap-*` Cargo features).\n");
    o.push_str("pub const CORE_CAPS: Caps = Caps {\n");
    for (id, _) in &m.caps {
        o.push_str(&format!(
            "    {id}: cfg!(feature = \"{}\"),\n",
            cargo_feature(id)
        ));
    }
    o.push_str("};\n\n");

    for e in &m.editions {
        let s = &e.spec;
        o.push_str(&format!(
            "pub const {}: EditionSpec = EditionSpec {{\n    id: \"{}\",\n    caps: Caps {{\n",
            e.id.to_uppercase(),
            e.id
        ));
        for (id, _) in &m.caps {
            o.push_str(&format!("        {id}: {},\n", s.caps.contains(id)));
        }
        o.push_str(&format!(
            "    }},\n    limits: Limits {{\n        devices: {},\n        admins: {},\n        accounts: {},\n        doctors: {},\n    }},\n}};\n\n",
            s.devices, s.admins, s.accounts, s.doctors
        ));
    }
    o.push_str("/// Every edition, in YAML order.\npub const ALL_EDITIONS: &[EditionSpec] = &[");
    o.push_str(
        &m.editions
            .iter()
            .map(|e| e.id.to_uppercase())
            .collect::<Vec<_>>()
            .join(", "),
    );
    o.push_str("];\n");
    o
}

fn render_ts(m: &Model) -> String {
    let mut o =
        String::from("/** @generated by build.rs from config/editions.yaml — DO NOT EDIT */\n\n");
    o.push_str("export const CAPABILITY_IDS = [\n");
    for (id, _) in &m.caps {
        o.push_str(&format!("    \"{}\",\n", camel(id)));
    }
    o.push_str("] as const;\n\nexport type Capability = (typeof CAPABILITY_IDS)[number];\n");
    o.push_str("export type Caps = Record<Capability, boolean>;\n\n");
    o.push_str("export type EditionId = ");
    o.push_str(
        &m.editions
            .iter()
            .map(|e| format!("\"{}\"", e.id))
            .collect::<Vec<_>>()
            .join(" | "),
    );
    o.push_str(";\n\nexport type EditionLimits = {\n    devices: number;\n    admins: number;\n    accounts: number;\n    doctors: number;\n};\n\n");
    o.push_str(
        "export type EditionSpec = { id: EditionId; caps: Caps; limits: EditionLimits };\n\n",
    );
    o.push_str("export const EDITIONS: Record<EditionId, EditionSpec> = {\n");
    for e in &m.editions {
        let s = &e.spec;
        o.push_str(&format!(
            "    {}: {{\n        id: \"{}\",\n        caps: {{\n",
            e.id, e.id
        ));
        for (id, _) in &m.caps {
            o.push_str(&format!(
                "            {}: {},\n",
                camel(id),
                s.caps.contains(id)
            ));
        }
        o.push_str(&format!(
            "        }},\n        limits: {{ devices: {}, admins: {}, accounts: {}, doctors: {} }},\n    }},\n",
            s.devices, s.admins, s.accounts, s.doctors
        ));
    }
    o.push_str("};\n\n");
    o.push_str("/** Name of the build-time constant for a capability (`multiStaff` → `__CAP_MULTI_STAFF__`). */\n");
    o.push_str("export const capDefineName = (cap: Capability): string =>\n    `__CAP_${cap.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}__`;\n\n");
    o
}

/// Global declarations of the Vite `define` constants. A separate script file (no imports), outside
/// `lib/`: the app reaches `lib/` through a symlink too, and a module's `declare global` would then
/// be declared twice.
fn render_dts(m: &Model) -> String {
    let mut o =
        String::from("/** @generated by build.rs from config/editions.yaml — DO NOT EDIT */\n\n");
    o.push_str("// Build-time constants injected by `vite.config.ts` `define` (literal true/false, so\n// Rollup drops `if (__CAP_X__) { … }` branches and their dynamic imports).\n");
    o.push_str("declare const __MEDOC_EDITION__: import(\"./lib/edition.generated\").EditionId;\n");
    for (id, _) in &m.caps {
        o.push_str(&format!(
            "declare const __CAP_{}__: boolean;\n",
            id.to_uppercase()
        ));
    }
    o
}

#[cfg(test)]
mod tests {
    use super::*;

    const YAML: &str = "capabilities:\n  net: n\n  guest_inbox: g\n  multi_staff: m\nexclusive:\n  - [guest_inbox, multi_staff]\neditions:\n  solo: {devices: 1, admins: 1, accounts: 2, doctors: 1, caps: [guest_inbox]}\n  duo: {devices: 3, admins: 1, accounts: 3, doctors: 1, caps: [net, multi_staff]}\n";

    #[test]
    fn parses_and_renders() {
        let m = parse(YAML).unwrap();
        assert_eq!(m.caps.len(), 3);
        let rs = render_rust(&m);
        assert!(rs.contains("pub const SOLO: EditionSpec"));
        assert!(rs.contains("guest_inbox: cfg!(feature = \"cap-guest-inbox\")"));
        let ts = render_ts(&m);
        assert!(ts.contains("guestInbox: true"));
        assert!(render_dts(&m).contains("declare const __CAP_GUEST_INBOX__: boolean;"));
    }

    #[test]
    fn rejects_unknown_capability() {
        let bad = YAML.replace("caps: [guest_inbox]", "caps: [guest_inbox, nope]");
        assert!(parse(&bad)
            .err()
            .unwrap()
            .contains("unknown capability `nope`"));
    }

    #[test]
    fn rejects_exclusive_pair() {
        let bad = YAML.replace("caps: [guest_inbox]", "caps: [guest_inbox, multi_staff]");
        assert!(parse(&bad).err().unwrap().contains("exclusive"));
    }

    #[test]
    fn feature_names() {
        assert_eq!(cargo_feature("multi_staff"), "cap-multi-staff");
        assert_eq!(camel("multi_staff"), "multiStaff");
    }
}
