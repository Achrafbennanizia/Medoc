//! Human-readable text for clinical PDF exports (anamnese JSON, Untersuchung V1, …).

use serde_json::Value;

fn anamnese_label(key: &str) -> &str {
    match key {
        "versicherungsstatus" => "Versicherungsstatus",
        "krankenkasse" => "Krankenkasse / Versicherer",
        "chronisch" => "Chronische Erkrankungen",
        "frueherDiagnosen" => "Frühere Diagnosen",
        "operationen" => "Operationen",
        "krankenhaus" => "Krankenhausaufenthalte",
        "psychisch" => "Psychische Vorgeschichte",
        "regelmaessig" => "Regelmäßige Medikation",
        "einnahme" => "Einnahmeschema",
        "selbst" => "Selbstmedikation / Nahrungsergänzung",
        "vergessen" => "Vergessene Einnahmen",
        "nebenwirkungen" => "Nebenwirkungen",
        "medikamente" => "Medikamentenallergien",
        "lebensmittel" => "Lebensmittelallergien",
        "sonstige" => "Sonstige Allergien",
        "material" => "Materialunverträglichkeiten",
        "impfreaktionen" => "Impfreaktionen",
        _ => key,
    }
}

fn push_section_map(lines: &mut Vec<String>, title: &str, map: &serde_json::Map<String, Value>) {
    let mut entries: Vec<(String, String)> = Vec::new();
    for (k, v) in map {
        let text = match v {
            Value::String(s) => s.trim().to_string(),
            Value::Null => String::new(),
            _ => v.to_string(),
        };
        if text.is_empty() {
            continue;
        }
        entries.push((anamnese_label(k).to_string(), text));
    }
    if entries.is_empty() {
        return;
    }
    lines.push(title.to_string());
    for (label, text) in entries {
        lines.push(format!("  {label}: {text}"));
    }
    lines.push(String::new());
}

/// Format stored anamnesis JSON (V1) for PDF/record — no raw JSON lines.
pub fn format_anamnese_antworten(json: &str) -> Vec<String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return vec!["(keine Angaben)".to_string()];
    }

    let Ok(Value::Object(root)) = serde_json::from_str::<Value>(trimmed) else {
        return vec![trimmed.to_string()];
    };

    let mut lines: Vec<String> = Vec::new();

    if let Some(v) = root.get("versicherungsstatus").and_then(Value::as_str) {
        let t = v.trim();
        if !t.is_empty() {
            lines.push(format!("Versicherungsstatus: {t}"));
        }
    }
    if let Some(v) = root.get("krankenkasse").and_then(Value::as_str) {
        let t = v.trim();
        if !t.is_empty() {
            lines.push(format!("Krankenkasse / Versicherer: {t}"));
        }
    }
    if !lines.is_empty() {
        lines.push(String::new());
    }

    if let Some(Value::Object(m)) = root.get("vorerkrankungen") {
        push_section_map(&mut lines, "Vorerkrankungen", m);
    }
    if let Some(Value::Object(m)) = root.get("medikation") {
        push_section_map(&mut lines, "Medikation", m);
    }
    if let Some(Value::Object(m)) = root.get("allergien") {
        push_section_map(&mut lines, "Allergien / Unverträglichkeiten", m);
    }

    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    if lines.is_empty() {
        lines.push("(keine Angaben)".to_string());
    }
    lines
}

