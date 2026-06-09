/**
 * Anki Card Preview Web Component
 *
 * A custom element for rendering Anki card previews with Shadow DOM isolation.
 * Rendering is delegated to the anki-renderer service, which wraps the
 * official Anki engine — output HTML is exactly what Anki desktop produces.
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

import { NIGHT_MODE_CSS } from './styles.js';
import type { NoteFields } from './types.js';

/**
 * Default rendering service endpoint.
 */
export const DEFAULT_SERVICE_URL = 'https://anki-renderer.bjblabs.com/api';

/**
 * How long attribute changes are coalesced before re-rendering (ms).
 */
const RENDER_DEBOUNCE_MS = 50;

/**
 * An audio/TTS tag extracted by the service from `[sound:...]` / `{{tts ...}}`.
 */
export interface AvTag {
  kind: 'sound' | 'tts';
  filename?: string;
  fieldText?: string;
  lang?: string;
  voices?: string[];
  speed?: number;
}

/**
 * One rendered card from the service (one per template, or one per cloze
 * ordinal for cloze note types).
 */
export interface RenderedCard {
  /** Card ordinal (0-indexed; cloze ordinal for cloze note types) */
  ord: number;
  /** Template name */
  name: string;
  /** True if Anki would not generate this card (front renders empty) */
  empty: boolean;
  /** Question HTML, exactly as Anki produces it */
  question: string;
  /** Answer HTML, exactly as Anki produces it */
  answer: string;
  questionAvTags: AvTag[];
  answerAvTags: AvTag[];
}

/**
 * Response from the rendering service's POST /render endpoint.
 */
export interface ServiceRenderResponse {
  cards: RenderedCard[];
  /** Note type CSS (the request css, or Anki's stock .card css) */
  css: string;
  ankiVersion: string;
}

/**
 * Event detail for render-complete event
 */
