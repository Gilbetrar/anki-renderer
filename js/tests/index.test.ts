/**
 * Tests for anki-renderer TypeScript bindings
 */

import {
  renderCard,
  renderTemplate,
  renderStyledCard,
  countClozeCards,
  getVersion,
  initWasm,
  isInitialized,
  RenderError,
  DEFAULT_ANKI_CSS,
  NIGHT_MODE_CSS,
  buildCss,
  wrapWithStyles,
  createStyledCard,
} from '../src/index.js';

describe('anki-renderer', () => {
  // Initialize WASM once before all tests
  beforeAll(async () => {
    await initWasm();
  });

  describe('initWasm', () => {
    it('should initialize successfully', async () => {
      expect(isInitialized()).toBe(true);
    });

    it('should return immediately if already initialized', async () => {
      await initWasm(); // Should not throw
      expect(isInitialized()).toBe(true);
    });
  });

  describe('getVersion', () => {
    it('should return a version string', async () => {
      const version = await getVersion();
      expect(version).toBe('0.1.0');
    });
  });

  describe('renderCard', () => {
    it('should render a basic card', async () => {
      const result = await renderCard({
        front: '{{Front}}',
        back: '{{FrontSide}}<hr>{{Back}}',
        fields: { Front: 'Question', Back: 'Answer' },
      });

      expect(result.question).toBe('Question');
      expect(result.answer).toContain('Question');
      expect(result.answer).toContain('Answer');
      expect(result.answer).toContain('<hr>');
    });

    it('should handle FrontSide replacement', async () => {
      const result = await renderCard({
        front: '<b>{{Front}}</b>',
        back: '{{FrontSide}}<hr>{{Back}}',
        fields: { Front: 'Bold Question', Back: 'Answer' },
      });

      expect(result.question).toBe('<b>Bold Question</b>');
      expect(result.answer).toBe('<b>Bold Question</b><hr>Answer');
    });

    it('should handle conditionals', async () => {
      const result = await renderCard({
        front: '{{#Extra}}Has extra: {{Extra}}{{/Extra}}{{^Extra}}No extra{{/Extra}}',
        back: '{{Back}}',
        fields: { Extra: 'Some extra info', Back: 'Answer' },
      });

      expect(result.question).toBe('Has extra: Some extra info');
    });

    it('should handle negative conditionals', async () => {
      const result = await renderCard({
        front: '{{#Extra}}Has extra{{/Extra}}{{^Extra}}No extra{{/Extra}}',
        back: '{{Back}}',
        fields: { Back: 'Answer' },
      });

      expect(result.question).toBe('No extra');
    });

    it('should handle missing fields gracefully', async () => {
      const result = await renderCard({
        front: '{{NonExistent}}',
        back: '{{Back}}',
        fields: { Back: 'Answer' },
      });

      // Missing fields render as empty
      expect(result.question).toBe('');
    });
  });

  describe('renderCard with cloze', () => {
    it('should render cloze question side', async () => {
      const result = await renderCard({
        front: '{{cloze:Text}}',
        back: '{{cloze:Text}}',
        fields: { Text: '{{c1::Paris}} is the capital of {{c2::France}}' },
        cardOrdinal: 1,
      });

      expect(result.question).toContain('[...]');
      expect(result.question).toContain('France'); // c2 should be revealed
      expect(result.question).not.toContain('Paris'); // c1 should be hidden
    });

    it('should render cloze answer side', async () => {
      const result = await renderCard({
        front: '{{cloze:Text}}',
        back: '{{cloze:Text}}',
        fields: { Text: '{{c1::Paris}} is the capital of {{c2::France}}' },
        cardOrdinal: 1,
      });

      expect(result.answer).toContain('Paris');
      expect(result.answer).toContain('cloze'); // Should have cloze class
    });

    it('should render cloze with hint', async () => {
      const result = await renderCard({
        front: '{{cloze:Text}}',
        back: '{{cloze:Text}}',
        fields: { Text: '{{c1::Paris::capital city}} is in France' },
        cardOrdinal: 1,
      });

      expect(result.question).toContain('[capital city]');
    });
  });

  describe('countClozeCards', () => {
    it('should count cloze ordinals', async () => {
      const count = await countClozeCards(
        '{{c1::Paris}} is the capital of {{c2::France}}'
      );
      expect(count).toBe(2);
    });

    it('should return 0 for non-cloze content', async () => {
      const count = await countClozeCards('Just plain text');
      expect(count).toBe(0);
    });

    it('should count repeated ordinals once', async () => {
      const count = await countClozeCards('{{c1::one}} and {{c1::another}}');
      expect(count).toBe(1);
    });
  });

  describe('renderTemplate', () => {
    it('should render a single template', async () => {
      const result = await renderTemplate('Hello {{Name}}!', { Name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should handle cloze with ordinal', async () => {
      const result = await renderTemplate(
        '{{cloze:Text}}',
        { Text: '{{c1::Paris}}' },
        1,
        true
      );
      expect(result).toContain('[...]');
    });
  });

  describe('RenderError', () => {
    it('should be exported', () => {
      expect(RenderError).toBeDefined();
      const error = new RenderError('test error');
      expect(error.name).toBe('RenderError');
      expect(error.message).toBe('test error');
    });
  });

  describe('filters', () => {
    it('should apply text filter', async () => {
      const result = await renderCard({
        front: '{{text:Content}}',
        back: '{{Back}}',
        fields: { Content: '<b>Bold</b> text', Back: 'Answer' },
      });

      expect(result.question).not.toContain('<b>');
      expect(result.question).toContain('Bold');
    });

    it('should apply hint filter', async () => {
      const result = await renderCard({
        front: '{{hint:Extra}}',
        back: '{{Back}}',
        fields: { Extra: 'Hidden content', Back: 'Answer' },
      });

      // Hint filter creates a clickable "Show Hint" element
      expect(result.question).toContain('Show Hint');
      expect(result.question).toContain('Hidden content');
    });
  });

  describe('CSS styling', () => {
    describe('style constants', () => {
      it('should export DEFAULT_ANKI_CSS', () => {
        expect(DEFAULT_ANKI_CSS).toBeDefined();
        expect(DEFAULT_ANKI_CSS).toContain('.card');
        expect(DEFAULT_ANKI_CSS).toContain('.cloze');
      });

      it('should export NIGHT_MODE_CSS', () => {
        expect(NIGHT_MODE_CSS).toBeDefined();
        expect(NIGHT_MODE_CSS).toContain('nightMode');
        expect(NIGHT_MODE_CSS).toContain('background-color');
      });
    });

    describe('buildCss', () => {
      it('should return empty string with no options', () => {
        const css = buildCss({});
        expect(css).toBe('');
      });

      it('should include default styles when requested', () => {
        const css = buildCss({ includeDefaultStyles: true });
        expect(css).toContain('.card');
        expect(css).toContain('.cloze');
      });

      it('should include night mode styles when requested', () => {
        const css = buildCss({ nightMode: true });
        expect(css).toContain('nightMode');
      });

      it('should include custom CSS', () => {
        const css = buildCss({ css: '.custom { color: red; }' });
        expect(css).toContain('.custom');
        expect(css).toContain('color: red');
      });

      it('should combine all styles', () => {
        const css = buildCss({
          includeDefaultStyles: true,
          nightMode: true,
          css: '.custom { color: red; }',
        });
        expect(css).toContain('.card');
        expect(css).toContain('nightMode');
        expect(css).toContain('.custom');
      });
    });

    describe('wrapWithStyles', () => {
      it('should wrap content in card div', () => {
        const result = wrapWithStyles('Content', '');
        expect(result).toContain('<div class="card">');
        expect(result).toContain('Content');
        expect(result).toContain('</div>');
      });

      it('should include style tag when CSS provided', () => {
        const result = wrapWithStyles('Content', '.card { color: blue; }');
        expect(result).toContain('<style>');
        expect(result).toContain('.card { color: blue; }');
        expect(result).toContain('</style>');
      });

      it('should add nightMode class when enabled', () => {
        const result = wrapWithStyles('Content', '', true);
        expect(result).toContain('class="card nightMode"');
      });
    });

    describe('createStyledCard', () => {
      it('should create styled card with default options', () => {
        const result = createStyledCard('Content');
        expect(result).toContain('<div class="card">');
        expect(result).toContain('Content');
      });

      it('should create styled card with custom CSS', () => {
        const result = createStyledCard('Content', {
          css: '.card { background: navy; }',
        });
        expect(result).toContain('background: navy');
      });
    });

    describe('renderStyledCard', () => {
      it('should render card with styling', async () => {
        const result = await renderStyledCard({
          front: '{{Front}}',
          back: '{{Back}}',
          fields: { Front: 'Question', Back: 'Answer' },
          style: {
            css: '.card { background: navy; color: white; }',
          },
        });

        // Should have raw content
        expect(result.question).toBe('Question');
        expect(result.answer).toBe('Answer');

        // Should have styled content
        expect(result.styledQuestion).toContain('navy');
        expect(result.styledQuestion).toContain('<div class="card">');
        expect(result.styledAnswer).toContain('navy');
      });

      it('should render with default styles', async () => {
        const result = await renderStyledCard({
          front: '{{Front}}',
          back: '{{Back}}',
          fields: { Front: 'Question', Back: 'Answer' },
          style: {
            includeDefaultStyles: true,
          },
        });

        expect(result.styledQuestion).toContain('.card');
        expect(result.styledQuestion).toContain('.cloze');
      });

      it('should render with night mode', async () => {
        const result = await renderStyledCard({
          front: '{{Front}}',
          back: '{{Back}}',
          fields: { Front: 'Question', Back: 'Answer' },
          style: {
            nightMode: true,
          },
        });

        expect(result.styledQuestion).toContain('nightMode');
        expect(result.styledQuestion).toContain('class="card nightMode"');
      });

      it('should render cloze with styling', async () => {
        const result = await renderStyledCard({
          front: '{{cloze:Text}}',
          back: '{{cloze:Text}}',
          fields: { Text: '{{c1::Paris}} is the capital of France' },
          cardOrdinal: 1,
          style: {
            includeDefaultStyles: true,
          },
        });

        expect(result.question).toContain('[...]');
        expect(result.styledQuestion).toContain('<div class="card">');
        expect(result.styledQuestion).toContain('.cloze');
      });
    });
  });
});
