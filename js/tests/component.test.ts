/**
 * Tests for AnkiCardPreview web component exports
 *
 * Note: Full browser testing with Playwright is in e2e/component.spec.ts.
 * These tests verify the module exports are correct and the class is valid.
 *
 * @jest-environment jsdom
 */

import { AnkiCardPreview, registerComponent } from '../src/component.js';
import type { RenderCompleteDetail, RenderErrorDetail } from '../src/component.js';

describe('AnkiCardPreview', () => {
  describe('exports', () => {
    it('should export AnkiCardPreview class', () => {
      expect(AnkiCardPreview).toBeDefined();
      expect(typeof AnkiCardPreview).toBe('function');
    });

    it('should export registerComponent function', () => {
      expect(registerComponent).toBeDefined();
      expect(typeof registerComponent).toBe('function');
    });

    it('should have correct class prototype', () => {
      expect(AnkiCardPreview.prototype).toBeDefined();
      // Check that it has the expected methods
      expect(typeof AnkiCardPreview.prototype.render).toBe('function');
      expect(typeof AnkiCardPreview.prototype.connectedCallback).toBe('function');
      expect(typeof AnkiCardPreview.prototype.disconnectedCallback).toBe('function');
      expect(typeof AnkiCardPreview.prototype.attributeChangedCallback).toBe('function');
    });

    it('should have observedAttributes defined', () => {
      expect(AnkiCardPreview.observedAttributes).toEqual([
        'template-front',
        'template-back',
        'fields',
        'side',
        'card-ordinal',
        'css',
        'night-mode',
        'default-styles',
      ]);
    });
  });

  describe('type exports', () => {
    it('should allow creating typed event details', () => {
      // These are compile-time checks - if they compile, types are correct
      const completeDetail: RenderCompleteDetail = {
        content: '<b>test</b>',
        side: 'question',
      };
      expect(completeDetail.content).toBe('<b>test</b>');

      const errorDetail: RenderErrorDetail = {
        message: 'test error',
        error: new Error('test'),
      };
      expect(errorDetail.message).toBe('test error');
    });
  });
});
