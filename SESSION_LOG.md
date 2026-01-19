# Session Log

Raw session history for debugging. Don't read this file for context - use LEARNINGS.md instead.

---

## Agent Session - Issue #1

**Worked on:** Issue #1 - Repository Setup & Project Scaffolding

**What I did:**
- Created Cargo.toml with wasm-bindgen dependencies
- Created src/lib.rs with basic render_template and version exports
- Created package.json for npm package management
- Set up GitHub Actions CI workflow
- Created README.md and .gitignore
- Installed Rust and wasm-pack locally (were not present)
- Verified all build commands work locally
- Fixed CI action name (rust-action → rust-toolchain)

**What I learned:**
- The GitHub Action for Rust is `dtolnay/rust-toolchain@stable`, not `rust-action`
- wasm-pack can be installed via `cargo install wasm-pack` when the shell script fails
- Unused parameters in Rust should be prefixed with `_` to avoid clippy warnings

**Mistakes made:**
- Used wrong action name `dtolnay/rust-action` in CI, causing initial CI failure
- Fixed by changing to `dtolnay/rust-toolchain`

---

## Agent Session - Issue #2

**Worked on:** Issue #2 - Spike: Analyze rslib Rendering Dependencies

**What I did:**
- Cloned ankitects/anki repo to /tmp for analysis
- Analyzed `rslib/src/template.rs` (~1400 lines) - core template parser
- Analyzed `rslib/src/template_filters.rs` (~300 lines) - filter implementations
- Analyzed `rslib/src/cloze.rs` (~850 lines) - cloze deletion handling
- Mapped all internal and external dependencies
- Analyzed proto files for understanding service boundaries
- Documented extraction plan in LEARNINGS.md

**What I learned:**
- Template parsing uses `nom` parser combinators for handlebar-style syntax
- Proto types are only needed for service/RPC layer, not core rendering
- The I18n dependency is mostly for error messages - can be stubbed easily
- Image occlusion is a complex feature that can be deferred
- Core rendering (~2500 lines across 3 files) is fairly self-contained
- External crates needed: nom, regex, htmlescape, blake3, hex, itertools

**Codebase facts discovered:**
- `rslib/src/lib.rs` lists all modules in the crate
- `prelude.rs` exports commonly used types (I18n, error types)
- Template modes: Standard (`{{}}`) and LegacyAltSyntax (`<% %>`)
- Cloze supports nested clozes and multi-card syntax (`{{c1,2::text}}`)
- card_rendering module handles AV tags and TTS, separate from template logic

**Key insight:**
Proto dependencies can be avoided entirely. The proto types are used for the gRPC service layer, but the core rendering functions accept plain Rust types. We can define our own simple types for the WASM interface.

---

## Agent Session - Issue #3 (Partial)

**Worked on:** Issue #3 - Implement Template Parser

**What I did:**
- Added dependencies: nom (parser combinator), serde, serde_json
- Created `src/template.rs` with complete template parsing and rendering
- Implemented field substitution: `{{FieldName}}`
- Implemented positive conditionals: `{{#Field}}...{{/Field}}`
- Implemented negative conditionals: `{{^Field}}...{{/Field}}`
- Implemented filter syntax parsing: `{{filter:FieldName}}`
- Handled special fields: FrontSide, Tags, Deck, Card
- Wired up render_template function in lib.rs
- Added 16 comprehensive tests
- All acceptance criteria met except structured AST return (returns rendered HTML)

**What I learned:**
- JsError::new() only works in WASM target, not native Rust tests
- nom's take_until requires the exact string to search for
- Filter application deferred to Issue #5 (filters are parsed but not applied)

**Codebase facts discovered:**
- Template syntax follows Mustache pattern with Anki extensions
- Fields can have spaces in names (e.g., "Front Side")
- Conditionals check for non-empty values, not truthy/falsy

**Remaining for Issue #3:**
- Consider adding AST export for debugging/tooling

---

## Agent Session - Issue #4

**Worked on:** Issue #4 - Implement Cloze Deletion Support

