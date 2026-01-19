use wasm_bindgen::prelude::*;

/// Render an Anki card template with the given fields.
///
/// # Arguments
/// * `template` - The card template string containing {{field}} placeholders
/// * `fields` - JSON object mapping field names to values
///
/// # Returns
/// The rendered HTML string
#[wasm_bindgen]
pub fn render_template(template: &str, _fields: &str) -> Result<String, JsError> {
    // For now, just return the template as-is
    // Full implementation will come in issue #3
    Ok(template.to_string())
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
    fn test_render_template_passthrough() {
        let result = render_template("Hello {{Front}}", "{}").unwrap();
        assert_eq!(result, "Hello {{Front}}");
    }
}
