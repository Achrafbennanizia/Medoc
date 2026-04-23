use medoc_lib::infrastructure::logging::brute_force::{BruteForceTracker, CheckResult};

#[test]
fn locks_out_after_six_failures() {
    let t = BruteForceTracker::new();
    for _ in 0..5 {
        assert!(matches!(t.check("1.2.3.4"), CheckResult::Allowed));
        assert!(!t.record_failure("1.2.3.4"));
    }
    // 6th failure trips the lockout
    assert!(t.record_failure("1.2.3.4"));
    assert!(matches!(t.check("1.2.3.4"), CheckResult::Locked { .. }));
}

#[test]
fn other_ip_unaffected() {
    let t = BruteForceTracker::new();
    for _ in 0..6 {
        t.record_failure("1.2.3.4");
    }
    assert!(matches!(t.check("9.9.9.9"), CheckResult::Allowed));
}

#[test]
fn success_clears_state() {
    let t = BruteForceTracker::new();
    for _ in 0..3 {
        t.record_failure("5.5.5.5");
    }
    t.record_success("5.5.5.5");
    // Should be able to fail 5 more times before lockout
    for _ in 0..5 {
        assert!(!t.record_failure("5.5.5.5"));
    }
}
