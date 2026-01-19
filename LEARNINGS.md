# Learnings

Distilled patterns for this project. For full session history, see SESSION_LOG.md.

## Project Structure

- **Type**: Rust → WASM library with TypeScript bindings
- **Entry**: `src/lib.rs` → WASM via wasm-pack → `pkg/` (gitignored)
- **JS layer**: `js/src/` → compiled to `dist/` (gitignored)
- **Demo**: `demo/` → Vite site deployed to AWS
- **Infra**: `infra/` → CDK stack for AWS deployment

## Build & Test

```bash
# Rust
cargo test && cargo clippy -- -D warnings

# WASM (both targets needed for full build)
wasm-pack build --target web --out-dir pkg
wasm-pack build --target nodejs --out-dir pkg-node

# TypeScript
npm run build:ts && npm run test:js

# E2E (Playwright)
npm run test:e2e

# Demo
cd demo && npm run build
```

## Core Patterns

### Template Syntax
- Fields: `{{FieldName}}`, conditionals: `{{#Field}}...{{/Field}}`, `{{^Field}}...{{/Field}}`
- Filters apply right-to-left: `{{text:hint:Field}}` = hint first, then text
- Available filters: `text`, `hint`, `type`, `furigana`, `kanji`, `kana`, `cloze`

### Cloze Deletions
- Syntax: `{{c1::text}}` or `{{c1::text::hint}}`
- Ordinal 1-indexed (c1 = card 1)
- Template usage: `{{cloze:FieldName}}`
- Output: `<span class="cloze">` wrapper

### Web Component
- Element: `<anki-card-preview>`
- Uses Shadow DOM - Playwright tests need `page.evaluate()` to access content
- Auto-registers on import in browser
- Key attributes: `template-front`, `template-back`, `fields`, `side`, `card-ordinal`, `css`, `night-mode`

### CSS Styling
- Root selector: `.card`
- Night mode background: `#2f2f31`
- Use `renderStyledCard()` for complete styled output

## AWS Deployment

**Live site**: https://anki-renderer.bjblabs.com

| Resource | Value |
|----------|-------|
| S3 Bucket | `anki-renderer-demo-719390918663` |
| CloudFront | `E7ZBUOH7HRPA5` |
| CDK Stack | `AnkiRendererDemoStack` |

**Deploy flow**: Push to main → CI → deploy workflow → CDK deploy

```bash
# Manual deploy
cd infra && npm install && npx cdk deploy
```

**GitHub Actions auth**: OIDC via `github-actions-anki-renderer` IAM role (secret: `AWS_ROLE_ARN`)

## Anki Version Compatibility

**Verified against:** Anki rslib commit `b8884bac` (January 2026)

**Implemented Features:**
- Basic field substitution `{{Field}}`
- Conditionals `{{#Field}}...{{/Field}}`, `{{^Field}}...{{/Field}}`
- Single-ordinal cloze `{{c1::text}}` and `{{c1::text::hint}}`
- Core filters: `text`, `hint`, `type`, `furigana`, `kanji`, `kana`, `cloze`
- FrontSide special field

**Known Limitations (vs Anki rslib):**
- Multi-card cloze syntax `{{c1,2::shared}}` not supported
- Nested clozes not supported
- Image occlusion clozes not supported
- HTML comments `<!--...-->` not stripped/parsed
- Legacy alt syntax `<%...%>` not supported
- `cloze-only` filter missing
- TTS filter missing (`[anki:tts...]`)
- Different hint ID generation (simple hash vs blake3)
- Cloze output lacks `data-cloze`/`data-ordinal` attributes
- Manual HTML escaping vs `htmlescape` crate

These limitations are acceptable for the core use case of rendering card previews.

## Gotchas

- CI uses `dtolnay/rust-toolchain@stable` (NOT rust-action)
- `JsError::new()` only works in WASM target - use native errors in tests
- FrontSide field must be added to fields BEFORE rendering back template
- Playwright locators don't pierce Shadow DOM - use `page.evaluate()`
- E2E test HTML at `/e2e/test.html`
- ACM certificates must be in `us-east-1` for CloudFront
