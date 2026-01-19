/**
 * anki-renderer - Anki card template renderer
 *
 * @example
 * ```typescript
 * import { renderCard, initWasm } from 'anki-renderer';
 *
 * // Optional: pre-initialize WASM
 * await initWasm();
 *
 * const result = await renderCard({
 *   front: "{{Front}}",
 *   back: "{{FrontSide}}<hr>{{Back}}",
 *   fields: { Front: "Question", Back: "Answer" },
 * });
 *
 * console.log(result.question); // "Question"
 * console.log(result.answer);   // "Question<hr>Answer"
 * ```
 */

export type { NoteFields, CardTemplate, RenderOptions, RenderResult } from './types.js';
export { RenderError } from './types.js';

// Note: Web Component (AnkiCardPreview) is exported separately from 'anki-renderer/component'
// to avoid loading DOM APIs in Node.js environments

import type { RenderOptions, RenderResult } from './types.js';
import { RenderError } from './types.js';

// WASM module interface
interface WasmModule {
  render_template(template: string, fields_json: string): string;
  render_cloze_card(
    template: string,
    fields_json: string,
    card_ord: number,
    is_question: boolean
  ): string;
  count_cloze_cards(field_content: string): number;
  version(): string;
}

// Module state
let wasmModule: WasmModule | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Detect if running in Node.js environment
 */
function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Load the WASM module for browser environment
 */
async function loadBrowserWasm(): Promise<WasmModule> {
  // Dynamic import of the generated WASM bindings
  const wasm = await import('../../pkg/anki_renderer.js');
  await wasm.default();
  return wasm as unknown as WasmModule;
}

/**
 * Load the WASM module for Node.js environment
 */
async function loadNodeWasm(): Promise<WasmModule> {
  // In Node.js, use the nodejs target build
  const wasm = await import('../../pkg-node/anki_renderer.js');
  return wasm as unknown as WasmModule;
}

/**
 * Initialize the WASM module.
 *
 * This is called automatically by renderCard() if not already initialized,
 * but you can call it explicitly to control when initialization happens.
 *
 * @returns Promise that resolves when WASM is ready
 * @throws Error if WASM fails to load
 */
export async function initWasm(): Promise<void> {
  if (wasmModule) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      if (isNode()) {
        wasmModule = await loadNodeWasm();
      } else {
        wasmModule = await loadBrowserWasm();
      }
    } catch (error) {
      initPromise = null;
      throw new Error(
        `Failed to load WASM module: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  })();

  return initPromise;
}

/**
 * Check if the WASM module is initialized.
 */
export function isInitialized(): boolean {
  return wasmModule !== null;
}

/**
 * Get the library version.
 *
 * @returns Version string (e.g., "0.1.0")
 * @throws Error if WASM is not initialized
 */
export async function getVersion(): Promise<string> {
  await initWasm();
  return wasmModule!.version();
}

/**
 * Count the number of cloze cards a field generates.
 *
 * @param fieldContent - Field content containing cloze syntax (e.g., "{{c1::text}}")
 * @returns Number of unique cloze ordinals (number of cards)
 */
export async function countClozeCards(fieldContent: string): Promise<number> {
  await initWasm();
  return wasmModule!.count_cloze_cards(fieldContent);
}

/**
 * Render a card's front and back templates with the given fields.
 *
 * Handles:
 * - Field substitution: {{FieldName}}
 * - Conditionals: {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}
 * - Filters: {{filter:FieldName}}
 * - Cloze deletions: {{cloze:FieldName}} with {{c1::text}}
 * - FrontSide replacement in back template
 *
 * @param options - Rendering options
 * @returns Rendered question and answer HTML
 * @throws RenderError if rendering fails
 *
 * @example
 * ```typescript
 * // Basic card
 * const result = await renderCard({
 *   front: "{{Front}}",
 *   back: "{{FrontSide}}<hr>{{Back}}",
 *   fields: { Front: "What is 2+2?", Back: "4" },
 * });
 *
 * // Cloze card
 * const clozeResult = await renderCard({
 *   front: "{{cloze:Text}}",
 *   back: "{{cloze:Text}}",
 *   fields: { Text: "{{c1::Paris}} is the capital of {{c2::France}}" },
 *   cardOrdinal: 1,
 * });
 * ```
 */
export async function renderCard(options: RenderOptions): Promise<RenderResult> {
  await initWasm();

  const { front, back, fields, cardOrdinal = 0 } = options;

  try {
    let question: string;
    let answer: string;

    if (cardOrdinal > 0) {
      // Cloze card rendering
      question = wasmModule!.render_cloze_card(front, JSON.stringify(fields), cardOrdinal, true);

      // Add FrontSide to fields for back template rendering
      const backFields = { ...fields, FrontSide: question };
      answer = wasmModule!.render_cloze_card(back, JSON.stringify(backFields), cardOrdinal, false);
    } else {
      // Regular card rendering
      question = wasmModule!.render_template(front, JSON.stringify(fields));

      // Add FrontSide to fields for back template rendering
      const backFields = { ...fields, FrontSide: question };
      answer = wasmModule!.render_template(back, JSON.stringify(backFields));
    }

    return { question, answer };
  } catch (error) {
    throw new RenderError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Render a single template with fields.
 *
 * Lower-level API for rendering just one template side.
 *
 * @param template - Template string
 * @param fields - Field values
 * @param cardOrdinal - Card ordinal for cloze (0 for non-cloze)
 * @param isQuestion - Whether rendering question side (for cloze)
 * @returns Rendered HTML
 * @throws RenderError if rendering fails
 */
export async function renderTemplate(
  template: string,
  fields: Record<string, string>,
  cardOrdinal = 0,
  isQuestion = false
): Promise<string> {
  await initWasm();

  const fieldsJson = JSON.stringify(fields);

  try {
    if (cardOrdinal > 0) {
      return wasmModule!.render_cloze_card(template, fieldsJson, cardOrdinal, isQuestion);
    }
    return wasmModule!.render_template(template, fieldsJson);
  } catch (error) {
    throw new RenderError(
      error instanceof Error ? error.message : String(error)
    );
  }
}
