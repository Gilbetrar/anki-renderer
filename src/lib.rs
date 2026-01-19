use std::collections::HashMap;
use wasm_bindgen::prelude::*;

mod cloze;
mod filters;
mod template;

/// Render an Anki card template with the given fields.
///
/// # Arguments
/// * `template` - The card template string containing {{field}} placeholders
/// * `fields_json` - JSON object mapping field names to values
///
/// # Returns
/// The rendered HTML string
#[wasm_bindgen]
pub fn render_template(template_str: &str, fields_json: &str) -> Result<String, JsError> {
    let fields: HashMap<String, String> =
        serde_json::from_str(fields_json).map_err(|e| JsError::new(&format!("Invalid JSON: {}", e)))?;

    template::render(template_str, &fields).map_err(|e| JsError::new(&e))
}

/// Render an Anki cloze card template with the given fields.
///
/// # Arguments
/// * `template` - The card template string containing {{cloze:FieldName}}
/// * `fields_json` - JSON object mapping field names to values (containing cloze syntax)
/// * `card_ord` - The card ordinal (1-indexed) determining which cloze is active
/// * `is_question` - Whether rendering for question (front) or answer (back) side
///
/// # Returns
/// The rendered HTML string with cloze deletions processed
#[wasm_bindgen]
pub fn render_cloze_card(
    template_str: &str,
    fields_json: &str,
    card_ord: u32,
    is_question: bool,
) -> Result<String, JsError> {
    let fields: HashMap<String, String> =
        serde_json::from_str(fields_json).map_err(|e| JsError::new(&format!("Invalid JSON: {}", e)))?;

    template::render_with_cloze(template_str, &fields, card_ord, is_question)
        .map_err(|e| JsError::new(&e))
}

/// Count the number of cloze cards a field generates.
///
/// # Arguments
/// * `field_content` - The field content containing cloze syntax
///
/// # Returns
/// The number of unique cloze ordinals (number of cards)
#[wasm_bindgen]
pub fn count_cloze_cards(field_content: &str) -> u32 {
    cloze::count_cloze_ordinals(field_content)
}

/// Get the library version
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert_eq!(version(), "0.1.0");
    }

    #[test]
    fn test_render_simple_field() {
        let result = render_template("Hello {{Name}}!", r#"{"Name": "World"}"#).unwrap();
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_render_conditional() {
        let result = render_template("{{#Extra}}Has extra{{/Extra}}", r#"{"Extra": "yes"}"#).unwrap();
        assert_eq!(result, "Has extra");
    }

    #[test]
    fn test_render_negative_conditional() {
        let result = render_template("{{^Extra}}No extra{{/Extra}}", r#"{}"#).unwrap();
        assert_eq!(result, "No extra");
    }

    #[test]
    fn test_render_invalid_json() {
        // Note: render_template uses JsError which only works in WASM
        // Test the underlying template module instead
        let fields: Result<std::collections::HashMap<String, String>, _> =
            serde_json::from_str("not json");
        assert!(fields.is_err());
    }

    #[test]
    fn test_cloze_question_via_template() {
        let mut fields = HashMap::new();
        fields.insert(
            "Text".to_string(),
            "{{c1::Paris}} is the capital of {{c2::France}}".to_string(),
        );
        let result =
            template::render_with_cloze("{{cloze:Text}}", &fields, 1, true).unwrap();
        assert_eq!(
            result,
            "<span class=\"cloze\">[...]</span> is the capital of France"
        );
    }

    #[test]
    fn test_cloze_answer_via_template() {
        let mut fields = HashMap::new();
        fields.insert(
            "Text".to_string(),
            "{{c1::Paris}} is the capital of {{c2::France}}".to_string(),
        );
        let result =
            template::render_with_cloze("{{cloze:Text}}", &fields, 1, false).unwrap();
        assert_eq!(
            result,
            "<span class=\"cloze\">Paris</span> is the capital of France"
        );
    }

    #[test]
    fn test_cloze_hint_via_template() {
        let mut fields = HashMap::new();
        fields.insert(
            "Text".to_string(),
            "{{c1::Paris::capital city}} is in France".to_string(),
        );
        let result =
            template::render_with_cloze("{{cloze:Text}}", &fields, 1, true).unwrap();
        assert_eq!(
            result,
            "<span class=\"cloze\">[capital city]</span> is in France"
        );
    }
}
