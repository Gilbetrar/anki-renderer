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
