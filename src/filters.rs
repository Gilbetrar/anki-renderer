use regex::Regex;
use std::sync::LazyLock;

/// Regex for matching HTML tags
static HTML_TAG_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<[^>]+>").unwrap()
});

/// Regex for matching ruby annotations: <ruby>base<rt>reading</rt></ruby>
static RUBY_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<ruby>([^<]*)<rt>([^<]*)</rt></ruby>").unwrap()
});

/// Regex for matching bracket ruby syntax: 漢字[かんじ]
static BRACKET_RUBY_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\p{Han}+)\[([^\]]+)\]").unwrap()
});

/// Apply a filter to field content.
///
/// # Arguments
/// * `filter_name` - The name of the filter to apply
/// * `content` - The content to filter
///
/// # Returns
/// The filtered content, or the original content if filter is unknown
pub fn apply_filter(filter_name: &str, content: &str) -> String {
    match filter_name {
        "text" => filter_text(content),
        "hint" => filter_hint(content),
        "type" => filter_type(content),
        "furigana" => filter_furigana(content),
        "kanji" => filter_kanji(content),
        "kana" => filter_kana(content),
        // cloze is handled separately in template.rs
        "cloze" => content.to_string(),
        // Unknown filters pass through gracefully
        _ => content.to_string(),
    }
}

/// Strip HTML tags from content.
/// This is the {{text:Field}} filter.
fn filter_text(content: &str) -> String {
    // Replace <br> and </br> with newlines first
    let content = content
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</br>", "\n");

    // Strip all HTML tags
    HTML_TAG_REGEX.replace_all(&content, "").to_string()
}

/// Generate hint HTML (clickable reveal).
/// This is the {{hint:Field}} filter.
fn filter_hint(content: &str) -> String {
    if content.is_empty() {
        return String::new();
    }

    // Generate a unique ID for this hint based on content hash
    let hash = blake3_hash_id(content);

    format!(
        "<a class=\"hint\" href=\"#\" onclick=\"this.style.display='none';document.getElementById('hint{}').style.display='block';return false;\">Show Hint</a><div id=\"hint{}\" class=\"hint\" style=\"display:none\">{}</div>",
        hash, hash, content
    )
}

/// Generate type-in answer comparison HTML.
/// This is the {{type:Field}} filter.
fn filter_type(content: &str) -> String {
    // The type filter generates an input field on the question side
    // and comparison logic on the answer side
    // For now, we generate a placeholder that can be processed by JS
    format!(r#"<input type="text" id="typeans" class="type-answer" data-expected="{}"/>"#,
        htmlescape::encode_attribute(content))
}

/// Convert ruby annotations to full furigana display.
/// This is the {{furigana:Field}} filter.
/// Shows: 漢字(かんじ) format or HTML ruby
fn filter_furigana(content: &str) -> String {
    // First handle HTML ruby tags - keep them as-is
    let result = content.to_string();

    // Convert bracket syntax to ruby HTML: 漢字[かんじ] -> <ruby>漢字<rt>かんじ</rt></ruby>
    BRACKET_RUBY_REGEX
        .replace_all(&result, "<ruby>$1<rt>$2</rt></ruby>")
        .to_string()
}

/// Extract only kanji from ruby annotations.
/// This is the {{kanji:Field}} filter.
fn filter_kanji(content: &str) -> String {
    // Remove ruby readings, keeping only the base text
    let result = RUBY_REGEX.replace_all(content, "$1").to_string();

    // Also handle bracket syntax: 漢字[かんじ] -> 漢字
    BRACKET_RUBY_REGEX.replace_all(&result, "$1").to_string()
}

/// Extract only kana readings from ruby annotations.
/// This is the {{kana:Field}} filter.
fn filter_kana(content: &str) -> String {
    // Replace ruby with just the reading
    let result = RUBY_REGEX.replace_all(content, "$2").to_string();

    // Also handle bracket syntax: 漢字[かんじ] -> かんじ
    BRACKET_RUBY_REGEX.replace_all(&result, "$2").to_string()
}

