/**
 * TypeScript type definitions for anki-renderer
 */

/**
 * A map of field names to field values.
 */
export type NoteFields = Record<string, string>;

/**
 * Card template with front and back templates.
 */
export interface CardTemplate {
  /** Template for the question side (front) */
  front: string;
  /** Template for the answer side (back) */
  back: string;
}

/**
 * Options for styling the rendered card.
 */
export interface StyleOptions {
  /**
   * Custom CSS to apply to the card.
   * Will be scoped to the .card container.
   */
  css?: string;
  /**
   * Include Anki's default card styles.
   * @default false
   */
  includeDefaultStyles?: boolean;
  /**
   * Enable night mode (dark theme) styles.
   * @default false
   */
  nightMode?: boolean;
}

/**
 * Options for rendering a card.
 */
export interface RenderOptions {
  /** Card templates */
  front: string;
  back: string;
  /** Field values for the note */
  fields: NoteFields;
  /**
   * Card ordinal for cloze cards (1-indexed).
   * Use 0 or omit for non-cloze cards.
   * @default 0
   */
  cardOrdinal?: number;
}

/**
 * Result of rendering a card.
 */
export interface RenderResult {
  /** Rendered HTML for the question (front) side */
  question: string;
  /** Rendered HTML for the answer (back) side */
  answer: string;
}

/**
 * Result of rendering a styled card.
 */
export interface StyledRenderResult extends RenderResult {
  /** Complete HTML for the styled question side (includes style tag and wrapper) */
  styledQuestion: string;
  /** Complete HTML for the styled answer side (includes style tag and wrapper) */
  styledAnswer: string;
}

/**
 * Error thrown when card rendering fails.
 */
export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RenderError);
    }
  }
}
