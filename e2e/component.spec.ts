import { test, expect } from '@playwright/test';

test.describe('anki-card-preview component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/test.html');
    // Wait for WASM to initialize and first card to render
    await page.waitForFunction(() => {
      const card = document.querySelector('#basic-question');
      if (!card?.shadowRoot) return false;
      const content = card.shadowRoot.querySelector('.content');
      return content && !content.classList.contains('loading');
    }, { timeout: 15000 });
  });

  test('renders basic card question side', async ({ page }) => {
    const content = await page.evaluate(() => {
      const card = document.querySelector('#basic-question');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });

    expect(content).toContain('こんにちは');
    expect(content).not.toContain('Hello');
  });

  test('renders basic card answer side', async ({ page }) => {
    const content = await page.evaluate(() => {
      const card = document.querySelector('#basic-answer');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });

    expect(content).toContain('こんにちは');
    expect(content).toContain('Hello');
  });

  test('renders cloze question side with hidden text', async ({ page }) => {
    const content = await page.evaluate(() => {
      const card = document.querySelector('#cloze-question');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });

    // c1 (Paris) should be hidden
    expect(content).toContain('[...]');
    // c2 (France) should be visible
    expect(content).toContain('France');
    expect(content).not.toContain('Paris');
  });

  test('renders cloze answer side with revealed text', async ({ page }) => {
    const content = await page.evaluate(() => {
      const card = document.querySelector('#cloze-answer');
      return card?.shadowRoot?.querySelector('.content')?.innerHTML;
    });

    // Both should be visible in answer
    expect(content).toContain('Paris');
    expect(content).toContain('France');
    // Cloze class should be present
    expect(content).toContain('class="cloze"');
  });

  test('renders hint filter correctly', async ({ page }) => {
    const content = await page.evaluate(() => {
      const card = document.querySelector('#hint-card');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });

    expect(content).toContain('What is 2+2?');
    // Hint should show clickable element
    expect(content).toContain('Show');
  });

  test('updates dynamically when attributes change', async ({ page }) => {
    // Initial content
    const initialContent = await page.evaluate(() => {
      const card = document.querySelector('#dynamic-card');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });
    expect(initialContent).toContain('Initial question');

    // Click update button
    await page.click('#update-card');

    // Wait for re-render
    await page.waitForFunction(() => {
      const card = document.querySelector('#dynamic-card');
      const content = card?.shadowRoot?.querySelector('.content')?.textContent;
      return content?.includes('Updated question!');
    }, { timeout: 5000 });

    const updatedContent = await page.evaluate(() => {
      const card = document.querySelector('#dynamic-card');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });
    expect(updatedContent).toContain('Updated question!');
  });

  test('uses Shadow DOM for style isolation', async ({ page }) => {
    // Verify shadow root exists
    const hasShadowRoot = await page.evaluate(() => {
      const card = document.querySelector('#basic-question');
      return card?.shadowRoot !== null;
    });
    expect(hasShadowRoot).toBe(true);

    // Verify content is inside shadow DOM
    const shadowContent = await page.evaluate(() => {
      const card = document.querySelector('#basic-question');
      return card?.shadowRoot?.querySelector('.content')?.textContent;
    });
    expect(shadowContent).toContain('こんにちは');
  });

  test('emits render-complete event', async ({ page }) => {
    // Create a new card and listen for events
    const eventFired = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const card = document.createElement('anki-card-preview');
        card.setAttribute('template-front', '{{Test}}');
        card.setAttribute('template-back', '{{Test}}');
        card.setAttribute('fields', JSON.stringify({ Test: 'Event test' }));
        card.setAttribute('side', 'question');

        card.addEventListener('render-complete', (e: Event) => {
          const detail = (e as CustomEvent).detail;
          resolve({
            content: detail.content,
            side: detail.side,
          });
        });

        document.body.appendChild(card);
      });
    });

    expect(eventFired).toEqual({
      content: 'Event test',
      side: 'question',
    });
  });

  test('supports programmatic property access', async ({ page }) => {
    const cardProperties = await page.evaluate(() => {
      const card = document.querySelector('#basic-question') as any;
      return {
        templateFront: card.templateFront,
        templateBack: card.templateBack,
        fields: card.fields,
        side: card.side,
        cardOrdinal: card.cardOrdinal,
      };
    });

    expect(cardProperties.templateFront).toBe('{{Word}}');
    expect(cardProperties.templateBack).toBe('{{Word}}<br>{{Definition}}');
    expect(cardProperties.fields).toEqual({ Word: 'こんにちは', Definition: 'Hello' });
    expect(cardProperties.side).toBe('question');
    expect(cardProperties.cardOrdinal).toBe(0);
  });
});
