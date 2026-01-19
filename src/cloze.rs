use regex::Regex;
use std::sync::LazyLock;

/// Regex for matching cloze deletions: {{c1::text}} or {{c1::text::hint}}
static CLOZE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\{\{c(\d+)::([^}]*?)(::([^}]*?))?\}\}").unwrap()
});

/// Render cloze deletions in field content.
///
/// # Arguments
/// * `field_content` - The field content containing cloze markers
/// * `card_ord` - The card ordinal (1-indexed), determines which cloze is active
/// * `is_question` - Whether rendering for question (front) or answer (back) side
///
/// # Returns
/// The rendered content with cloze markers processed
pub fn render_cloze(field_content: &str, card_ord: u32, is_question: bool) -> String {
    CLOZE_REGEX
        .replace_all(field_content, |caps: &regex::Captures| {
            let cloze_num: u32 = caps[1].parse().unwrap_or(0);
            let text = &caps[2];
            let hint = caps.get(4).map(|m| m.as_str());

            if cloze_num == card_ord {
                // This is the active cloze for this card
                if is_question {
                    // Question side: hide the content
                    match hint {
                        Some(h) => format!("<span class=\"cloze\">[{}]</span>", h),
                        None => "<span class=\"cloze\">[...]</span>".to_string(),
                    }
                } else {
                    // Answer side: reveal with styling
                    format!("<span class=\"cloze\">{}</span>", text)
                }
            } else {
                // Inactive cloze: just show the text
                text.to_string()
            }
        })
        .to_string()
}

/// Count the number of unique cloze ordinals in field content.
/// This determines how many cards a cloze note generates.
pub fn count_cloze_ordinals(field_content: &str) -> u32 {
    let mut max_ord = 0;
    for caps in CLOZE_REGEX.captures_iter(field_content) {
        if let Ok(ord) = caps[1].parse::<u32>() {
            max_ord = max_ord.max(ord);
        }
    }
    max_ord
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cloze_question_basic() {
        let field = "{{c1::Paris}} is the capital of {{c2::France}}";
        let result = render_cloze(field, 1, true);
        assert_eq!(
            result,
            "<span class=\"cloze\">[...]</span> is the capital of France"
        );
    }

    #[test]
    fn test_cloze_question_second_card() {
        let field = "{{c1::Paris}} is the capital of {{c2::France}}";
        let result = render_cloze(field, 2, true);
        assert_eq!(
            result,
            "Paris is the capital of <span class=\"cloze\">[...]</span>"
        );
    }

    #[test]
    fn test_cloze_answer() {
        let field = "{{c1::Paris}} is the capital of {{c2::France}}";
        let result = render_cloze(field, 1, false);
        assert_eq!(
            result,
            "<span class=\"cloze\">Paris</span> is the capital of France"
        );
    }

    #[test]
    fn test_cloze_hint() {
        let field = "{{c1::Paris::capital city}} is in France";
        let result = render_cloze(field, 1, true);
        assert_eq!(
            result,
            "<span class=\"cloze\">[capital city]</span> is in France"
        );
    }

    #[test]
    fn test_cloze_hint_answer() {
        let field = "{{c1::Paris::capital city}} is in France";
        let result = render_cloze(field, 1, false);
        // Answer side shows text, not hint
        assert_eq!(
            result,
            "<span class=\"cloze\">Paris</span> is in France"
        );
    }

    #[test]
    fn test_count_cloze_ordinals() {
        let field = "{{c1::a}} {{c2::b}} {{c3::c}} {{c1::d}}";
        assert_eq!(count_cloze_ordinals(field), 3);
    }

    #[test]
    fn test_no_cloze() {
        let field = "Just plain text";
        let result = render_cloze(field, 1, true);
        assert_eq!(result, "Just plain text");
    }

    #[test]
    fn test_multiple_same_cloze() {
        let field = "{{c1::word1}} and {{c1::word2}}";
        let result = render_cloze(field, 1, true);
        assert_eq!(
            result,
            "<span class=\"cloze\">[...]</span> and <span class=\"cloze\">[...]</span>"
        );
    }
}
