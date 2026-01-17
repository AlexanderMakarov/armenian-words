import { test, expect, type Page, type ConsoleMessage, type Request, type Response } from '@playwright/test';

test('loads the app and shows level selection', async ({ page }: { page: Page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', (error: Error) => {
    errors.push(`Page error: ${error.message}`);
    console.error('Page error:', error);
  });

  page.on('requestfailed', (request: Request) => {
    errors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 5000 });

  console.log('=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));

  if (errors.length > 0) {
    console.log('=== Errors ===');
    errors.forEach(err => console.error(err));
  }

  await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
});

test('can select a level and start learning', async ({ page }: { page: Page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];
  const networkRequests: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', (error: Error) => {
    errors.push(`Page error: ${error.message}\nStack: ${error.stack}`);
    console.error('Page error:', error);
  });

  page.on('requestfailed', (request: Request) => {
    const failure = request.failure();
    errors.push(`Request failed: ${request.url()} - ${failure?.errorText || 'Unknown error'}`);
  });

  const vocabularyResponsePromise = page.waitForResponse(
    (response: Response) => response.url().includes('/vocabulary.json') && response.status() === 200,
    { timeout: 5000 }
  );

  page.on('response', (response: Response) => {
    if (response.url().includes('vocabulary') || response.url().includes('main') || response.url().includes('styles')) {
      networkRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 5000 });

  // Wait for vocabulary to load
  await vocabularyResponsePromise;

  console.log('=== Network Requests ===');
  networkRequests.forEach(req => console.log(req));

  console.log('=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));

  if (errors.length > 0) {
    console.log('=== Errors ===');
    errors.forEach(err => console.error(err));
  }

  // Check if vocabulary.json file exists and is accessible
  const vocabFileCheck = await page.evaluate(async () => {
    try {
      const response = await fetch('/vocabulary.json');
      return {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        canRead: response.ok,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
  console.log('=== Vocabulary.json File Check ===');
  console.log(JSON.stringify(vocabFileCheck, null, 2));

  // Check if app initialized
  const appStatus = await page.evaluate(() => {
    const buttons = document.querySelectorAll('.level-btn');
    return {
      levelButtonsCount: buttons.length,
      a1ButtonExists: !!document.querySelector('button.level-btn'),
    };
  });
  console.log('=== App Status ===');
  console.log(JSON.stringify(appStatus, null, 2));

  // Wait for the app to be ready (vocabulary loads and app initializes)
  await page.waitForSelector('button.level-btn', { state: 'visible', timeout: 5000 });

  // Wait a moment for the app to process the vocabulary and initialize
  await page.waitForTimeout(300);

  console.log('=== Clicking A1 button ===');
  await page.click('button.level-btn:first-child');

  // Wait for navigation to learning mode
  await page.waitForURL(/\/learn\//, { timeout: 5000 });

  // Check what happened after navigation
  const afterClick = await page.evaluate(() => {
    return {
      url: window.location.pathname,
      learningModeVisible: !!document.querySelector('#learning-mode'),
      wordCardVisible: !!document.querySelector('.word-card'),
    };
  });
  console.log('=== After Click Status ===');
  console.log(JSON.stringify(afterClick, null, 2));

  await expect(page.locator('#learning-mode')).toBeVisible({ timeout: 5000 });
});

test('respects custom cards count setting', async ({ page }: { page: Page }) => {
  await page.goto('/');
  await page.waitForSelector('button.level-btn', { state: 'visible', timeout: 5000 });

  // Set cards count to 3
  const cardsInput = page.locator('#cards-count');
  await cardsInput.fill('3');

  // Click on A1 level
  await page.click('button.level-btn:first-child');
  await page.waitForURL(/\/learn\//, { timeout: 5000 });

  // Check that learning count shows 3 words
  const learningCount = await page.locator('.learning-count').textContent();
  expect(learningCount).toContain('/ 3');
});
