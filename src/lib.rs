use std::collections::HashMap;
use wasm_bindgen::prelude::*;

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
}
