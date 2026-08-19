//! Human-readable text for clinical PDF exports (anamnesis JSON, Examination V1, …).

use serde_json::Value;

fn anamnesis_label(key: &str) -> &str {
    match key {
        "insuranceStatus" => "Insurance status",
        "health_insurance" => "Health insurer",
        "chronic" => "Chronic conditions",
        "previousDiagnoses" => "Previous diagnoses",
        "surgeries" => "Surgeries",
        "hospital" => "Hospital stays",
        "mental" => "Mental health history",
        "regular" => "Regular medication",
        "dosing" => "Dosing schedule",
        "selbst" => "Self-medication / supplements",
        "vergessen" => "Missed doses",
        "sideEffects" => "Side effects",
        "medications" => "Medication allergies",
        "foods" => "Food allergies",
        "other" => "Other allergies",
        "material" => "Material intolerances",
        "vaccineReactions" => "Vaccine reactions",
        _ => key,
    }
}

fn push_section_map(lines: &mut Vec<String>, title: &str, map: &serde_json::Map<String, Value>) {
    let mut entries: Vec<(String, String)> = Vec::new();
    for (k, version) in map {
        let text = match version {
            Value::String(s) => s.trim().to_string(),
            Value::Null => String::new(),
            _ => version.to_string(),
        };
        if text.is_empty() {
            continue;
        }
        entries.push((anamnesis_label(k).to_string(), text));
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
pub fn format_anamnesis_answers(json: &str) -> Vec<String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return vec!["(none recorded)".to_string()];
    }

    let Ok(Value::Object(root)) = serde_json::from_str::<Value>(trimmed) else {
        return vec![trimmed.to_string()];
    };

    let mut lines: Vec<String> = Vec::new();

    if let Some(version) = root.get("insuranceStatus").and_then(Value::as_str) {
        let t = version.trim();
        if !t.is_empty() {
            lines.push(format!("Insurance status: {t}"));
        }
    }
    if let Some(version) = root.get("health_insurance").and_then(Value::as_str) {
        let t = version.trim();
        if !t.is_empty() {
            lines.push(format!("Health insurer: {t}"));
        }
    }
    if !lines.is_empty() {
        lines.push(String::new());
    }

    if let Some(Value::Object(m)) = root.get("preExisting") {
        push_section_map(&mut lines, "Pre-existing conditions", m);
    }
    if let Some(Value::Object(m)) = root.get("medication") {
        push_section_map(&mut lines, "Medication", m);
    }
    if let Some(Value::Object(m)) = root.get("allergies") {
        push_section_map(&mut lines, "Allergies / intolerances", m);
    }

    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    if lines.is_empty() {
        lines.push("(none recorded)".to_string());
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
    let version = value.trim();
    if !version.is_empty() {
        lines.push(format!("{label}: {version}"));
    }
}

fn is_examination_v_1(root: &serde_json::Map<String, Value>) -> bool {
    root.get("version") == Some(&Value::from(1))
        || root.contains_key("chiefComplaint")
        || root.contains_key("psi")
        || root.contains_key("diagnosis")
        || root.contains_key("extraoral")
        || root.contains_key("intraoral")
}

/// All fields from examination V1 (`results` JSON) as PDF lines.
fn examination_v_1_lines_from_json(json: &str) -> Vec<String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let Ok(Value::Object(root)) = serde_json::from_str::<Value>(trimmed) else {
        return vec![trimmed.to_string()];
    };
    if !is_examination_v_1(&root) {
        return vec![trimmed.to_string()];
    }

    let mut lines: Vec<String> = Vec::new();

    push_label_line(
        &mut lines,
        "Chief complaint",
        &str_field(&root, "chiefComplaint"),
    );

    let pain = str_field(&root, "painVas");
    let loc = str_field(&root, "painLocation");
    if !pain.is_empty() || !loc.is_empty() {
        let pain_line = format!(
            "Pain VAS {} {}",
            if pain.is_empty() { "—" } else { &pain },
            loc
        )
        .trim()
        .to_string();
        lines.push(format!("Pain: {pain_line}"));
    }

    lines.push(String::new());
    lines.push("Extraoral".into());
    for (label, val) in [
        ("Asymmetry", nested_str(&root, "extraoral", "asymmetry")),
        ("Lymph nodes", nested_str(&root, "extraoral", "lymphNodes")),
        ("TMJ", nested_str(&root, "extraoral", "tmj")),
        ("Muscles", nested_str(&root, "extraoral", "muscles")),
    ] {
        push_label_line(&mut lines, &format!("  {label}"), &val);
    }

    lines.push(String::new());
    lines.push("Intraoral".into());
    for (label, val) in [
        ("Mucosa", nested_str(&root, "intraoral", "mucosa")),
        ("Tongue", nested_str(&root, "intraoral", "tongue")),
        ("Gingiva", nested_str(&root, "intraoral", "gingiva")),
        ("Salivary glands", nested_str(&root, "intraoral", "salivary")),
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
            let version = psi
                .get(key)
                .and_then(Value::as_str)
                .map(|s| s.trim())
                .unwrap_or("");
            if !version.is_empty() {
                psi_entries.push(format!("{label}: {version}"));
            }
        }
        if !psi_entries.is_empty() {
            lines.push(String::new());
            lines.push("Periodontal status (PSI)".into());
            lines.extend(psi_entries);
        }
    }

    let bop = str_field(&root, "bopPercent");
    let plaque = str_field(&root, "plaqueIndex");
    let hygiene = str_field(&root, "hygieneScore");
    if !bop.is_empty() || !plaque.is_empty() || !hygiene.is_empty() {
        lines.push(String::new());
        lines.push("Periodontal metrics".into());
        push_label_line(&mut lines, "  BOP", &bop);
        push_label_line(&mut lines, "  Plaque-Index", &plaque);
        push_label_line(&mut lines, "  Oral hygiene", &hygiene);
    }

    lines.push(String::new());
    lines.push("Function / occlusion".into());
    for (label, val) in [
        ("CMD", nested_str(&root, "function", "cmd")),
        ("Bruxismus", nested_str(&root, "function", "bruxism")),
        ("Splint", nested_str(&root, "function", "splint")),
        ("Notes", nested_str(&root, "function", "notes")),
    ] {
        push_label_line(&mut lines, &format!("  {label}"), &val);
    }

    let img_ordered = nested_str(&root, "imaging", "ordered");
    let img_findings = nested_str(&root, "imaging", "findings");
    if !img_ordered.is_empty() || !img_findings.is_empty() {
        lines.push(String::new());
        lines.push("Imaging".into());
        push_label_line(&mut lines, "  Ordered", &img_ordered);
        push_label_line(&mut lines, "  Finding", &img_findings);
    }

    lines.push(String::new());
    push_label_line(&mut lines, "Diagnosis", &str_field(&root, "diagnosis"));
    push_label_line(&mut lines, "Treatment plan", &str_field(&root, "plan"));

    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    lines
}

