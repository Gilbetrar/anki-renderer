/**
 * Anki Card Preview Web Component
 *
 * A custom element for rendering Anki card previews with Shadow DOM isolation.
 *
 * @example
 * ```html
 * <anki-card-preview
 *   template-front="{{Word}}"
 *   template-back="{{Word}}<br>{{Definition}}"
 *   fields='{"Word": "hello", "Definition": "greeting"}'
 *   side="question">
 * </anki-card-preview>
 * ```
 */

import { renderCard, initWasm, DEFAULT_ANKI_CSS, NIGHT_MODE_CSS } from './index.js';
import type { NoteFields } from './types.js';

/**
 * Event detail for render-complete event
 */
export interface RenderCompleteDetail {
  /** The rendered HTML content */
  content: string;
  /** Which side was rendered */
  side: 'question' | 'answer';
}

/**
 * Event detail for render-error event
 */
export interface RenderErrorDetail {
  /** Error message */
  message: string;
  /** Original error if available */
  error?: Error;
}

/**
 * Custom element for rendering Anki card previews.
 *
 * Attributes:
 * - `template-front`: Template for the question side
 * - `template-back`: Template for the answer side
 * - `fields`: JSON object of field name/value pairs
 * - `side`: Which side to display ("question" or "answer")
 * - `card-ordinal`: Card ordinal for cloze cards (1-indexed, optional)
 * - `css`: Custom CSS to apply to the card
 * - `night-mode`: Enable night mode (dark theme) - boolean attribute
 * - `default-styles`: Include Anki's default styles - boolean attribute
 *
 * Events:
 * - `render-complete`: Fired when rendering succeeds
 * - `render-error`: Fired when rendering fails
 */
export class AnkiCardPreview extends HTMLElement {
  private shadow: ShadowRoot;
  private baseStyleElement: HTMLStyleElement;
  private customStyleElement: HTMLStyleElement;
  private contentContainer: HTMLDivElement;
  private initialized = false;

  static get observedAttributes(): string[] {
    return ['template-front', 'template-back', 'fields', 'side', 'card-ordinal', 'css', 'night-mode', 'default-styles'];
  }

