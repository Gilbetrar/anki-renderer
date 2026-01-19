# anki-renderer API Reference

Public API documentation for the anki-renderer package.

## Installation

```bash
npm install anki-renderer
```

## Quick Start

```typescript
import { renderCard, initWasm } from 'anki-renderer';

// Optional: pre-initialize WASM
await initWasm();

// Render a basic card
const result = await renderCard({
  front: "{{Front}}",
  back: "{{FrontSide}}<hr>{{Back}}",
  fields: { Front: "What is 2+2?", Back: "4" },
});

console.log(result.question); // "What is 2+2?"
console.log(result.answer);   // "What is 2+2?<hr>4"
```

## Entry Points

| Import | Purpose |
|--------|---------|
| `anki-renderer` | Core rendering functions and types |
| `anki-renderer/component` | Web component for browser use |

## Core Functions

### renderCard(options)

Main function for rendering Anki cards.

```typescript
async function renderCard(options: RenderOptions): Promise<RenderResult>
```

**Parameters:**
- `options.front` (string) - Template for the question side
- `options.back` (string) - Template for the answer side
- `options.fields` (Record<string, string>) - Field name/value pairs
- `options.cardOrdinal` (number, optional) - Card ordinal for cloze cards (1-indexed). Default: 0 (non-cloze)

**Returns:** `{ question: string, answer: string }`

**Example:**
```typescript
// Basic card
const basic = await renderCard({
  front: "{{Front}}",
  back: "{{FrontSide}}<hr>{{Back}}",
  fields: { Front: "Question", Back: "Answer" },
});

// Cloze card (card 1)
const cloze = await renderCard({
  front: "{{cloze:Text}}",
  back: "{{cloze:Text}}",
  fields: { Text: "{{c1::Paris}} is the capital of {{c2::France}}" },
  cardOrdinal: 1,
});
```

### renderStyledCard(options)

Render a card with CSS styling applied.

```typescript
async function renderStyledCard(options: StyledRenderOptions): Promise<StyledRenderResult>
```

**Parameters:** All `RenderOptions` plus:
- `options.style.css` (string, optional) - Custom CSS
- `options.style.includeDefaultStyles` (boolean, optional) - Include Anki's default card styles
- `options.style.nightMode` (boolean, optional) - Enable dark theme styles

**Returns:**
```typescript
{
  question: string,        // Raw HTML
  answer: string,          // Raw HTML
  styledQuestion: string,  // Complete HTML with <style> and .card wrapper
  styledAnswer: string,    // Complete HTML with <style> and .card wrapper
}
```

**Example:**
```typescript
const result = await renderStyledCard({
  front: "{{Front}}",
  back: "{{FrontSide}}<hr>{{Back}}",
  fields: { Front: "Question", Back: "Answer" },
  style: {
    css: ".card { font-size: 24px; }",
    includeDefaultStyles: true,
    nightMode: false,
  },
});

document.body.innerHTML = result.styledQuestion;
```

### renderTemplate(template, fields, cardOrdinal?, isQuestion?)

Lower-level API for rendering a single template.

```typescript
async function renderTemplate(
  template: string,
  fields: Record<string, string>,
  cardOrdinal?: number,
  isQuestion?: boolean
): Promise<string>
```

**Note:** This does not handle `FrontSide` substitution automatically. Use `renderCard()` for complete card rendering.

### initWasm()

Initialize the WASM module.

```typescript
async function initWasm(): Promise<void>
```

Called automatically by render functions, but can be called explicitly to control initialization timing.

### isInitialized()

Check if WASM is ready.

```typescript
function isInitialized(): boolean
```

### getVersion()

Get the library version.

```typescript
async function getVersion(): Promise<string>
```

### countClozeCards(fieldContent)

Count unique cloze ordinals in a field.

```typescript
async function countClozeCards(fieldContent: string): Promise<number>
```

**Example:**
```typescript
const count = await countClozeCards("{{c1::Paris}} is in {{c2::France}}");
// Returns 2
```

## Styling Utilities

### buildCss(options)

Build combined CSS from style options.

```typescript
function buildCss(options?: StyleOptions): string
```

### wrapWithStyles(content, css, nightMode?)

Wrap HTML content with styles and `.card` container.

```typescript
function wrapWithStyles(content: string, css: string, nightMode?: boolean): string
```

### createStyledCard(content, options)

Convenience function combining `buildCss()` and `wrapWithStyles()`.

```typescript
function createStyledCard(content: string, options?: StyleOptions): string
```

### CSS Constants