**What I did:**
- Closed Issue #3 (all acceptance criteria were already met)
- Created `src/cloze.rs` with cloze parsing and rendering logic
- Used regex for cloze pattern matching: `{{c1::text}}` and `{{c1::text::hint}}`
- Implemented question side rendering (cloze hidden with `[...]` or `[hint]`)
- Implemented answer side rendering (cloze revealed with styling)
- Added `render_cloze_card()` WASM function for front/back rendering
- Added `count_cloze_cards()` utility function
- Integrated cloze filter with template renderer via `{{cloze:FieldName}}`
- Updated `render_nodes` to accept optional `ClozeContext`
- Added 11 tests for cloze functionality

**What I learned:**
- Cloze output uses `<span class="cloze">` for styling
- Card ordinal is 1-indexed (c1 = card 1, c2 = card 2)
- LazyLock is the modern way to create static regex in Rust

**Codebase facts discovered:**
- Template filters are applied by checking the `filters` vec in TemplateNode::Field
- Multiple clozes with same ordinal (c1) are all hidden/revealed together

**Testing notes:**
- All 27 tests pass (16 template + 8 cloze + 3 integration)

---

## Agent Session - Issue #5

**Worked on:** Issue #5 - Implement Template Filters

**What I did:**
- Created `src/filters.rs` with all standard Anki filter implementations
- Implemented `text` filter: strips HTML tags (preserves br as newlines)
- Implemented `hint` filter: generates clickable reveal HTML elements
- Implemented `type` filter: generates input field for answer comparison
- Implemented `furigana` filter: converts bracket syntax to ruby HTML
- Implemented `kanji` filter: extracts base characters from ruby annotations
- Implemented `kana` filter: extracts readings from ruby annotations
- Updated `template.rs` to apply filters in reverse order (right-to-left)
- Integrated all filters with the template rendering pipeline
- Added 20+ filter tests and 12 integration tests in template.rs
- Fixed filter name parser to accept underscores in filter names

**What I learned:**
- Anki applies filters right-to-left: `{{text:hint:Field}}` means hint first, then text
- Raw string literals (r#"..."#) have issues with single quotes in some contexts
- Ruby HTML format: `<ruby>漢字<rt>かんじ</rt></ruby>`
- Bracket ruby syntax: `漢字[かんじ]` is converted to HTML ruby

**Codebase facts discovered:**
- Filter names can contain alphanumeric, hyphen, and underscore characters
- Unknown filters pass through gracefully (return content unchanged)
- Cloze is handled separately since it needs ClozeContext for card ordinal

**Testing notes:**
- All 54 tests pass (20 filter + 28 template + 8 cloze + 4 integration)

---

## Agent Session - Issue #6

**Worked on:** Issue #6 - JavaScript/TypeScript Bindings

**What I did:**
- Created `js/src/types.ts` with TypeScript type definitions (NoteFields, CardTemplate, RenderOptions, RenderResult, RenderError)
- Created `js/src/index.ts` with high-level ergonomic API
- Implemented `renderCard()` function that renders both front and back, handling FrontSide replacement
- Implemented async WASM loading with environment detection (browser vs Node.js)
- Added utility functions: `initWasm()`, `isInitialized()`, `getVersion()`, `countClozeCards()`, `renderTemplate()`
- Created `js/tsconfig.json` for TypeScript compilation
- Created `jest.config.js` with ts-jest for ESM testing
- Created 19 comprehensive tests in `js/tests/index.test.ts`
- Updated package.json with TypeScript dependencies and build scripts
- Added `/dist/` to .gitignore for generated JavaScript output

**What I learned:**
- FrontSide must be added to fields BEFORE rendering, not replaced after
- The FrontSide field contains the rendered question HTML
- wasm-pack generates different output for `--target web` (needs init) vs `--target nodejs` (synchronous)
- ts-jest with ESM requires `useESM: true` and `extensionsToTreatAsEsm`
- Multiple wasm-pack outputs with same name cause Jest haste collision warnings (harmless)

**Codebase facts discovered:**
- WASM web target exports a default function to initialize the module
- Node.js WASM target loads synchronously, no init needed
- TypeScript types should use `Record<string, string>` for field maps

**Testing notes:**
- 54 Rust tests + 19 JavaScript tests all pass
- CI workflow passes
