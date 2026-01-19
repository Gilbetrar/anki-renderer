use crate::cloze;
use crate::filters;
use nom::{
    branch::alt,
    bytes::complete::{tag, take_until, take_while1},
    character::complete::char,
    combinator::{map, recognize},
    multi::many0,
    sequence::{delimited, pair},
    IResult,
};
use std::collections::HashMap;

/// A parsed template node
#[derive(Debug, Clone, PartialEq)]
pub enum TemplateNode {
    /// Plain text content
    Text(String),
    /// Field substitution: {{FieldName}} or {{filter:FieldName}}
    Field {
        name: String,
        filters: Vec<String>,
    },
    /// Conditional block: {{#Field}}...{{/Field}}
    Conditional {
        field: String,
        children: Vec<TemplateNode>,
        is_negative: bool,
    },
}

/// Parse a field name (alphanumeric, spaces, and underscores)
fn field_name(input: &str) -> IResult<&str, &str> {
    take_while1(|c: char| c.is_alphanumeric() || c == '_' || c == ' ')(input)
}

/// Parse filter chain: filter1:filter2:FieldName
fn filter_chain(input: &str) -> IResult<&str, (Vec<&str>, &str)> {
    let (input, parts) = recognize(pair(
        many0(pair(
            take_while1(|c: char| c.is_alphanumeric() || c == '-' || c == '_'),
            char(':'),
        )),
        field_name,
    ))(input)?;

    let segments: Vec<&str> = parts.split(':').collect();
    if segments.len() > 1 {
        let filters = segments[..segments.len() - 1].to_vec();
        let name = segments[segments.len() - 1];
        Ok((input, (filters, name)))
    } else {
        Ok((input, (vec![], segments[0])))
    }
}

/// Parse a field substitution: {{FieldName}} or {{filter:FieldName}}
fn parse_field(input: &str) -> IResult<&str, TemplateNode> {
    let (input, (filters, name)) = delimited(tag("{{"), filter_chain, tag("}}"))(input)?;

    Ok((
        input,
        TemplateNode::Field {
            name: name.trim().to_string(),
            filters: filters.iter().map(|s| s.to_string()).collect(),
        },
    ))
}

/// Parse a conditional open tag: {{#Field}} or {{^Field}}
fn parse_conditional_open(input: &str) -> IResult<&str, (bool, &str)> {
    let (input, _) = tag("{{")(input)?;
    let (input, neg) = alt((map(char('#'), |_| false), map(char('^'), |_| true)))(input)?;
    let (input, name) = field_name(input)?;
    let (input, _) = tag("}}")(input)?;
    Ok((input, (neg, name)))
}

/// Parse a complete conditional block
fn parse_conditional(input: &str) -> IResult<&str, TemplateNode> {
    let (input, (is_negative, field)) = parse_conditional_open(input)?;
    let close_tag = format!("{{{{/{}}}}}", field);

    // Find where the close tag is
    let (input, inner) = take_until(close_tag.as_str())(input)?;
    let (input, _) = tag(close_tag.as_str())(input)?;

    // Parse the inner content recursively
    let (_, children) = parse_template_nodes(inner)?;

    Ok((
        input,
        TemplateNode::Conditional {
            field: field.trim().to_string(),
            children,
            is_negative,
        },
    ))
}

/// Parse plain text (everything up to the next {{ or end)
fn parse_text(input: &str) -> IResult<&str, TemplateNode> {
    let (input, text) = alt((take_until("{{"), nom::combinator::rest))(input)?;

    if text.is_empty() {
        Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::TakeWhile1,
        )))
    } else {
        Ok((input, TemplateNode::Text(text.to_string())))
    }
}

/// Parse a single template node
fn parse_node(input: &str) -> IResult<&str, TemplateNode> {
    alt((parse_conditional, parse_field, parse_text))(input)
}

/// Parse all template nodes
fn parse_template_nodes(input: &str) -> IResult<&str, Vec<TemplateNode>> {
    many0(parse_node)(input)
}

/// Parse a template string into nodes
pub fn parse_template(template: &str) -> Result<Vec<TemplateNode>, String> {
    match parse_template_nodes(template) {
        Ok((remaining, nodes)) => {
            if !remaining.is_empty() {
                Err(format!("Failed to parse remaining: {}", remaining))
            } else {
                Ok(nodes)
            }
        }
        Err(e) => Err(format!("Parse error: {:?}", e)),
    }
}

