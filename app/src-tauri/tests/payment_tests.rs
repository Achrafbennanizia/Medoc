// Payment adapter validation tests (FA-FIN-PAY).

use medoc_lib::infrastructure::payment::{process, PaymentMethod, PaymentRequest, PaymentStatus};

fn req(amount_cents: i64, currency: &str, method: PaymentMethod) -> PaymentRequest {
    PaymentRequest {
        invoice_id: "INV-1".into(),
        amount_cents,
        currency: currency.into(),
        method,
    }
}

#[test]
fn rejects_zero_or_negative_amount() {
    assert!(process(&req(0, "EUR", PaymentMethod::Cash)).is_err());
    assert!(process(&req(-50, "EUR", PaymentMethod::Cash)).is_err());
}

#[test]
fn rejects_non_eur_currency() {
    assert!(process(&req(100, "USD", PaymentMethod::Cash)).is_err());
    assert!(process(&req(100, "CHF", PaymentMethod::Card)).is_err());
}

#[test]
fn cash_approves_immediately() {
    let r = process(&req(2599, "EUR", PaymentMethod::Cash)).unwrap();
    assert_eq!(r.provider, "cash");
    assert!(matches!(r.status, PaymentStatus::Approved));
    assert!(r.provider_ref.starts_with("STUB-cash-"));
}

#[test]
fn card_and_sepa_remain_pending_until_terminal_wired() {
    let card = process(&req(1000, "EUR", PaymentMethod::Card)).unwrap();
    assert!(matches!(card.status, PaymentStatus::Pending));
    let sepa = process(&req(1000, "EUR", PaymentMethod::SepaTransfer)).unwrap();
    assert!(matches!(sepa.status, PaymentStatus::Pending));
}
