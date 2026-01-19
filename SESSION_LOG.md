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