/// Render parsed template nodes with given fields
pub fn render_nodes(
    nodes: &[TemplateNode],
    fields: &HashMap<String, String>,
    cloze_ctx: Option<&ClozeContext>,
) -> String {
    let mut output = String::new();

    for node in nodes {
        match node {
            TemplateNode::Text(text) => {
                output.push_str(text);
            }
            TemplateNode::Field { name, filters } => {
                // Handle special fields
                let mut value = match name.as_str() {
                    "FrontSide" => fields.get("FrontSide").cloned().unwrap_or_default(),
                    "Tags" => fields.get("Tags").cloned().unwrap_or_default(),
                    "Deck" => fields.get("Deck").cloned().unwrap_or_default(),
                    "Card" => fields.get("Card").cloned().unwrap_or_default(),
                    _ => fields.get(name).cloned().unwrap_or_default(),
                };

                // Apply filters in reverse order (right-to-left, innermost first)
                // {{text:hint:Field}} means: apply hint first, then text
                for filter in filters.iter().rev() {
                    if filter == "cloze" {
                        // Cloze filter needs special context handling
                        if let Some(ctx) = cloze_ctx {
                            value = cloze::render_cloze(&value, ctx.card_ord, ctx.is_question);
                        }
                    } else {
                        value = filters::apply_filter(filter, &value);
                    }
                }

                output.push_str(&value);
            }
            TemplateNode::Conditional {
                field,
                children,
                is_negative,
            } => {
                let field_value = fields.get(field).map(|s| s.as_str()).unwrap_or("");
                let field_has_value = !field_value.is_empty();

                let should_render = if *is_negative {
                    !field_has_value
                } else {
                    field_has_value
                };

                if should_render {
                    output.push_str(&render_nodes(children, fields, cloze_ctx));
                }
            }
        }
    }

    output
}

/// Render a template string with the given fields
pub fn render(template: &str, fields: &HashMap<String, String>) -> Result<String, String> {
    let nodes = parse_template(template)?;
    Ok(render_nodes(&nodes, fields, None))
}

/// Cloze rendering context
pub struct ClozeContext {
    pub card_ord: u32,
    pub is_question: bool,
}

