//! Does a prescribed active substance match one of the patient's recorded allergies?
//!
//! Pure rules, no I/O. The allergies come from the anamnesis form (`answers` JSON), either the
//! current shape `{"allergies": {"medications": "Penicillin", "other": "…"}}` or the older
//! `{"allergies": "Penicillin"}`. A substance matches an allergen when one names the other
//! ("Amoxicillin" / "amoxicillin trihydrate") or both belong to the same drug group
//! ("Penicillin" allergy / "Amoxicillin"), see [`super::allergen_groups`].

use serde_json::Value;

use super::allergen_groups::share_group;

/// The substance being prescribed and the recorded allergy it matches.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AllergyConflict {
    pub substance: String,
    pub allergen: String,
}

/// Entries that mean "no allergy recorded" (en, de, fr).
const NONE_WORDS: &[&str] = &[
    "none",
    "none known",
    "no",
    "n/a",
    "na",
    "nkda",
    "nka",
    "-",
    "keine",
    "keine bekannt",
    "nein",
    "aucune",
    "aucun",
    "non",
];

/// Shorter fragments are too generic to compare by name ("ass" is handled by the groups).
const MIN_NAME_LEN: usize = 4;

/// Every allergen the patient's anamnesis lists, one entry per item ("Penicillin, Latex" → 2).
pub fn allergens_from_anamnesis(answers_json: &str) -> Vec<String> {
    let Ok(root) = serde_json::from_str::<Value>(answers_json) else {
        return Vec::new();
    };
    let mut texts: Vec<&str> = Vec::new();
    match root.get("allergies") {
        Some(Value::String(s)) => texts.push(s),
        Some(Value::Object(map)) => texts.extend(map.values().filter_map(Value::as_str)),
        _ => {}
    }
    texts
        .into_iter()
        .flat_map(split_items)
        .filter(|item| !NONE_WORDS.contains(&normalize(item).as_str()))
        .collect()
}

/// First allergen the substance (or any part of a combination such as
/// "Amoxicillin + Clavulanic acid") matches.
pub fn find_conflict(substance: &str, allergens: &[String]) -> Option<AllergyConflict> {
    let parts: Vec<String> = split_items(substance)
        .flat_map(|p| {
            p.split('+')
                .map(str::trim)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|p| !p.is_empty())
        .collect();
    for allergen in allergens {
        let a = normalize(allergen);
        if a.is_empty() {
            continue;
        }
        for part in &parts {
            let s = normalize(part);
            if names_match(&s, &a) || share_group(&s, &a) {
                return Some(AllergyConflict {
                    substance: part.clone(),
                    allergen: allergen.clone(),
                });
            }
        }
    }
    None
}

fn names_match(substance: &str, allergen: &str) -> bool {
    let long_enough = |x: &str| x.chars().count() >= MIN_NAME_LEN;
    (long_enough(allergen) && substance.contains(allergen))
        || (long_enough(substance) && allergen.contains(substance))
}

fn split_items(text: &str) -> impl Iterator<Item = String> + '_ {
    text.split([',', ';', '/', '\n'])
        .flat_map(|s| {
            s.split(" and ")
                .flat_map(|x| x.split(" und "))
                .flat_map(|x| x.split(" et "))
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Lowercase, ASCII letters for German/French accents, single spaces.
pub(crate) fn normalize(text: &str) -> String {
    let folded: String = text
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'ä' => 'a',
            'ö' => 'o',
            'ü' => 'u',
            'ß' => 's',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'à' | 'â' => 'a',
            'î' | 'ï' => 'i',
            'ô' => 'o',
            'ç' => 'c',
            c if c.is_alphanumeric() || c == ' ' || c == '-' => c,
            _ => ' ',
        })
        .collect();
    folded.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allergens(json: &str) -> Vec<String> {
        allergens_from_anamnesis(json)
    }

    #[test]
    fn reads_current_and_old_anamnesis_shapes() {
        assert_eq!(
            allergens(
                r#"{"allergies":{"medications":"Penicillin, Ibuprofen","material":"Latex"}}"#
            )
            .len(),
            3
        );
        assert_eq!(
            allergens(r#"{"allergies":"Penicillin"}"#),
            vec!["Penicillin"]
        );
        assert!(allergens(r#"{"allergies":{"medications":"None known"}}"#).is_empty());
        assert!(allergens(r#"{"allergies":"Keine"}"#).is_empty());
        assert!(allergens("not json").is_empty());
    }

    #[test]
    fn same_substance_matches_by_name() {
        let a = allergens(r#"{"allergies":{"medications":"Ibuprofen"}}"#);
        let hit = find_conflict("Ibuprofen 400 mg", &a).expect("conflict");
        assert_eq!(hit.allergen, "Ibuprofen");
        assert!(find_conflict("Paracetamol", &a).is_none());
    }

    #[test]
    fn drug_group_matches_member() {
        let a = allergens(r#"{"allergies":{"medications":"Penicillin"}}"#);
        let hit = find_conflict("Amoxicillin + Clavulansäure", &a).expect("conflict");
        assert_eq!(hit.substance, "Amoxicillin");
        let nsaid = allergens(r#"{"allergies":{"medications":"NSAID"}}"#);
        assert!(find_conflict("Diclofenac", &nsaid).is_some());
        assert!(find_conflict("Paracetamol", &nsaid).is_none());
    }

    #[test]
    fn short_fragments_do_not_match_by_name() {
        let a = vec!["Iod".to_string()];
        assert!(find_conflict("Povidone iodine", &a).is_none());
    }
}
