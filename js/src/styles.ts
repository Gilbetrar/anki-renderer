/**
 * CSS styling utilities for anki-renderer.
 *
 * Provides default Anki styles, night mode support, and
 * utilities for wrapping rendered content with proper styling.
 */

import type { StyleOptions } from './types.js';

/**
 * Default Anki card styles.
 * Based on Anki's default styling for the card class.
 */
export const DEFAULT_ANKI_CSS = `
.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}

.cloze {
  font-weight: bold;
  color: blue;
}

.hint {
  background-color: #ffffcc;
  padding: 2px 4px;
  border-radius: 2px;
  cursor: pointer;
}

img {
  max-width: 100%;
  height: auto;
}
`;

/**
 * Night mode (dark theme) styles.
 * Inverts colors for comfortable viewing in dark environments.
 */
export const NIGHT_MODE_CSS = `
.card {
  color: white;
  background-color: #2f2f31;
}

.card.nightMode {
  color: white;
  background-color: #2f2f31;
}

.cloze {
  color: #5cb3ff;
}

.hint {
  background-color: #444;
  color: #ccc;
}

a {
  color: #5cb3ff;
}
`;

/**
 * Build complete CSS from style options.
 *
 * @param options - Style configuration
 * @returns Combined CSS string
 */
export function buildCss(options: StyleOptions = {}): string {
  const parts: string[] = [];

  if (options.includeDefaultStyles) {
    parts.push(DEFAULT_ANKI_CSS);
  }

  if (options.nightMode) {
    parts.push(NIGHT_MODE_CSS);
  }

  if (options.css) {
    parts.push(options.css);
  }

  return parts.join('\n');
}

/**
 * Wrap HTML content with a styled card container.
 *
 * @param content - The rendered HTML content
 * @param css - CSS to apply (can be result of buildCss)
 * @param nightMode - Whether to add nightMode class
 * @returns Complete HTML with style tag and wrapper
 */
export function wrapWithStyles(
  content: string,
  css: string,
  nightMode = false
): string {
  const cardClass = nightMode ? 'card nightMode' : 'card';

  // Only include style tag if there's CSS
  const styleTag = css ? `<style>\n${css}\n</style>\n` : '';

  return `${styleTag}<div class="${cardClass}">\n${content}\n</div>`;
}

/**
 * Create a complete styled card HTML.
 *
 * Convenience function that combines buildCss and wrapWithStyles.
 *
 * @param content - The rendered HTML content
 * @param options - Style options
 * @returns Complete HTML with styles and wrapper
 */
export function createStyledCard(
  content: string,
  options: StyleOptions = {}
): string {
  const css = buildCss(options);
  return wrapWithStyles(content, css, options.nightMode);
}