/// Render a template string with cloze support
pub fn render_with_cloze(
    template: &str,
    fields: &HashMap<String, String>,
    card_ord: u32,
    is_question: bool,
) -> Result<String, String> {
    let nodes = parse_template(template)?;
    let ctx = ClozeContext {
        card_ord,
        is_question,
    };
    Ok(render_nodes(&nodes, fields, Some(&ctx)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_field() {
        let mut fields = HashMap::new();
        fields.insert("Name".to_string(), "World".to_string());

        let result = render("Hello {{Name}}!", &fields).unwrap();
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_multiple_fields() {
        let mut fields = HashMap::new();
        fields.insert("Front".to_string(), "Question".to_string());
        fields.insert("Back".to_string(), "Answer".to_string());

        let result = render("{{Front}} -> {{Back}}", &fields).unwrap();
        assert_eq!(result, "Question -> Answer");
    }

    #[test]
    fn test_conditional_positive() {
        let mut fields = HashMap::new();
        fields.insert("Extra".to_string(), "yes".to_string());

        let result = render("{{#Extra}}Has extra{{/Extra}}", &fields).unwrap();
        assert_eq!(result, "Has extra");
    }

    #[test]
    fn test_conditional_positive_empty() {
        let fields = HashMap::new();

        let result = render("{{#Extra}}Has extra{{/Extra}}", &fields).unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn test_conditional_negative() {
        let fields = HashMap::new();

        let result = render("{{^Extra}}No extra{{/Extra}}", &fields).unwrap();
        assert_eq!(result, "No extra");
    }

    #[test]
    fn test_conditional_negative_with_value() {
        let mut fields = HashMap::new();
        fields.insert("Extra".to_string(), "exists".to_string());

        let result = render("{{^Extra}}No extra{{/Extra}}", &fields).unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn test_conditional_with_field() {
        let mut fields = HashMap::new();
        fields.insert("Extra".to_string(), "bonus content".to_string());

        let result = render("{{#Extra}}Extra: {{Extra}}{{/Extra}}", &fields).unwrap();
        assert_eq!(result, "Extra: bonus content");
    }

    #[test]
    fn test_missing_field() {
        let fields = HashMap::new();

        let result = render("Hello {{Name}}!", &fields).unwrap();
        assert_eq!(result, "Hello !");
    }

    #[test]
    fn test_plain_text_only() {
        let fields = HashMap::new();

        let result = render("Just plain text", &fields).unwrap();
        assert_eq!(result, "Just plain text");
    }

    #[test]
    fn test_filter_syntax_parsing() {
        let nodes = parse_template("{{text:Field}}").unwrap();
        assert_eq!(nodes.len(), 1);
        match &nodes[0] {
            TemplateNode::Field { name, filters } => {
                assert_eq!(name, "Field");
                assert_eq!(filters, &vec!["text".to_string()]);
            }
            _ => panic!("Expected Field node"),
        }
    }

    #[test]
    fn test_special_fields() {
        let mut fields = HashMap::new();
        fields.insert("FrontSide".to_string(), "<div>Front content</div>".to_string());
        fields.insert("Tags".to_string(), "tag1 tag2".to_string());
        fields.insert("Deck".to_string(), "MyDeck".to_string());
        fields.insert("Card".to_string(), "Card 1".to_string());

        assert_eq!(render("{{FrontSide}}", &fields).unwrap(), "<div>Front content</div>");
        assert_eq!(render("{{Tags}}", &fields).unwrap(), "tag1 tag2");
        assert_eq!(render("{{Deck}}", &fields).unwrap(), "MyDeck");
        assert_eq!(render("{{Card}}", &fields).unwrap(), "Card 1");
    }

    // Filter integration tests
    #[test]
    fn test_text_filter_via_template() {
        let mut fields = HashMap::new();
        fields.insert("Field".to_string(), "<b>Bold</b> text".to_string());

        let result = render("{{text:Field}}", &fields).unwrap();
        assert_eq!(result, "Bold text");
    }

    #[test]
    fn test_hint_filter_via_template() {
        let mut fields = HashMap::new();
        fields.insert("Definition".to_string(), "The answer".to_string());

        let result = render("{{hint:Definition}}", &fields).unwrap();
        assert!(result.contains("Show Hint"));
        assert!(result.contains("The answer"));
    }

    #[test]
    fn test_type_filter_via_template() {
        let mut fields = HashMap::new();
        fields.insert("Answer".to_string(), "correct".to_string());

        let result = render("{{type:Answer}}", &fields).unwrap();
        assert!(result.contains("<input"));
        assert!(result.contains("data-expected=\"correct\""));
    }

    #[test]
    fn test_furigana_filter_via_template() {
        let mut fields = HashMap::new();
        fields.insert("Japanese".to_string(), "日本語[にほんご]".to_string());

        let result = render("{{furigana:Japanese}}", &fields).unwrap();
        assert!(result.contains("<ruby>日本語<rt>にほんご</rt></ruby>"));
    }

    #[test]
    fn test_kanji_filter_via_template() {
        let mut fields = HashMap::new();
        fields.insert("Japanese".to_string(), "日本語[にほんご]".to_string());

        let result = render("{{kanji:Japanese}}", &fields).unwrap();
        assert_eq!(result, "日本語");
    }

    #[test]
    fn test_kana_filter_via_template() {
        let mut fields = HashMap::new();
        fields.insert("Japanese".to_string(), "日本語[にほんご]".to_string());

        let result = render("{{kana:Japanese}}", &fields).unwrap();
        assert_eq!(result, "にほんご");
    }

    #[test]
    fn test_chained_filters() {
        let mut fields = HashMap::new();
        fields.insert("Field".to_string(), "<b>Hidden</b>".to_string());

        // {{text:hint:Field}} means: apply hint first, then text
        // But this doesn't make semantic sense - hint generates HTML, then text strips it
        // A more sensible chain would be hint:text (strip HTML first, then wrap in hint)
        // However, Anki applies right-to-left, so let's test that
        let result = render("{{text:hint:Field}}", &fields).unwrap();
        // hint generates HTML with "Show Hint" etc, then text strips tags
        assert!(result.contains("Show Hint"));
        assert!(!result.contains("<a")); // text filter stripped the anchor tag
    }

    #[test]
    fn test_chained_filters_practical() {
        // More practical: text first (innermost), then hint
        let mut fields = HashMap::new();
        fields.insert("Field".to_string(), "<b>Bold hint</b>".to_string());

        // {{hint:text:Field}} applies text first (strips HTML), then hint (wraps result)
        let result = render("{{hint:text:Field}}", &fields).unwrap();
        assert!(result.contains("Show Hint"));
        assert!(result.contains("Bold hint")); // HTML stripped, text preserved
        assert!(!result.contains("<b>")); // Original bold tag stripped
    }

    #[test]
    fn test_unknown_filter_passes_through() {
        let mut fields = HashMap::new();
        fields.insert("Field".to_string(), "content".to_string());

        let result = render("{{unknown_filter:Field}}", &fields).unwrap();
        assert_eq!(result, "content");
    }

    #[test]
    fn test_multiple_filters_parsing() {
        let nodes = parse_template("{{text:hint:Field}}").unwrap();
        assert_eq!(nodes.len(), 1);
        match &nodes[0] {
            TemplateNode::Field { name, filters } => {
                assert_eq!(name, "Field");
                assert_eq!(filters, &vec!["text".to_string(), "hint".to_string()]);
            }
            _ => panic!("Expected Field node"),
        }
    }
}
