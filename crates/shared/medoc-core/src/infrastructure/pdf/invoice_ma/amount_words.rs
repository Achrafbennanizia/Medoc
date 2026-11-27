//! Amount in words (French and Arabic) on Moroccan invoices (split from `invoice_ma.rs`).

use super::*;

/// `125050` → "mille deux cent cinquante dirhams et cinquante centimes" (fr) or the Arabic equivalent.
pub fn amount_in_words(cents: i64, locale: &str) -> String {
    let abs = cents.unsigned_abs();
    let (dh, ct) = (abs / 100, abs % 100);
    if pdf_locale(locale) == "ar" {
        let mut s = format!("{} {}", ar_words(dh), ar_dirham(dh));
        if dh == 1 {
            s = "درهم واحد".into();
        } else if dh == 2 {
            s = "درهمان".into();
        }
        if ct > 0 {
            s.push_str(&format!(" و{} سنتيماً", ar_words(ct)));
        }
        s
    } else {
        let unit = if dh > 1 { "dirhams" } else { "dirham" };
        let de = if dh >= 1_000_000 && dh % 1_000_000 == 0 {
            "de "
        } else {
            ""
        };
        let mut s = format!("{} {de}{unit}", fr_words(dh));
        if ct > 0 {
            s.push_str(&format!(
                " et {} centime{}",
                fr_words(ct),
                if ct > 1 { "s" } else { "" }
            ));
        }
        s
    }
}

pub(super) fn fr_below_100(n: u64) -> String {
    const UNITS: [&str; 17] = [
        "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
        "onze", "douze", "treize", "quatorze", "quinze", "seize",
    ];
    const TENS: [&str; 7] = [
        "",
        "dix",
        "vingt",
        "trente",
        "quarante",
        "cinquante",
        "soixante",
    ];
    match n {
        0..=16 => UNITS[n as usize].into(),
        17..=19 => format!("dix-{}", UNITS[(n - 10) as usize]),
        20..=69 => {
            let (t, u) = (n / 10, n % 10);
            match u {
                0 => TENS[t as usize].into(),
                1 => format!("{} et un", TENS[t as usize]),
                _ => format!("{}-{}", TENS[t as usize], UNITS[u as usize]),
            }
        }
        70..=79 => {
            if n == 71 {
                "soixante et onze".into()
            } else {
                format!("soixante-{}", fr_below_100(n - 60))
            }
        }
        80 => "quatre-vingts".into(),
        _ => format!("quatre-vingt-{}", fr_below_100(n - 80)),
    }
}

pub(super) fn fr_below_1000(n: u64) -> String {
    let (h, r) = (n / 100, n % 100);
    let hundreds = match (h, r) {
        (0, _) => String::new(),
        (1, _) => "cent".into(),
        (_, 0) => format!("{} cents", fr_below_100(h)),
        _ => format!("{} cent", fr_below_100(h)),
    };
    match (hundreds.is_empty(), r) {
        (true, _) => fr_below_100(r),
        (false, 0) => hundreds,
        (false, _) => format!("{hundreds} {}", fr_below_100(r)),
    }
}

pub fn fr_words(n: u64) -> String {
    if n == 0 {
        return "zéro".into();
    }
    let mut parts = Vec::new();
    let (millions, rest) = (n / 1_000_000, n % 1_000_000);
    let (thousands, units) = (rest / 1000, rest % 1000);
    if millions > 0 {
        parts.push(format!(
            "{} million{}",
            fr_below_1000(millions),
            if millions > 1 { "s" } else { "" }
        ));
    }
    if thousands > 0 {
        // "mille" is invariable; "cents" / "vingts" lose their s before it ("deux cent mille").
        let w = fr_below_1000(thousands);
        let w = w
            .strip_suffix("cents")
            .map(|p| format!("{p}cent"))
            .or_else(|| w.strip_suffix("vingts").map(|p| format!("{p}vingt")))
            .unwrap_or(w);
        parts.push(if thousands == 1 {
            "mille".into()
        } else {
            format!("{w} mille")
        });
    }
    if units > 0 {
        parts.push(fr_below_1000(units));
    }
    parts.join(" ")
}

pub(super) const AR_ONES: [&str; 10] = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
];
pub(super) const AR_TEENS: [&str; 10] = [
    "عشرة",
    "أحد عشر",
    "اثنا عشر",
    "ثلاثة عشر",
    "أربعة عشر",
    "خمسة عشر",
    "ستة عشر",
    "سبعة عشر",
    "ثمانية عشر",
    "تسعة عشر",
];
pub(super) const AR_TENS: [&str; 10] = [
    "",
    "",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
];
pub(super) const AR_HUNDREDS: [&str; 10] = [
    "",
    "مائة",
    "مائتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
];

pub(super) fn ar_below_1000(n: u64) -> String {
    let (h, r) = ((n / 100) as usize, n % 100);
    let rest = match r {
        0 => String::new(),
        1..=9 => AR_ONES[r as usize].into(),
        10..=19 => AR_TEENS[(r - 10) as usize].into(),
        _ => {
            let (t, u) = ((r / 10) as usize, (r % 10) as usize);
            if u == 0 {
                AR_TENS[t].into()
            } else {
                format!("{} و{}", AR_ONES[u], AR_TENS[t])
            }
        }
    };
    match (h, rest.is_empty()) {
        (0, _) => rest,
        (_, true) => AR_HUNDREDS[h].into(),
        _ => format!("{} و{rest}", AR_HUNDREDS[h]),
    }
}

/// Scale word for thousands / millions: 1 → ألف, 2 → ألفان, 3–10 → آلاف, else ألف.
pub(super) fn ar_scale(count: u64, one: &str, two: &str, plural: &str) -> String {
    match count {
        1 => one.into(),
        2 => two.into(),
        3..=10 => format!("{} {plural}", ar_below_1000(count)),
        _ => format!("{} {one}", ar_below_1000(count)),
    }
}

pub fn ar_words(n: u64) -> String {
    if n == 0 {
        return "صفر".into();
    }
    let mut parts = Vec::new();
    let (millions, rest) = (n / 1_000_000, n % 1_000_000);
    let (thousands, units) = (rest / 1000, rest % 1000);
    if millions > 0 {
        parts.push(ar_scale(millions, "مليون", "مليونان", "ملايين"));
    }
    if thousands > 0 {
        parts.push(ar_scale(thousands, "ألف", "ألفان", "آلاف"));
    }
    if units > 0 {
        parts.push(ar_below_1000(units));
    }
    parts.join(" و")
}

/// Counted noun after a number: 3–10 → دراهم, 11–99 → درهماً, otherwise درهم.
pub(super) fn ar_dirham(n: u64) -> &'static str {
    match n % 100 {
        3..=10 => "دراهم",
        11..=99 => "درهماً",
        _ => "درهم",
    }
}
