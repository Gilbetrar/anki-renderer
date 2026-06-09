import { test, expect, type Page } from '@playwright/test';

const SERVICE_URL = 'http://localhost:9003';

/** Get the textContent of a card's shadow content container. */
function contentText(page: Page, id: string) {
  return page.evaluate((cardId) => {
    const card = document.querySelector(`#${cardId}`);
    return card?.shadowRoot?.querySelector('.content')?.textContent;
  }, id);
}

/** Get the innerHTML of a card's shadow content container. */
function contentHtml(page: Page, id: string) {
  return page.evaluate((cardId) => {
    const card = document.querySelector(`#${cardId}`);
    return card?.shadowRoot?.querySelector('.content')?.innerHTML;
  }, id);
}

test.describe('anki-card-preview component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/test.html');
    // Wait for all cards to finish their first render against the service
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('anki-card-preview');
      return Array.from(cards).every((card) => {
        const content = card.shadowRoot?.querySelector('.content');
        return content && !content.classList.contains('loading');
      });
    }, { timeout: 15000 });
  });

  test('renders basic card question side', async ({ page }) => {
    const content = await contentText(page, 'basic-question');
    expect(content).toContain('こんにちは');
    expect(content).not.toContain('Hello');
  });

  test('renders basic card answer side with FrontSide expansion', async ({ page }) => {
    const content = await contentText(page, 'basic-answer');
    expect(content).toContain('こんにちは');
    expect(content).toContain('Hello');
  });

  test('renders cloze question side with hidden text', async ({ page }) => {
    // c1 (Paris) should be hidden, c2 (France) visible
    const text = await contentText(page, 'cloze-question');
    expect(text).toContain('[...]');
    expect(text).toContain('France');
    expect(text).not.toContain('Paris');

    // Real Anki cloze markup: data-cloze/data-ordinal attributes
    const html = await contentHtml(page, 'cloze-question');
    expect(html).toContain('data-cloze');
    expect(html).toContain('data-ordinal="1"');
  });

  test('renders cloze answer side with revealed text', async ({ page }) => {
    const html = await contentHtml(page, 'cloze-answer');
    expect(html).toContain('Paris');
    expect(html).toContain('France');
    expect(html).toContain('class="cloze"');
  });

  test('card-ord selects the second cloze ordinal', async ({ page }) => {
    // ord 1 = c2: France hidden, Paris visible
    const text = await contentText(page, 'cloze-second');
    expect(text).toContain('[...]');
    expect(text).toContain('Paris');
    expect(text).not.toContain('France');
  });

  test('renders hint filter as Anki does', async ({ page }) => {
    const text = await contentText(page, 'hint-card');
    expect(text).toContain('What is 2+2?');
    // Anki renders a clickable link named after the field
    expect(text).toContain('Hint');
    const html = await contentHtml(page, 'hint-card');
    expect(html).toContain('class="hint"');
  });

  test('renders punctuation-heavy field names (issue #20)', async ({ page }) => {
    // The old WASM path threw a parse error on this field name
    const content = await contentText(page, 'punctuated-card');
    expect(content).toContain('How to Take Smart Notes');

    const isError = await page.evaluate(() => {
      const card = document.querySelector('#punctuated-card');
      return card?.shadowRoot
        ?.querySelector('.content')
        ?.classList.contains('error');
    });
    expect(isError).toBe(false);
  });

  test('replaces audio markers with a placeholder', async ({ page }) => {
    const text = await contentText(page, 'audio-card');
    expect(text).toContain('Listen:');
    expect(text).toContain('▶');
    expect(text).not.toContain('[anki:play');
  });

  test('injects the note type CSS from the service', async ({ page }) => {
    const styles = await page.evaluate(() => {
      const card = document.querySelector('#basic-question');
      return Array.from(card?.shadowRoot?.querySelectorAll('style') ?? [])
        .map((s) => s.textContent)
        .join('\n');
    });
    // Anki's stock .card css is returned when no custom css is sent
    expect(styles).toContain('.card {');
    expect(styles).toContain('font-family: arial');
  });

  test('updates dynamically when attributes change', async ({ page }) => {
    const initialContent = await contentText(page, 'dynamic-card');
    expect(initialContent).toContain('Initial question');

    await page.click('#update-card');

    await page.waitForFunction(() => {
      const card = document.querySelector('#dynamic-card');
      const content = card?.shadowRoot?.querySelector('.content')?.textContent;
      return content?.includes('Updated question!');
    }, { timeout: 5000 });

    const updatedContent = await contentText(page, 'dynamic-card');
    expect(updatedContent).toContain('Updated question!');
  });

  test('uses Shadow DOM for style isolation', async ({ page }) => {
    const hasShadowRoot = await page.evaluate(() => {
      const card = document.querySelector('#basic-question');
      return card?.shadowRoot !== null;
    });
    expect(hasShadowRoot).toBe(true);

    const shadowContent = await contentText(page, 'basic-question');
    expect(shadowContent).toContain('こんにちは');
  });

  test('emits render-complete event with card details', async ({ page }) => {
    const eventDetail = await page.evaluate(async (serviceUrl) => {
      return new Promise((resolve) => {
        const card = document.createElement('anki-card-preview');
        card.setAttribute('service-url', serviceUrl);
        card.setAttribute('template-front', '{{Test}}');
        card.setAttribute('template-back', '{{Test}}');
        card.setAttribute('fields', JSON.stringify({ Test: 'Event test' }));
        card.setAttribute('side', 'question');

        card.addEventListener('render-complete', (e: Event) => {
          const detail = (e as CustomEvent).detail;
          resolve({
            content: detail.content,
            side: detail.side,
            cardOrd: detail.card.ord,
            cardCount: detail.cards.length,
            hasVersion: typeof detail.ankiVersion === 'string' && detail.ankiVersion.length > 0,
          });
        });

        document.body.appendChild(card);
      });
    }, SERVICE_URL);

    expect(eventDetail).toEqual({
      content: 'Event test',
      side: 'question',
      cardOrd: 0,
      cardCount: 1,
      hasVersion: true,
    });
  });

  test('emits render-error on template errors with Anki message', async ({ page }) => {
    const errorDetail = await page.evaluate(async (serviceUrl) => {
      return new Promise<string>((resolve) => {
        const card = document.createElement('anki-card-preview');
        card.setAttribute('service-url', serviceUrl);
        card.setAttribute('template-front', '{{#Unclosed}}oops');
        card.setAttribute('template-back', '{{Front}}');
        card.setAttribute('fields', JSON.stringify({ Front: 'Q' }));

        card.addEventListener('render-error', (e: Event) => {
          resolve((e as CustomEvent).detail.message);
        });

        document.body.appendChild(card);
      });
    }, SERVICE_URL);

    expect(errorDetail.length).toBeGreaterThan(0);
  });

  test('supports programmatic property access', async ({ page }) => {
    const cardProperties = await page.evaluate(() => {
      const card = document.querySelector('#cloze-second') as any;
      return {
        templateFront: card.templateFront,
        side: card.side,
        cloze: card.cloze,
        cardOrd: card.cardOrd,
        serviceUrl: card.serviceUrl,
      };
    });

    expect(cardProperties.templateFront).toBe('{{cloze:Text}}');
    expect(cardProperties.side).toBe('question');
    expect(cardProperties.cloze).toBe(true);
    expect(cardProperties.cardOrd).toBe(1);
    expect(cardProperties.serviceUrl).toBe(SERVICE_URL);
  });

  test('does not load any WASM in the component bundle', async ({ page }) => {
    const wasmRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('.wasm') || req.url().includes('pkg/')) {
        wasmRequests.push(req.url());
      }
    });
    await page.reload();
    await page.waitForFunction(() => {
      const card = document.querySelector('#basic-question');
      const content = card?.shadowRoot?.querySelector('.content');
      return content && !content.classList.contains('loading');
    }, { timeout: 15000 });
    expect(wasmRequests).toEqual([]);
  });
});
