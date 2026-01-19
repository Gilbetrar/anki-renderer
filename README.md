# anki-renderer

Anki card template renderer compiled to WebAssembly.

**[Live Demo](https://anki-renderer.bjblabs.com)** | [GitHub](https://github.com/Gilbetrar/anki-renderer)

## Features

- Full Anki template syntax support (`{{Field}}`, `{{#Conditional}}`, `{{^Negative}}`)
- Cloze deletions (`{{c1::text}}`, `{{c1::text::hint}}`)
- Template filters (`text`, `hint`, `type`, `furigana`, `kanji`, `kana`)
- TypeScript/JavaScript bindings with ergonomic API
- Web component (`<anki-card-preview>`) for easy embedding
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

### Web Component

```html
<script type="module">
  import 'anki-renderer/component';
</script>

<anki-card-preview
  template-front="{{Front}}"
  template-back="{{FrontSide}}<hr>{{Back}}"
  fields='{"Front": "Hello", "Back": "World"}'
  side="question"
  default-styles
></anki-card-preview>
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
npm run test:e2e    # Playwright tests
```

### Demo Site

```bash
cd demo
npm install
npm run dev         # Start dev server at localhost:3001
```

## Documentation

See [LEARNINGS.md](./LEARNINGS.md) for detailed documentation on:
- Template syntax and filters
- Cloze implementation
- JavaScript/TypeScript API
- Web component attributes
- AWS deployment infrastructure

## License

MIT