export interface RenderCompleteDetail {
  /** The rendered HTML content (after audio markers are replaced) */
  content: string;
  /** Which side was rendered */
  side: 'question' | 'answer';
  /** The card that was displayed */
  card: RenderedCard;
  /** All cards returned by the service */
  cards: RenderedCard[];
  /** Version of the Anki engine that rendered the card */
  ankiVersion: string;
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
 * - `cloze`: Treat the note type as cloze - boolean attribute
 * - `card-ord`: Which card to display, by 0-indexed ordinal (for cloze, one
 *   card exists per cloze ordinal). Defaults to the first non-empty card.
 * - `css`: Note type CSS (replaces Anki's stock .card css, as in Anki)
 * - `night-mode`: Enable night mode (dark theme) - boolean attribute
 * - `service-url`: Base URL of the rendering service
 *
 * Events:
 * - `render-complete`: Fired when rendering succeeds
 * - `render-error`: Fired when rendering fails
 */
export class AnkiCardPreview extends HTMLElement {
  private shadow: ShadowRoot;
  private baseStyleElement: HTMLStyleElement;
  private cardStyleElement: HTMLStyleElement;
  private contentContainer: HTMLDivElement;
  private initialized = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private renderSeq = 0;

  static get observedAttributes(): string[] {
    return [
      'template-front',
      'template-back',
      'fields',
      'side',
      'cloze',
      'card-ord',
      'css',
      'night-mode',
      'service-url',
    ];
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
      .replay-button {
        display: inline-block;
        cursor: default;
        color: #0a5;
      }
    `;

    // Style element for the note type CSS returned by the service
    this.cardStyleElement = document.createElement('style');

    // Create content container (with .card class for CSS targeting)
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'content card loading';
    this.contentContainer.textContent = 'Loading...';

    this.shadow.appendChild(this.baseStyleElement);
    this.shadow.appendChild(this.cardStyleElement);
    this.shadow.appendChild(this.contentContainer);
  }

  connectedCallback(): void {
    this.initialized = true;
    this.scheduleRender();
  }

  disconnectedCallback(): void {
    this.initialized = false;
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  attributeChangedCallback(
    _name: string,
    _oldValue: string | null,
    _newValue: string | null
  ): void {
    if (this.initialized) {
      this.scheduleRender();
    }
    // If not initialized, render is scheduled in connectedCallback
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
   * Get whether the note type is treated as cloze
   */
  get cloze(): boolean {
    return this.hasAttribute('cloze');
  }

  set cloze(value: boolean) {
    if (value) {
      this.setAttribute('cloze', '');
    } else {
      this.removeAttribute('cloze');
    }
  }

  /**
   * Get the card ordinal to display (0-indexed), or null to auto-pick
   * the first non-empty card.
   */
  get cardOrd(): number | null {
    const attr = this.getAttribute('card-ord');
    if (attr === null || attr === '') return null;
    const ord = parseInt(attr, 10);
    return isNaN(ord) ? null : ord;
  }

  set cardOrd(value: number | null) {
    if (value === null) {
      this.removeAttribute('card-ord');
    } else {
      this.setAttribute('card-ord', String(value));
    }
  }

  /**
   * Get the note type CSS for the card
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
   * Get the rendering service base URL
   */
  get serviceUrl(): string {
    const url = this.getAttribute('service-url') || DEFAULT_SERVICE_URL;
    return url.replace(/\/+$/, '');
  }

  set serviceUrl(value: string) {
    this.setAttribute('service-url', value);
  }

  /**
   * Schedule a debounced render. Multiple attribute changes within the
   * debounce window result in a single service call.
   */
  private scheduleRender(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      void this.render();
    }, RENDER_DEBOUNCE_MS);
  }

  /**
   * Replace Anki's `[anki:play:q:0]` audio markers with a ▶ placeholder
   * (display-accurate; no playback).
   */
  private static replaceAvMarkers(html: string): string {
    return html.replace(
      /\[anki:play:[qa]:\d+\]/g,
      '<span class="replay-button" title="Audio">▶</span>'
    );
  }

  /**
   * Pick which card to display: explicit card-ord if set, otherwise the
   * first card Anki would actually generate, otherwise the first card.
   */
  private pickCard(cards: RenderedCard[]): RenderedCard {
    const ord = this.cardOrd;
    if (ord !== null) {
      const match = cards.find((c) => c.ord === ord);
      if (!match) {
        throw new Error(
          `no card with ordinal ${ord} (got: ${cards.map((c) => c.ord).join(', ')})`
        );
      }
      return match;
    }
    return cards.find((c) => !c.empty) || cards[0];
  }

  /**
   * Programmatically trigger a re-render (calls the rendering service).
   */
  async render(): Promise<void> {
    if (!this.initialized) {
      // Will be scheduled again from connectedCallback
      return;
    }

    const seq = ++this.renderSeq;
    const side = this.side;

    // Show loading state
    this.contentContainer.className = 'content card loading';
    this.contentContainer.textContent = 'Loading...';

    try {
      const fields = this.fields;
      if (Object.keys(fields).length === 0) {
        throw new Error('fields attribute must be a JSON object with at least one field');
      }

      const body: Record<string, unknown> = {
        templates: [
          { front: this.templateFront, back: this.templateBack, name: 'Card 1' },
        ],
        fields,
        cloze: this.cloze,
      };
      if (this.css) {
        body.css = this.css;
      }

      const response = await fetch(`${this.serviceUrl}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let detail = `service responded with ${response.status}`;
        try {
          const errBody = await response.json();
          if (typeof errBody.detail === 'string') {
            detail = errBody.detail;
          } else if (errBody.detail) {
            detail = JSON.stringify(errBody.detail);
          }
        } catch {
          // Keep the status-based message
        }
        throw new Error(detail);
      }

      const data: ServiceRenderResponse = await response.json();

      // A newer render started while this one was in flight — drop it
      if (seq !== this.renderSeq) {
        return;
      }

      const card = this.pickCard(data.cards);
      const raw = side === 'answer' ? card.answer : card.question;
      const content = AnkiCardPreview.replaceAvMarkers(raw);

      // Inject the note type CSS so it applies as in Anki; night mode
      // overrides come after so they win the cascade
      this.cardStyleElement.textContent = this.nightMode
        ? `${data.css}\n${NIGHT_MODE_CSS}`
        : data.css;

      // Standard Anki classes so note type CSS applies as in Anki
      const classes = ['content', 'card'];
      if (this.nightMode) {
        classes.push('night_mode', 'nightMode');
      }
      this.contentContainer.className = classes.join(' ');
      this.contentContainer.innerHTML = content;

      // Dispatch success event
      this.dispatchEvent(
        new CustomEvent<RenderCompleteDetail>('render-complete', {
          detail: { content, side, card, cards: data.cards, ankiVersion: data.ankiVersion },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      if (seq !== this.renderSeq) {
        return;
      }
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
