/**
 * Tests for the AnkiCardPreview web component.
 *
 * The component calls the rendering service over HTTP, so these tests mock
 * global fetch and exercise the full render flow in jsdom. Browser tests
 * against a real service instance are in e2e/component.spec.ts.
 *
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  AnkiCardPreview,
  registerComponent,
  DEFAULT_SERVICE_URL,
} from '../src/component.js';
import type {
  RenderCompleteDetail,
  RenderErrorDetail,
  ServiceRenderResponse,
  RenderedCard,
} from '../src/component.js';

function makeCard(overrides: Partial<RenderedCard> = {}): RenderedCard {
  return {
    ord: 0,
    name: 'Card 1',
    empty: false,
    question: 'Question HTML',
    answer: 'Answer HTML',
    questionAvTags: [],
    answerAvTags: [],
    ...overrides,
  };
}

function makeResponse(overrides: Partial<ServiceRenderResponse> = {}): ServiceRenderResponse {
  return {
    cards: [makeCard()],
    css: '.card { color: black; }',
    ankiVersion: '25.09.4',
    ...overrides,
  };
}

function mockFetchOk(data: ServiceRenderResponse): jest.Mock {
  const mock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    })
  );
  (globalThis as Record<string, unknown>).fetch = mock;
  return mock;
}

function mockFetchError(status: number, body: unknown): jest.Mock {
  const mock = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve(body),
    })
  );
  (globalThis as Record<string, unknown>).fetch = mock;
  return mock;
}

function createPreview(attrs: Record<string, string>): AnkiCardPreview {
  const el = document.createElement('anki-card-preview') as AnkiCardPreview;
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  return el;
}

function waitForEvent<T>(el: HTMLElement, type: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${type}`)),
      timeoutMs
    );
    el.addEventListener(
      type,
      (e) => {
        clearTimeout(timer);
        resolve((e as CustomEvent<T>).detail);
      },
      { once: true }
    );
  });
}

describe('AnkiCardPreview', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).fetch;
  });

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
        'cloze',
        'card-ord',
        'css',
        'night-mode',
        'service-url',
      ]);
    });
  });

  describe('rendering via the service', () => {
    it('POSTs templates and fields to the default service URL', async () => {
      const fetchMock = mockFetchOk(makeResponse());
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{FrontSide}}<hr>{{Back}}',
        fields: JSON.stringify({ Front: 'Q', Back: 'A' }),
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      await done;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${DEFAULT_SERVICE_URL}/render`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        templates: [{ front: '{{Front}}', back: '{{FrontSide}}<hr>{{Back}}', name: 'Card 1' }],
        fields: { Front: 'Q', Back: 'A' },
        cloze: false,
      });
    });

    it('displays the question side and injects the service CSS', async () => {
      mockFetchOk(
        makeResponse({
          cards: [makeCard({ question: '<b>Bonjour</b>', answer: 'Bonjour<hr>Hello' })],
          css: '.card { background: navy; }',
        })
      );
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{FrontSide}}<hr>{{Back}}',
        fields: JSON.stringify({ Front: 'Bonjour', Back: 'Hello' }),
        side: 'question',
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.content).toBe('<b>Bonjour</b>');
      expect(detail.side).toBe('question');
      expect(detail.ankiVersion).toBe('25.09.4');
      const content = el.shadowRoot!.querySelector('.content')!;
      expect(content.innerHTML).toBe('<b>Bonjour</b>');
      expect(content.classList.contains('card')).toBe(true);
      const styles = Array.from(el.shadowRoot!.querySelectorAll('style'))
        .map((s) => s.textContent)
        .join('\n');
      expect(styles).toContain('background: navy');
    });

    it('displays the answer side when side="answer"', async () => {
      mockFetchOk(
        makeResponse({ cards: [makeCard({ question: 'Q side', answer: 'A side' })] })
      );
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{Back}}',
        fields: JSON.stringify({ Front: 'Q', Back: 'A' }),
        side: 'answer',
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.content).toBe('A side');
      expect(el.shadowRoot!.querySelector('.content')!.textContent).toBe('A side');
    });

    it('sends cloze=true and picks the card matching card-ord', async () => {
      const fetchMock = mockFetchOk(
        makeResponse({
          cards: [
            makeCard({ ord: 0, question: 'card zero' }),
            makeCard({ ord: 1, question: 'card one' }),
          ],
        })
      );
      const el = createPreview({
        'template-front': '{{cloze:Text}}',
        'template-back': '{{cloze:Text}}',
        fields: JSON.stringify({ Text: '{{c1::a}} {{c2::b}}' }),
        cloze: '',
        'card-ord': '1',
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      const detail = await done;

      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
      );
      expect(body.cloze).toBe(true);
      expect(detail.content).toBe('card one');
      expect(detail.card.ord).toBe(1);
      expect(detail.cards).toHaveLength(2);
    });

    it('defaults to the first non-empty card when card-ord is not set', async () => {
      mockFetchOk(
        makeResponse({
          cards: [
            makeCard({ ord: 0, empty: true, question: 'empty card' }),
            makeCard({ ord: 1, question: 'real card' }),
          ],
        })
      );
      const el = createPreview({
        'template-front': '{{#Extra}}{{Front}}{{/Extra}}',
        'template-back': '{{Back}}',
        fields: JSON.stringify({ Front: 'Q', Back: 'A', Extra: '' }),
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.content).toBe('real card');
    });

    it('replaces [anki:play:...] audio markers with a placeholder', async () => {
      mockFetchOk(
        makeResponse({
          cards: [
            makeCard({
              question: 'Listen: [anki:play:q:0]',
              questionAvTags: [{ kind: 'sound', filename: 'audio.mp3' }],
            }),
          ],
        })
      );
      const el = createPreview({
        'template-front': '{{Audio}}',
        'template-back': '{{Audio}}',
        fields: JSON.stringify({ Audio: '[sound:audio.mp3]' }),
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.content).not.toContain('[anki:play');
      expect(detail.content).toContain('▶');
      expect(el.shadowRoot!.querySelector('.replay-button')).not.toBeNull();
    });

    it('sends custom css and applies night mode classes', async () => {
      const fetchMock = mockFetchOk(makeResponse({ css: '.card { color: red; }' }));
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{Front}}',
        fields: JSON.stringify({ Front: 'Q' }),
        css: '.card { color: red; }',
        'night-mode': '',
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      await done;

      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
      );
      expect(body.css).toBe('.card { color: red; }');
      const content = el.shadowRoot!.querySelector('.content')!;
      expect(content.classList.contains('night_mode')).toBe(true);
      expect(content.classList.contains('nightMode')).toBe(true);
    });

    it('uses the service-url attribute when provided', async () => {
      const fetchMock = mockFetchOk(makeResponse());
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{Front}}',
        fields: JSON.stringify({ Front: 'Q' }),
        'service-url': 'http://localhost:9003/',
      });
      const done = waitForEvent<RenderCompleteDetail>(el, 'render-complete');
      document.body.appendChild(el);
      await done;

      expect((fetchMock.mock.calls[0] as [string])[0]).toBe('http://localhost:9003/render');
    });

    it('debounces attribute changes into a single service call', async () => {
      const fetchMock = mockFetchOk(makeResponse());
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{Front}}',
        fields: JSON.stringify({ Front: 'Q' }),
      });
      document.body.appendChild(el);
      // Burst of changes before the debounce window elapses
      el.setAttribute('side', 'answer');
      el.setAttribute('fields', JSON.stringify({ Front: 'Q2' }));
      await waitForEvent<RenderCompleteDetail>(el, 'render-complete');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
      );
      expect(body.fields).toEqual({ Front: 'Q2' });
    });
  });

  describe('error handling', () => {
    it('surfaces service template errors via render-error', async () => {
      mockFetchError(400, { detail: 'unknown field: Missing' });
      const el = createPreview({
        'template-front': '{{Missing}}',
        'template-back': '{{Missing}}',
        fields: JSON.stringify({ Front: 'Q' }),
      });
      const done = waitForEvent<RenderErrorDetail>(el, 'render-error');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.message).toBe('unknown field: Missing');
      const content = el.shadowRoot!.querySelector('.content')!;
      expect(content.classList.contains('error')).toBe(true);
      expect(content.textContent).toContain('unknown field: Missing');
    });

    it('errors without calling the service when fields are missing', async () => {
      const fetchMock = mockFetchOk(makeResponse());
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{Front}}',
      });
      const done = waitForEvent<RenderErrorDetail>(el, 'render-error');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.message).toContain('fields');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces network failures via render-error', async () => {
      (globalThis as Record<string, unknown>).fetch = jest.fn(() =>
        Promise.reject(new TypeError('Failed to fetch'))
      );
      const el = createPreview({
        'template-front': '{{Front}}',
        'template-back': '{{Front}}',
        fields: JSON.stringify({ Front: 'Q' }),
      });
      const done = waitForEvent<RenderErrorDetail>(el, 'render-error');
      document.body.appendChild(el);
      const detail = await done;

      expect(detail.message).toBe('Failed to fetch');
    });
  });

  describe('properties', () => {
    it('reflects attributes through properties', () => {
      const el = createPreview({
        'template-front': '{{Word}}',
        'template-back': '{{Word}}<br>{{Definition}}',
        fields: JSON.stringify({ Word: 'hola' }),
        side: 'answer',
        cloze: '',
        'card-ord': '2',
        'service-url': 'http://localhost:9003',
      });

      expect(el.templateFront).toBe('{{Word}}');
      expect(el.templateBack).toBe('{{Word}}<br>{{Definition}}');
      expect(el.fields).toEqual({ Word: 'hola' });
      expect(el.side).toBe('answer');
      expect(el.cloze).toBe(true);
      expect(el.cardOrd).toBe(2);
      expect(el.serviceUrl).toBe('http://localhost:9003');
    });

    it('defaults cardOrd to null and serviceUrl to the public service', () => {
      const el = createPreview({});
      expect(el.cardOrd).toBeNull();
      expect(el.serviceUrl).toBe(DEFAULT_SERVICE_URL);
      expect(el.cloze).toBe(false);
      expect(el.side).toBe('question');
    });
  });
});
