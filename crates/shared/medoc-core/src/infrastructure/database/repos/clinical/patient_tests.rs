use super::insurance_number_for_insert;

#[test]
fn keeps_provided_number() {
    assert_eq!(
        insurance_number_for_insert(" A123456789 ", "unused"),
        "A123456789"
    );
}

#[test]
fn synthesizes_unique_self_pay_placeholder() {
    let vn = insurance_number_for_insert("", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    assert_eq!(vn, "SELF-a1b2c3d4");
}