/// Generate a unique ID for hint elements using blake3 hash
fn blake3_hash_id(s: &str) -> u64 {
    let hash = blake3::hash(s.as_bytes());
    let bytes = hash.as_bytes();
    // Take first 8 bytes to form a u64
    u64::from_le_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5], bytes[6], bytes[7],
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    // text filter tests
    #[test]
    fn test_text_filter_strips_html() {
        assert_eq!(filter_text("<b>Bold</b> text"), "Bold text");
    }

    #[test]
    fn test_text_filter_handles_br() {
        assert_eq!(filter_text("Line1<br>Line2"), "Line1\nLine2");
        assert_eq!(filter_text("Line1<br/>Line2"), "Line1\nLine2");
        assert_eq!(filter_text("Line1<br />Line2"), "Line1\nLine2");
    }

    #[test]
    fn test_text_filter_complex_html() {
        assert_eq!(
            filter_text("<div class=\"foo\"><span>Hello</span> <em>World</em></div>"),
            "Hello World"
        );
    }

    #[test]
    fn test_text_filter_preserves_plain_text() {
        assert_eq!(filter_text("Just plain text"), "Just plain text");
    }

    // hint filter tests
    #[test]
    fn test_hint_filter_creates_clickable() {
        let result = filter_hint("The answer");
        assert!(result.contains("Show Hint"));
        assert!(result.contains("The answer"));
        assert!(result.contains("onclick"));
        assert!(result.contains("style=\"display:none\""));
    }

    #[test]
    fn test_hint_filter_empty_content() {
        assert_eq!(filter_hint(""), "");
    }

    // type filter tests
    #[test]
    fn test_type_filter_creates_input() {
        let result = filter_type("answer");
        assert!(result.contains("<input"));
        assert!(result.contains("type=\"text\""));
        assert!(result.contains("data-expected=\"answer\""));
    }

    #[test]
    fn test_type_filter_escapes_html() {
        let result = filter_type("<script>alert(1)</script>");
        assert!(result.contains("&lt;script&gt;"));
        assert!(!result.contains("<script>"));
    }

    #[test]
    fn test_type_filter_escapes_edge_cases() {
        // Test all special characters that need escaping in attributes
        let result = filter_type("a & b < c > d \"quoted\" 'apostrophe'");
        assert!(result.contains("&amp;"), "ampersand should be escaped");
        assert!(result.contains("&lt;"), "less-than should be escaped");
        assert!(result.contains("&gt;"), "greater-than should be escaped");
        assert!(result.contains("&quot;"), "double quote should be escaped");
        // Note: htmlescape may use &#x27; or &#39; for single quotes
        assert!(
            result.contains("&#x27;") || result.contains("&#39;"),
            "single quote should be escaped"
        );
        // Ensure raw characters are not present
        assert!(!result.contains("data-expected=\"a & b"));
    }

    // furigana filter tests
    #[test]
    fn test_furigana_bracket_to_ruby() {
        let result = filter_furigana("漢字[かんじ]");
        assert_eq!(result, "<ruby>漢字<rt>かんじ</rt></ruby>");
    }

    #[test]
    fn test_furigana_preserves_existing_ruby() {
        let input = "<ruby>漢字<rt>かんじ</rt></ruby>";
        assert_eq!(filter_furigana(input), input);
    }

    #[test]
    fn test_furigana_mixed_content() {
        let result = filter_furigana("私は日本語[にほんご]を勉強[べんきょう]しています");
        assert!(result.contains("<ruby>日本語<rt>にほんご</rt></ruby>"));
        assert!(result.contains("<ruby>勉強<rt>べんきょう</rt></ruby>"));
    }

    // kanji filter tests
    #[test]
    fn test_kanji_extracts_base() {
        assert_eq!(filter_kanji("漢字[かんじ]"), "漢字");
    }

    #[test]
    fn test_kanji_from_ruby_html() {
        assert_eq!(filter_kanji("<ruby>漢字<rt>かんじ</rt></ruby>"), "漢字");
    }

    // kana filter tests
    #[test]
    fn test_kana_extracts_reading() {
        assert_eq!(filter_kana("漢字[かんじ]"), "かんじ");
    }

    #[test]
    fn test_kana_from_ruby_html() {
        assert_eq!(filter_kana("<ruby>漢字<rt>かんじ</rt></ruby>"), "かんじ");
    }

    // unknown filter tests
    #[test]
    fn test_unknown_filter_passes_through() {
        assert_eq!(apply_filter("unknown_filter", "content"), "content");
    }

    #[test]
    fn test_apply_filter_text() {
        assert_eq!(apply_filter("text", "<b>Bold</b>"), "Bold");
    }
}