- `DEFAULT_ANKI_CSS` - Anki's default card styles
- `NIGHT_MODE_CSS` - Dark theme overrides

## Types

### NoteFields

```typescript
type NoteFields = Record<string, string>;
```

### RenderOptions

```typescript
interface RenderOptions {
  front: string;
  back: string;
  fields: NoteFields;
  cardOrdinal?: number;  // 0 = non-cloze, 1+ = cloze card number
}
```

### RenderResult

```typescript
interface RenderResult {
  question: string;  // Rendered front HTML
  answer: string;    // Rendered back HTML
}
```

### StyleOptions

```typescript
interface StyleOptions {
  css?: string;                  // Custom CSS
  includeDefaultStyles?: boolean; // Include Anki defaults
  nightMode?: boolean;           // Dark theme
}
```

### StyledRenderResult

```typescript
interface StyledRenderResult extends RenderResult {
  styledQuestion: string;  // Complete HTML with styles
  styledAnswer: string;    // Complete HTML with styles
}
```

### RenderError

Custom error class thrown when rendering fails.

```typescript
class RenderError extends Error {
  name: 'RenderError';
}
```

## Web Component

Import from `anki-renderer/component` to use the web component.

```typescript
import 'anki-renderer/component';
```

### Element: `<anki-card-preview>`

```html
<anki-card-preview
  template-front="{{Word}}"
  template-back="{{Word}}<br>{{Definition}}"
  fields='{"Word": "hello", "Definition": "greeting"}'
  side="question"
  default-styles
  night-mode>
</anki-card-preview>
```

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `template-front` | string | Template for question side |
| `template-back` | string | Template for answer side |
| `fields` | JSON string | Field name/value pairs |
| `side` | "question" \| "answer" | Which side to display |
| `card-ordinal` | number | Card ordinal for cloze (1-indexed) |
| `css` | string | Custom CSS for the card |
| `default-styles` | boolean | Include Anki's default styles |
| `night-mode` | boolean | Enable dark theme |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `render-complete` | `{ content: string, side: string }` | Rendering succeeded |
| `render-error` | `{ message: string, error?: Error }` | Rendering failed |

### JavaScript Properties

All attributes have corresponding camelCase properties:

```typescript
const preview = document.querySelector('anki-card-preview');
preview.templateFront = "{{Front}}";
preview.fields = { Front: "Hello" };
preview.side = "answer";
preview.nightMode = true;
await preview.render();
```

### registerComponent()

Manually register the custom element (auto-registers in browser).

```typescript
import { registerComponent } from 'anki-renderer/component';
registerComponent();
```

## Template Syntax

### Field Substitution
```
{{FieldName}}
```

### Conditionals
```
{{#Field}}shown if Field has content{{/Field}}
{{^Field}}shown if Field is empty{{/Field}}
```

### Filters
Apply right-to-left: `{{filter2:filter1:Field}}`

| Filter | Description |
|--------|-------------|
| `text` | Strip HTML tags |
| `hint` | Wrap in clickable hint element |
| `furigana` | Process ruby text `kanji[reading]` |
| `kanji` | Extract kanji from ruby text |
| `kana` | Extract reading from ruby text |
| `cloze` | Process cloze deletions |
| `type` | Create type-answer input |

### Cloze Deletions
```
{{c1::hidden text}}
{{c1::hidden text::hint}}
```

### Special Fields
- `FrontSide` - Inserts rendered front in back template

## API Design Decisions

### Why `cardOrdinal` uses 0 for non-cloze?

Matches Anki's internal representation where ordinal 0 indicates a non-cloze card, and 1+ indicates the cloze card number. This avoids ambiguity between "card 1" and "no card ordinal".

### Why separate `question`/`answer` vs `front`/`back`?

- Input uses `front`/`back` (template authoring terminology)
- Output uses `question`/`answer` (card display terminology)

This matches how Anki refers to these concepts in different contexts.

### Why is the web component in a separate entry point?

Importing DOM APIs (like `customElements`) breaks Node.js usage. The separate entry point allows server-side rendering with the core API while optionally loading the component in browsers.

### Why `includeDefaultStyles` instead of auto-including?

Many Anki users have custom card styling. Auto-including defaults would cause style conflicts. Explicit opt-in gives control to the consumer.

## Known Limitations

- Multi-card cloze syntax `{{c1,2::shared}}` not supported
- Nested clozes not supported
- Image occlusion clozes not supported
- `cloze-only` and TTS filters not implemented
- Legacy `<%...%>` syntax not supported

These limitations are documented in [LEARNINGS.md](./LEARNINGS.md).
