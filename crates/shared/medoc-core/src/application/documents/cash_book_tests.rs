use super::*;

#[test]
fn euro_formatting() {
    assert_eq!(fmt_eur(0), "0.00 EUR");
    assert_eq!(fmt_eur(123456), "1,234.56 EUR");
    assert_eq!(fmt_eur(-5), "-0.05 EUR");
    assert_eq!(fmt_eur(100_000_000), "1,000,000.00 EUR");
    assert_eq!(fmt_eur(euros_to_cents(12.345)), "12.35 EUR");
}

#[test]
fn denominations_sum_and_validate() {
    let mut d = BTreeMap::new();
    d.insert("5000".into(), 2);
    d.insert("200".into(), 3);
    let args = CloseDayArgs {
        denominations: Some(d.clone()),
        ..Default::default()
    };
    assert_eq!(counted_from_args(&args).unwrap().0, 10600);
    let bad = CloseDayArgs {
        denominations: Some(d),
        counted_cents: Some(1),
        ..Default::default()
    };
    assert!(counted_from_args(&bad).is_err());
    let none = CloseDayArgs::default();
    assert!(counted_from_args(&none).is_err(), "a count is mandatory");
}
