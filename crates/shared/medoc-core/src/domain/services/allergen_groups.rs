//! Drug groups for the allergy check: an allergy recorded as the group ("Penicillin", "NSAID")
//! or as one member ("Ibuprofen") also covers the other members. A short, conservative list of
//! groups that matter in dental prescribing; it does not replace a drug database.

/// (group names a patient may write, members as active substances). All lowercase, no accents.
const GROUPS: &[(&[&str], &[&str])] = &[
    (
        &["penicillin", "penicilline", "beta-lactam", "betalactam"],
        &[
            "penicillin",
            "amoxicillin",
            "amoxicilline",
            "ampicillin",
            "phenoxymethylpenicillin",
            "benzylpenicillin",
            "flucloxacillin",
            "piperacillin",
            "sultamicillin",
        ],
    ),
    (
        &["cephalosporin", "cephalosporine"],
        &[
            "cefuroxim",
            "cefalexin",
            "cefaclor",
            "cefadroxil",
            "cefixim",
            "cefpodoxim",
        ],
    ),
    (
        &["nsaid", "nsar", "ains", "nonsteroidal", "antiphlogistika"],
        &[
            "ibuprofen",
            "diclofenac",
            "naproxen",
            "ketoprofen",
            "dexketoprofen",
            "indometacin",
            "acetylsalicyl",
            "aspirin",
            "celecoxib",
            "etoricoxib",
            "meloxicam",
            "piroxicam",
        ],
    ),
    (
        &["macrolide", "makrolid", "macrolid"],
        &[
            "clarithromycin",
            "erythromycin",
            "azithromycin",
            "roxithromycin",
        ],
    ),
    (
        &["lincosamide", "lincosamid"],
        &["clindamycin", "lincomycin"],
    ),
    (
        &["sulfonamide", "sulfonamid", "sulfa"],
        &["sulfamethoxazol", "cotrimoxazol"],
    ),
    (
        &["tetracycline", "tetracyclin"],
        &["doxycyclin", "minocyclin", "tetracyclin"],
    ),
    (
        &[
            "local anaesthetic",
            "local anesthetic",
            "lokalanasthetik",
            "anesthesique local",
        ],
        &[
            "articain",
            "lidocain",
            "mepivacain",
            "prilocain",
            "bupivacain",
        ],
    ),
    (
        &["opioid", "opiate", "opiat"],
        &[
            "codein",
            "tramadol",
            "tilidin",
            "morphin",
            "oxycodon",
            "dihydrocodein",
        ],
    ),
];

/// Short names that only ever mean one group member.
const ALIASES: &[(&str, &str)] = &[("ass", "acetylsalicyl"), ("asa", "acetylsalicyl")];

/// True when both normalized texts name the same drug group (a group name or one of its members).
pub(crate) fn share_group(substance: &str, allergen: &str) -> bool {
    let substance = expand_alias(substance);
    let allergen = expand_alias(allergen);
    GROUPS.iter().any(|(names, members)| {
        let in_group = |text: &str| {
            names.iter().any(|n| text.contains(n)) || members.iter().any(|m| text.contains(m))
        };
        members.iter().any(|m| substance.contains(m)) && in_group(&allergen)
    })
}

fn expand_alias(text: &str) -> String {
    let words: Vec<&str> = text
        .split(' ')
        .map(|w| {
            ALIASES
                .iter()
                .find(|(alias, _)| *alias == w)
                .map(|(_, full)| *full)
                .unwrap_or(w)
        })
        .collect();
    words.join(" ")
}

#[cfg(test)]
mod tests {
    use super::share_group;

    #[test]
    fn member_and_group_name_share_a_group() {
        assert!(share_group("amoxicillin", "penicillin"));
        assert!(share_group("ibuprofen", "nsar"));
        assert!(share_group("ibuprofen", "ass"));
        assert!(share_group("articain", "lokalanasthetika"));
    }

    #[test]
    fn unrelated_or_reversed_do_not() {
        assert!(!share_group("paracetamol", "penicillin"));
        assert!(!share_group("metronidazol", "nsaid"));
        // A group name alone as the substance is not a prescribed member.
        assert!(!share_group("latex", "penicillin"));
    }
}