  constructor() {
    super();

    // Create shadow DOM
    this.shadow = this.attachShadow({ mode: 'open' });

    // Add base styles (component infrastructure)
    this.baseStyleElement = document.createElement('style');
    this.baseStyleElement.textContent = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.5;
      }
      .content {
        padding: 1rem;
      }
      .error {
        color: #dc3545;
        padding: 1rem;
        border: 1px solid #dc3545;
        border-radius: 4px;
        background: #f8d7da;
      }
      .loading {
        color: #6c757d;
        font-style: italic;
      }
      /* Fallback styles if no custom CSS is provided */
      .cloze {
        font-weight: bold;
        color: #0000ff;
      }
      .hint {
        background-color: #ffffcc;
        padding: 2px 4px;
        border-radius: 2px;
        cursor: pointer;
      }
    `;

    // Custom style element for user CSS, default styles, night mode
    this.customStyleElement = document.createElement('style');

    // Create content container (with .card class for CSS targeting)
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'content card loading';
    this.contentContainer.textContent = 'Loading...';

    this.shadow.appendChild(this.baseStyleElement);
    this.shadow.appendChild(this.customStyleElement);
    this.shadow.appendChild(this.contentContainer);
  }

  connectedCallback(): void {
    this.initialized = true;
    this.render();
  }

  disconnectedCallback(): void {
    this.initialized = false;
  }

  attributeChangedCallback(
    _name: string,
    _oldValue: string | null,
    _newValue: string | null
  ): void {
    if (this.initialized) {
      this.render();
    }
    // If not initialized, render() will be called in connectedCallback
  }

  /**
   * Get the current template-front attribute value
   */
  get templateFront(): string {
    return this.getAttribute('template-front') || '';
  }

  set templateFront(value: string) {
    this.setAttribute('template-front', value);
  }

  /**
   * Get the current template-back attribute value
   */
  get templateBack(): string {
    return this.getAttribute('template-back') || '';
  }

  set templateBack(value: string) {
    this.setAttribute('template-back', value);
  }

  /**
   * Get the current fields as an object
   */
  get fields(): NoteFields {
    const fieldsAttr = this.getAttribute('fields');
    if (!fieldsAttr) return {};
    try {
      return JSON.parse(fieldsAttr);
    } catch {
      return {};
    }
  }

  set fields(value: NoteFields) {
    this.setAttribute('fields', JSON.stringify(value));
  }

  /**
   * Get which side to display
   */
  get side(): 'question' | 'answer' {
    const sideAttr = this.getAttribute('side');
    return sideAttr === 'answer' ? 'answer' : 'question';
  }

  set side(value: 'question' | 'answer') {
    this.setAttribute('side', value);
  }

  /**
   * Get the card ordinal for cloze cards (1-indexed, 0 for non-cloze)
   */
  get cardOrdinal(): number {
    const ordinal = parseInt(this.getAttribute('card-ordinal') || '0', 10);
    return isNaN(ordinal) ? 0 : ordinal;
  }

  set cardOrdinal(value: number) {
    this.setAttribute('card-ordinal', String(value));
  }

  /**
   * Get custom CSS for the card
   */
  get css(): string {
    return this.getAttribute('css') || '';
  }

  set css(value: string) {
    this.setAttribute('css', value);
  }

  /**
   * Get whether night mode is enabled
   */
  get nightMode(): boolean {
    return this.hasAttribute('night-mode');
  }

  set nightMode(value: boolean) {
    if (value) {
      this.setAttribute('night-mode', '');
    } else {
      this.removeAttribute('night-mode');
    }
  }

  /**
   * Get whether default Anki styles should be included
   */
  get defaultStyles(): boolean {
    return this.hasAttribute('default-styles');
  }

  set defaultStyles(value: boolean) {
    if (value) {
      this.setAttribute('default-styles', '');
    } else {
      this.removeAttribute('default-styles');
    }
  }

  /**
   * Build the combined CSS for the card
   */
  private buildCardCss(): string {
    const parts: string[] = [];

    if (this.defaultStyles) {
      parts.push(DEFAULT_ANKI_CSS);
    }

    if (this.nightMode) {
      parts.push(NIGHT_MODE_CSS);
    }

    if (this.css) {
      parts.push(this.css);
    }

    return parts.join('\n');
  }

  /**
   * Programmatically trigger a re-render
   */
  async render(): Promise<void> {
    if (!this.initialized) {
      // Will be called again from connectedCallback
      return;
    }

    const front = this.templateFront;
    const back = this.templateBack;
    const fields = this.fields;
    const side = this.side;
    const cardOrdinal = this.cardOrdinal;

    // Update custom CSS
    this.customStyleElement.textContent = this.buildCardCss();

    // Show loading state
    this.contentContainer.className = 'content card loading';
    this.contentContainer.textContent = 'Loading...';

    try {
      // Ensure WASM is initialized
      await initWasm();

      // Render the card
      const result = await renderCard({
        front,
        back,
        fields,
        cardOrdinal,
      });

      // Display the requested side
      const content = side === 'answer' ? result.answer : result.question;

      // Set classes including nightMode if enabled
      const classes = ['content', 'card'];
      if (this.nightMode) {
        classes.push('nightMode');
      }
      this.contentContainer.className = classes.join(' ');
      this.contentContainer.innerHTML = content;

      // Dispatch success event
      this.dispatchEvent(
        new CustomEvent<RenderCompleteDetail>('render-complete', {
          detail: { content, side },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.contentContainer.className = 'content card error';
      this.contentContainer.textContent = `Render error: ${message}`;

      // Dispatch error event
      this.dispatchEvent(
        new CustomEvent<RenderErrorDetail>('render-error', {
          detail: {
            message,
            error: error instanceof Error ? error : undefined,
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}

/**
 * Register the custom element.
 * Call this to make <anki-card-preview> available in the DOM.
 */
export function registerComponent(): void {
  if (!customElements.get('anki-card-preview')) {
    customElements.define('anki-card-preview', AnkiCardPreview);
  }
}

// Auto-register if in browser context and not already defined
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  registerComponent();
}
