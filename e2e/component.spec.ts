import { test, expect } from '@playwright/test';

test.describe('AnkiCardPreview Web Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test.html');
    // Wait for WASM to initialize
    await page.waitForFunction(() => {
      const log = document.getElementById('event-log');
      return log?.textContent?.includes('WASM initialized successfully');
    });
  });

  test('renders basic card question side', async ({ page }) => {
    const card = page.locator('#basic-card');

    // Check that content container exists in shadow DOM
    const content = card.locator('div.content');
    await expect(content).toBeVisible();
    await expect(content).toContainText('What is 2 + 2?');
  });

  test('toggles between question and answer', async ({ page }) => {
    const card = page.locator('#basic-card');
    const content = card.locator('div.content');

    // Initially shows question
    await expect(content).toContainText('What is 2 + 2?');
    await expect(content).not.toContainText('<hr');

    // Click toggle button
    await page.click('button:text("Toggle Side"):near(#basic-card)');

    // Now shows answer with FrontSide and Back
    await expect(content).toContainText('What is 2 + 2?');
    await expect(content).toContainText('4');
  });

  test('renders cloze card with hidden text', async ({ page }) => {
    const card = page.locator('#cloze-card');
    const content = card.locator('div.content');

    // On question side, c1 should be hidden
    await expect(content).toContainText('[...]');
    await expect(content).toContainText('France'); // c2 is visible
    await expect(content).not.toContainText('Paris'); // c1 is hidden
  });

  test('toggles cloze card to answer side', async ({ page }) => {
    const card = page.locator('#cloze-card');
    const content = card.locator('div.content');

    // Toggle to answer
    await page.click('button:text("Toggle Side"):near(#cloze-card)');

    // On answer side, c1 should be revealed
    await expect(content).toContainText('Paris');
    await expect(content).toContainText('France');
  });

  test('switches between cloze cards', async ({ page }) => {
    const card = page.locator('#cloze-card');
    const content = card.locator('div.content');

    // Initially card 1 - Paris hidden
    await expect(content).not.toContainText('Paris');
    await expect(content).toContainText('France');

    // Switch to card 2
    await page.click('button:text("Switch Cloze Card")');

    // Now France hidden, Paris visible
    await expect(content).toContainText('Paris');
    await expect(content).not.toContainText('France');
  });

  test('renders furigana as ruby elements', async ({ page }) => {
    const card = page.locator('#japanese-card');
    const content = card.locator('div.content');

    // Should have ruby elements
    const ruby = content.locator('ruby');
    await expect(ruby.first()).toBeVisible();

    // Check for the reading in rt elements
    const rt = content.locator('rt');
    await expect(rt.first()).toContainText('にほんご');
  });

  test('emits render-complete event', async ({ page }) => {
    const eventLog = page.locator('#event-log');

    // Initial render events should be logged
    await expect(eventLog).toContainText('render-complete');
  });

  test('styles are encapsulated via Shadow DOM', async ({ page }) => {
    // Add a global style that would conflict
    await page.addStyleTag({
      content: '.content { background: red !important; }'
    });

    const card = page.locator('#basic-card');
    const content = card.locator('div.content');

    // The shadow DOM content should not be affected by global styles
    const bgColor = await content.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should not be red (rgb(255, 0, 0))
    expect(bgColor).not.toBe('rgb(255, 0, 0)');
  });

  test('programmatic property updates trigger re-render', async ({ page }) => {
    const card = page.locator('#basic-card');
    const content = card.locator('div.content');

    // Update fields programmatically
    await page.evaluate(() => {
      const card = document.getElementById('basic-card') as any;
      card.fields = { Front: 'New Question', Back: 'New Answer' };
    });

    // Content should update
    await expect(content).toContainText('New Question');
  });
});