fn str_field(obj: &serde_json::Map<String, Value>, key: &str) -> String {
    obj.get(key)
        .and_then(Value::as_str)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn nested_str(obj: &serde_json::Map<String, Value>, group: &str, key: &str) -> String {
    obj.get(group)
        .and_then(Value::as_object)
        .map(|m| str_field(m, key))
        .unwrap_or_default()
}

fn push_label_line(lines: &mut Vec<String>, label: &str, value: &str) {
    let v = value.trim();
    if !v.is_empty() {
        lines.push(format!("{label}: {v}"));
    }
}

fn is_untersuchung_v1(root: &serde_json::Map<String, Value>) -> bool {
    root.get("version") == Some(&Value::from(1))
        || root.contains_key("chiefComplaint")
        || root.contains_key("psi")
        || root.contains_key("diagnosis")
        || root.contains_key("extraoral")
        || root.contains_key("intraoral")
}

/// All fields from examination V1 (`ergebnisse` JSON) as PDF lines.
fn untersuchung_v1_lines_from_json(json: &str) -> Vec<String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let Ok(Value::Object(root)) = serde_json::from_str::<Value>(trimmed) else {
        return vec![trimmed.to_string()];
    };
    if !is_untersuchung_v1(&root) {
        return vec![trimmed.to_string()];
    }

    let mut lines: Vec<String> = Vec::new();

    push_label_line(
        &mut lines,
        "Hauptbeschwerde",
        &str_field(&root, "chiefComplaint"),
    );

    let pain = str_field(&root, "painVas");
    let loc = str_field(&root, "painLocation");
    if !pain.is_empty() || !loc.is_empty() {
        let schmerz = format!(
            "Schmerz VAS {} {}",
            if pain.is_empty() { "—" } else { &pain },
            loc
        )
        .trim()
        .to_string();
        lines.push(format!("Schmerz: {schmerz}"));
    }

    lines.push(String::new());
    lines.push("Extraoral".into());
    for (label, val) in [
        ("Asymmetrie", nested_str(&root, "extraoral", "asymmetry")),
        ("Lymphknoten", nested_str(&root, "extraoral", "lymphNodes")),
        ("Kiefergelenk", nested_str(&root, "extraoral", "tmj")),
        ("Muskulatur", nested_str(&root, "extraoral", "muscles")),
    ] {
        push_label_line(&mut lines, &format!("  {label}"), &val);
    }

    lines.push(String::new());
    lines.push("Intraoral".into());
    for (label, val) in [
        ("Mukosa", nested_str(&root, "intraoral", "mucosa")),
        ("Zunge", nested_str(&root, "intraoral", "tongue")),
        ("Gingiva", nested_str(&root, "intraoral", "gingiva")),
        ("Speicheldrüsen", nested_str(&root, "intraoral", "salivary")),
    ] {
        push_label_line(&mut lines, &format!("  {label}"), &val);
    }

    if let Some(Value::Object(psi)) = root.get("psi") {
        let mut psi_entries: Vec<String> = Vec::new();
        for (key, label) in [
            ("s1", "Sextant I"),
            ("s2", "Sextant II"),
            ("s3", "Sextant III"),
            ("s4", "Sextant IV"),
            ("s5", "Sextant V"),
            ("s6", "Sextant VI"),
        ] {
            let v = psi
                .get(key)
                .and_then(Value::as_str)
                .map(|s| s.trim())
                .unwrap_or("");
            if !v.is_empty() {
                psi_entries.push(format!("{label}: {v}"));
            }
        }
        if !psi_entries.is_empty() {
            lines.push(String::new());
            lines.push("Parodontalstatus (PSI)".into());
            lines.extend(psi_entries);
        }
    }

    let bop = str_field(&root, "bopPercent");
    let plaque = str_field(&root, "plaqueIndex");
    let hygiene = str_field(&root, "hygieneScore");
    if !bop.is_empty() || !plaque.is_empty() || !hygiene.is_empty() {
        lines.push(String::new());
        lines.push("Parodontal — Kennzahlen".into());
        push_label_line(&mut lines, "  BOP", &bop);
        push_label_line(&mut lines, "  Plaque-Index", &plaque);
        push_label_line(&mut lines, "  Mundhygiene", &hygiene);
    }

    lines.push(String::new());
    lines.push("Funktion / Okklusion".into());
    for (label, val) in [
        ("CMD", nested_str(&root, "function", "cmd")),
        ("Bruxismus", nested_str(&root, "function", "bruxism")),
        ("Schiene", nested_str(&root, "function", "splint")),
        ("Notizen", nested_str(&root, "function", "notes")),
    ] {
        push_label_line(&mut lines, &format!("  {label}"), &val);
    }

    let img_ordered = nested_str(&root, "imaging", "ordered");
    let img_findings = nested_str(&root, "imaging", "findings");
    if !img_ordered.is_empty() || !img_findings.is_empty() {
        lines.push(String::new());
        lines.push("Bildgebung".into());
        push_label_line(&mut lines, "  Verordnet", &img_ordered);
        push_label_line(&mut lines, "  Befund", &img_findings);
    }

    lines.push(String::new());
    push_label_line(&mut lines, "Diagnose", &str_field(&root, "diagnosis"));
    push_label_line(&mut lines, "Therapieplan", &str_field(&root, "plan"));

    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    lines
}

/// Full examination data for record PDF (multiline, all V1 fields).
pub fn format_untersuchung_detail_lines(
    beschwerden: Option<&str>,
    ergebnisse_json: Option<&str>,
    diagnose_spalte: Option<&str>,
) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    if let Some(b) = beschwerden.filter(|s| !s.trim().is_empty()) {
        let t = normalize_whitespace_for_pdf(b);
        if !t.is_empty() && t != "—" {
            push_label_line(&mut lines, "Beschwerden (Akte)", &t);
        }
    }

    if let Some(json) = ergebnisse_json.filter(|s| !s.trim().is_empty()) {
        if !lines.is_empty() {
            lines.push(String::new());
        }
        lines.extend(untersuchung_v1_lines_from_json(json));
    }

    if let Some(d) = diagnose_spalte.filter(|s| !s.trim().is_empty() && s.trim() != "-") {
        let t = normalize_whitespace_for_pdf(d);
        let already = lines.iter().any(|l| l.starts_with("Diagnose:"));
        if !already && !t.is_empty() {
            if !lines.is_empty() {
                lines.push(String::new());
            }
            push_label_line(&mut lines, "Diagnose (Spalte)", &t);
        }
    }

    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    if lines.is_empty() {
        lines.push("(keine Untersuchungsdaten)".into());
    }
    lines
}

