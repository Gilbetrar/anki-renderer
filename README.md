# anki-renderer

Pixel-accurate Anki card previews for web apps.

**[Live Demo](https://anki-renderer.bjblabs.com)** | **Rendering API:** `https://anki-renderer.bjblabs.com/api/render` | [GitHub](https://github.com/Gilbetrar/anki-renderer)

## Rendering service (current approach)

`server/` wraps the **official `anki` Python package** — Anki's real Rust
rendering engine — in a small FastAPI service. Output is byte-identical to
what Anki desktop renders (verified against a live collection: 102/102 cards
across 17 note types, including image occlusion, cloze, and type-in-answer).
There is no reimplemented template engine to drift out of sync.

```bash
curl -s https://anki-renderer.bjblabs.com/api/render \
  -H 'Content-Type: application/json' -d '{
    "templates": [{"front": "{{Front}}", "back": "{{FrontSide}}<hr id=answer>{{Back}}"}],
    "fields": {"Front": "What is 2 + 2?", "Back": "4"}
  }'
```

Response: one entry per card with `question`/`answer` HTML, `empty` (would
Anki generate this card?), extracted audio/TTS tags, plus the note type CSS
and engine version. Cloze note types (`"cloze": true`) return one card per
cloze ordinal. `deckName`, `tags`, and `modelName` are honored so special
fields (`{{Deck}}`, `{{Tags}}`, `{{Type}}`, …) render correctly.

Run locally:

```bash
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd .. && server/.venv/bin/uvicorn server.app:app --port 9003   # from repo root
server/.venv/bin/python -m pytest server/tests/                # test suite
server/.venv/bin/python -m server.differential                 # fidelity check vs live Anki (needs AnkiConnect)
```

## Web component

`<anki-card-preview>` renders cards through the service (no WASM in the
component bundle):

```html
<script type="module">
  import 'anki-renderer/component';
</script>

<anki-card-preview
  template-front="{{Front}}"
  template-back="{{FrontSide}}<hr>{{Back}}"
  fields='{"Front": "Hello", "Back": "World"}'
  side="question"
></anki-card-preview>
```

Attributes:

- `template-front` / `template-back` — card templates
- `fields` — JSON object of field name/value pairs
- `side` — `question` or `answer`
- `cloze` — boolean attribute; treat the note type as cloze (the service
  returns one card per cloze ordinal)
- `card-ord` — which card to display, by 0-indexed ordinal (defaults to the
  first card Anki would generate)
- `css` — note type CSS (replaces Anki's stock `.card` css, as in Anki)
- `night-mode` — boolean attribute; applies `night_mode`/`nightMode` classes
  and dark base styles
- `service-url` — rendering service base URL (defaults to the public service)

Events: `render-complete` (detail: `content`, `side`, `card`, `cards`,
`ankiVersion`) and `render-error` (detail: `message`, `error`). Attribute
changes are debounced into a single re-render.

### Limitations

- **Media files are not served.** `<img>` tags in fields render as-is, so
  images stored in Anki's media folder won't resolve unless the page can
  reach them by the same path.
- **No audio playback or type-in grading.** Audio/TTS tags render as a ▶
  placeholder; the parsed tags are available on `render-complete` via
  `card.questionAvTags` / `card.answerAvTags`.

## WASM renderer (legacy)

The original approach below — a Rust reimplementation of Anki's template
engine compiled to WebAssembly — is still available as the `renderCard`
JavaScript API, but has known fidelity gaps (see issue #20 and API.md) and
is superseded by the rendering service for accuracy-critical use. The demo
site and web component now use the service.

## Features

- Full Anki template syntax support (`{{Field}}`, `{{#Conditional}}`, `{{^Negative}}`)
- Cloze deletions (`{{c1::text}}`, `{{c1::text::hint}}`)
- Template filters (`text`, `hint`, `type`, `furigana`, `kanji`, `kana`)
- TypeScript/JavaScript bindings with ergonomic API
- CSS styling support (default Anki styles, night mode, custom CSS)

## Installation

```bash
npm install anki-renderer
```

## Usage

```typescript
import { renderCard, initWasm } from 'anki-renderer';

// Initialize WASM (required once)
await initWasm();

// Render a card
const result = await renderCard({
  front: '{{Front}}',
  back: '{{FrontSide}}<hr>{{Back}}',
  fields: { Front: 'What is 2 + 2?', Back: '4' },
});

console.log(result.question); // "What is 2 + 2?"
console.log(result.answer);   // "What is 2 + 2?<hr>4"
```

## Development

### Prerequisites

- Rust (stable)
- wasm-pack: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
- Node.js 20+

### Build

```bash
# Build everything (WASM + TypeScript)
npm run build

# Or individually:
cargo build                              # Rust library
wasm-pack build --target web --out-dir pkg  # WASM (web)
npm run build:ts                         # TypeScript
```

### Test

```bash
cargo test          # Rust tests
npm run test:js     # Jest tests
npm run test:e2e    # Playwright tests (starts the rendering service from server/.venv)
server/.venv/bin/python -m pytest server/tests/   # rendering service tests
```

### Demo Site

```bash
cd demo
npm install
npm run dev         # Start dev server at localhost:3001
```

## Publishing to npm

```bash
# Build the package
npm run build

# Login to npm (if not already)
npm login

# Publish
npm publish
```

For subsequent releases, update the version in `package.json` before publishing.

## Documentation

See [LEARNINGS.md](./LEARNINGS.md) for detailed documentation on:
- Template syntax and filters
- Cloze implementation
- JavaScript/TypeScript API
- Web component attributes
- AWS deployment infrastructure

## License

MIT