/// Full examination data for record PDF (multiline, all V1 fields).
pub fn format_examination_detail_lines(
    chief_complaint: Option<&str>,
    results_json: Option<&str>,
    diagnosis_spalte: Option<&str>,
) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    if let Some(b) = chief_complaint.filter(|s| !s.trim().is_empty()) {
        let t = normalize_whitespace_for_pdf(b);
        if !t.is_empty() && t != "—" {
            push_label_line(&mut lines, "Chief complaint (chart)", &t);
        }
    }

    if let Some(json) = results_json.filter(|s| !s.trim().is_empty()) {
        if !lines.is_empty() {
            lines.push(String::new());
        }
        lines.extend(examination_v_1_lines_from_json(json));
    }

    if let Some(d) = diagnosis_spalte.filter(|s| !s.trim().is_empty() && s.trim() != "-") {
        let t = normalize_whitespace_for_pdf(d);
        let already = lines.iter().any(|l| l.starts_with("Diagnosis:"));
        if !already && !t.is_empty() {
            if !lines.is_empty() {
                lines.push(String::new());
            }
            push_label_line(&mut lines, "Diagnosis (column)", &t);
        }
    }

    while lines.last().map(|s| s.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    if lines.is_empty() {
        lines.push("(no examination data)".into());
    }
    lines
}

/// Multiline cell text for the record table (line breaks between sections).
pub fn format_examination_for_chart_table(
    chief_complaint: Option<&str>,
    results_json: Option<&str>,
    diagnosis_spalte: Option<&str>,
) -> String {
    format_examination_detail_lines(chief_complaint, results_json, diagnosis_spalte).join("\n")
}

/// Short summary of examination V1 (`results` JSON) for tables and prose.
pub fn format_examination_results(json: &str) -> String {
    let lines = examination_v_1_lines_from_json(json);
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

/// Convert cell/field text: structured JSON → readable line(s).
pub fn plain_text_for_pdf(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return "—".to_string();
    }
    let text = if t.starts_with('{') {
        if let Ok(version) = serde_json::from_str::<Value>(t) {
            if version.get("insuranceStatus").is_some()
                || version.get("allergies").is_some()
                || version.get("preExisting").is_some()
            {
                format_anamnesis_answers(t).join("\n")
            } else if (version.get("version") == Some(&Value::from(1))
                && version.get("chiefComplaint").is_some())
                || version.get("psi").is_some()
                || version.get("diagnosis").is_some()
            {
                format_examination_results(t)
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
    fn anamnesis_formats_sections_not_raw_json() {
        let json =
            r#"{"version":1,"insuranceStatus":"GKV","allergies":{"medications":"Penicillin"}}"#;
        let lines = format_anamnesis_answers(json);
        let joined = lines.join("\n");
        assert!(joined.contains("Insurance status: GKV"));
        assert!(joined.contains("Medication allergies: Penicillin"));
        assert!(!joined.contains("\"allergies\""));
    }

    #[test]
    fn plain_text_normalizes_nbsp_and_blank_runs() {
        assert_eq!(plain_text_for_pdf("Hallo\u{00A0}Welt"), "Hallo Welt");
        assert_eq!(plain_text_for_pdf("A\n\n\n\n\nB"), "A\n\nB");
    }

    #[test]
    fn examination_summary_from_v_1_json() {
        let json = r#"{"version":1,"chiefComplaint":"Schmerz","diagnosis":"Karies"}"#;
        let s = format_examination_results(json);
        assert!(s.contains("Chief complaint"));
        assert!(s.contains("Karies"));
    }

    #[test]
    fn examination_detail_includes_psi_and_function() {
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
        let lines = format_examination_detail_lines(None, Some(json), None);
        let joined = lines.join("\n");
        for needle in [
            "Periodontal status (PSI)",
            "Sextant I: 2",
            "Sextant III: 4",
            "BOP",
            "CMD: Klicken rechts",
            "Bruxismus: ja",
            "Ordered: OPG",
            "Treatment plan: PZR",
        ] {
            assert!(joined.contains(needle), "missing {needle}");
        }
    }

    #[test]
    fn examination_for_chart_table_uses_newlines() {
        let json = r#"{"version":1,"diagnosis":"Karies","psi":{"s2":"1"}}"#;
        let cell = format_examination_for_chart_table(None, Some(json), None);
        assert!(cell.contains('\n'));
        assert!(cell.contains("Sextant II: 1"));
    }
}