/// Multiline cell text for the record table (line breaks between sections).
pub fn format_untersuchung_for_akte_table(
    beschwerden: Option<&str>,
    ergebnisse_json: Option<&str>,
    diagnose_spalte: Option<&str>,
) -> String {
    format_untersuchung_detail_lines(beschwerden, ergebnisse_json, diagnose_spalte).join("\n")
}

/// Short summary of examination V1 (`ergebnisse` JSON) for tables and prose.
pub fn format_untersuchung_ergebnisse(json: &str) -> String {
    let lines = untersuchung_v1_lines_from_json(json);
    if lines.is_empty() {
        return "—".to_string();
    }
    if lines.len() == 1 {
        return lines[0].clone();
    }
    lines
        .iter()
        .filter(|l| !l.is_empty())
        .map(|l| l.as_str())
        .collect::<Vec<_>>()
        .join(" · ")
}

/// Normalize whitespace for PDF display (Word smart quotes, NBSP, blank lines).
fn normalize_whitespace_for_pdf(input: &str) -> String {
    let cleaned: String = input
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\u{00A0}', " ");

    let mut lines: Vec<String> = Vec::new();
    let mut prev_blank = false;
    for line in cleaned.split('\n') {
        let trimmed = line.trim_end().to_string();
        let is_blank = trimmed.is_empty();
        if is_blank && prev_blank {
            continue;
        }
        lines.push(trimmed);
        prev_blank = is_blank;
    }
    while lines.first().map(|s| s.is_empty()).unwrap_or(false) {
        lines.remove(0);
    }
    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    lines.join("\n")
}

/// Wandelt Zell-/Feldtext um: strukturiertes JSON → lesbare Zeile(n).
pub fn plain_text_for_pdf(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return "—".to_string();
    }
    let text = if t.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<Value>(t) {
            if v.get("versicherungsstatus").is_some()
                || v.get("allergien").is_some()
                || v.get("vorerkrankungen").is_some()
            {
                format_anamnese_antworten(t).join("\n")
            } else if (v.get("version") == Some(&Value::from(1))
                && v.get("chiefComplaint").is_some())
                || v.get("psi").is_some()
                || v.get("diagnosis").is_some()
            {
                format_untersuchung_ergebnisse(t)
            } else {
                t.to_string()
            }
        } else {
            t.to_string()
        }
    } else {
        t.to_string()
    };
    let normalized = normalize_whitespace_for_pdf(&text);
    if normalized.is_empty() {
        "—".to_string()
    } else {
        normalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anamnese_formats_sections_not_raw_json() {
        let json =
            r#"{"version":1,"versicherungsstatus":"GKV","allergien":{"medikamente":"Penicillin"}}"#;
        let lines = format_anamnese_antworten(json);
        let joined = lines.join("\n");
        assert!(joined.contains("Versicherungsstatus: GKV"));
        assert!(joined.contains("Medikamentenallergien: Penicillin"));
        assert!(!joined.contains("\"allergien\""));
    }

    #[test]
    fn plain_text_normalizes_nbsp_and_blank_runs() {
        assert_eq!(plain_text_for_pdf("Hallo\u{00A0}Welt"), "Hallo Welt");
        assert_eq!(plain_text_for_pdf("A\n\n\n\n\nB"), "A\n\nB");
    }

    #[test]
    fn untersuchung_summary_from_v1_json() {
        let json = r#"{"version":1,"chiefComplaint":"Schmerz","diagnosis":"Karies"}"#;
        let s = format_untersuchung_ergebnisse(json);
        assert!(s.contains("Hauptbeschwerde"));
        assert!(s.contains("Karies"));
    }

    #[test]
    fn untersuchung_detail_includes_psi_and_function() {
        let json = r#"{
            "version": 1,
            "chiefComplaint": "Empfindlichkeit",
            "psi": { "s1": "2", "s3": "4" },
            "bopPercent": "22",
            "function": { "cmd": "Klicken rechts", "bruxism": "ja" },
            "imaging": { "ordered": "OPG", "findings": "kein Pathologie" },
            "diagnosis": "Gingivitis",
            "plan": "PZR"
        }"#;
        let lines = format_untersuchung_detail_lines(None, Some(json), None);
        let joined = lines.join("\n");
        for needle in [
            "Parodontalstatus (PSI)",
            "Sextant I: 2",
            "Sextant III: 4",
            "BOP",
            "CMD: Klicken rechts",
            "Bruxismus: ja",
            "Verordnet: OPG",
            "Therapieplan: PZR",
        ] {
            assert!(joined.contains(needle), "missing {needle}");
        }
    }

    #[test]
    fn untersuchung_for_akte_table_uses_newlines() {
        let json = r#"{"version":1,"diagnosis":"Karies","psi":{"s2":"1"}}"#;
        let cell = format_untersuchung_for_akte_table(None, Some(json), None);
        assert!(cell.contains('\n'));
        assert!(cell.contains("Sextant II: 1"));
    }
}
