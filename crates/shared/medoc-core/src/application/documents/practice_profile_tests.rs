use super::*;

#[test]
fn letterhead_matches_official_form() {
    let profile = PracticeProfile {
        name: "Praxis".into(),
        addr: "Street 1\n12345 City".into(),
        phone: Some("030 1".into()),
        fax: Some("030 2".into()),
        email: Some("a@b.de".into()),
        clinician_name: Some("Dr. Anna Berger".into()),
        professional_title: Some("Zahnärztin".into()),
        bsnr: Some("123456789".into()),
        zanr: Some("987654321".into()),
        ..PracticeProfile::default()
    };
    assert_eq!(
        profile.letterhead_lines(),
        vec![
            "Praxis".to_string(),
            "Street 1".to_string(),
            "12345 City".to_string(),
            "Tel. 030 1".to_string(),
            "Fax 030 2".to_string(),
            "a@b.de".to_string(),
            "BSNR 123456789".to_string(),
            "ZANR 987654321".to_string(),
        ]
    );
    assert!(profile
        .document_address_lines()
        .iter()
        .any(|line| line == "Fax 030 2"));
    assert!(!profile
        .document_address_lines()
        .iter()
        .any(|line| line == "Praxis"));
    let footer = profile.footer_lines("de");
    assert!(footer
        .iter()
        .any(|line| line.starts_with("Praxis · Street 1, 12345 City")));
    assert_eq!(
        profile.signature_lines(),
        vec![
            "Dr. Anna Berger".to_string(),
            "Zahnärztin".to_string(),
            "ZANR 987654321 · BSNR 123456789".to_string(),
        ]
    );
}

#[test]
fn saved_header_order_replaces_the_official_letterhead() {
    let profile = PracticeProfile {
        name: "Praxis".into(),
        addr: "Street 1".into(),
        phone: Some("030 1".into()),
        clinician_name: Some("Dr. Anna Berger".into()),
        professional_title: Some("Zahnärztin".into()),
        tax_number: Some("12/345".into()),
        header_rows: vec![
            [Some("clinician".into()), Some("phone".into())],
            [Some("name".into()), None],
        ],
        ..PracticeProfile::default()
    };
    assert_eq!(
        profile.letterhead_lines(),
        vec![
            "Dr. Anna Berger".to_string(),
            "Zahnärztin".to_string(),
            "Tel. 030 1".to_string(),
            "Praxis".to_string(),
        ]
    );
    assert_eq!(
        profile.document_address_lines(),
        vec![
            "Dr. Anna Berger".to_string(),
            "Zahnärztin".to_string(),
            "Tel. 030 1".to_string(),
        ]
    );
    assert_eq!(
        parse_header_rows(r#"{"fields":["zanr","name","nope","name"]}"#),
        vec![[Some("zanr".to_string()), Some("name".to_string())]]
    );
    assert_eq!(
        parse_header_rows(r#"{"rows":[["phone",null],["nope","fax"],["fax"]]}"#),
        vec![
            [Some("phone".to_string()), None],
            [None, Some("fax".to_string())],
        ]
    );
    assert!(parse_header_rows("not json").is_empty());
}
