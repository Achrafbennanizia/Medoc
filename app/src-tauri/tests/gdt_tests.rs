use medoc_lib::infrastructure::devices::gdt;

#[test]
fn parses_minimal_gdt_record() {
    // 7 + len + CRLF; lengths checked by hand.
    let body = "01380006103\r\n0163000PAT-001\r\n0193101Mustermann\r\n0153102Maxime\r\n";
    let r = gdt::parse(body);
    assert_eq!(r.satzart.as_deref(), Some("6103"));
    assert_eq!(r.patient_id.as_deref(), Some("PAT-001"));
    assert_eq!(r.patient_name.as_deref(), Some("Mustermann"));
    assert_eq!(r.patient_first_name.as_deref(), Some("Maxime"));
    assert_eq!(r.raw_lines.len(), 4);
}

#[test]
fn ignores_short_lines_and_unknown_fields() {
    let body = "abc\r\n0179999unbekannt\r\n";
    let r = gdt::parse(body);
    assert!(r.satzart.is_none());
    assert_eq!(r.raw_lines.len(), 1);
    assert_eq!(r.raw_lines[0].0, "9999");
}

#[test]
fn build_emits_well_formed_lines() {
    let out = gdt::build("6300", "PAT-1", "Mustermann");
    assert!(out.contains("8000"));
    assert!(out.contains("3000PAT-1"));
    assert!(out.contains("3101Mustermann"));
    for line in out.split("\r\n").filter(|s| !s.is_empty()) {
        let len: usize = line[..3].parse().unwrap();
        assert_eq!(
            len,
            line.len() + 2,
            "length field must include trailing CRLF"
        );
    }
}
