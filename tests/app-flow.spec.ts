import { test, expect } from '@playwright/test';

test('loads the app and shows level selection', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
    console.error('Page error:', error);
  });
  
  page.on('requestfailed', request => {
    errors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 1000 });
  
  console.log('=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));
  
  if (errors.length > 0) {
    console.log('=== Errors ===');
    errors.forEach(err => console.error(err));
  }
  
  await expect(page.locator('h1')).toBeVisible({ timeout: 1000 });
});

test('can select a level and start learning', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];
  const networkRequests: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}\nStack: ${error.stack}`);
    console.error('Page error:', error);
  });
  
  page.on('requestfailed', request => {
    const failure = request.failure();
    errors.push(`Request failed: ${request.url()} - ${failure?.errorText || 'Unknown error'}`);
  });
  
  const vocabularyResponsePromise = page.waitForResponse(
    response => response.url().includes('/static/vocabulary.json') && response.status() === 200,
    { timeout: 1000 }
  );
  
  page.on('response', response => {
    if (response.url().includes('vocabulary') || response.url().includes('main') || response.url().includes('styles')) {
      networkRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 1000 });
  
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
      const response = await fetch('/static/vocabulary.json');
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
      a1ButtonExists: document.querySelector('button[data-level="A1"]') !== null,
      a1ButtonText: document.querySelector('button[data-level="A1"]')?.textContent,
    };
  });
  console.log('=== App Status ===');
  console.log(JSON.stringify(appStatus, null, 2));
  
  // Wait for the app to be ready (vocabulary loads and app initializes)
  await page.waitForSelector('button:has-text("A1")', { state: 'visible', timeout: 1000 });
  
  // Wait a moment for the app to process the vocabulary and initialize
  // The app calls initializeApp() after vocabulary loads, which sets up event handlers
  await page.waitForTimeout(300);
  
  console.log('=== Clicking A1 button ===');
  await page.click('button:has-text("A1")');
  
  // Check what happened after click
  const afterClick = await page.evaluate(() => {
    return {
      learningModeVisible: document.querySelector('.learning-mode')?.classList.contains('active'),
      levelSelectionVisible: document.querySelector('#level-selection')?.classList.contains('active'),
      currentScreen: Array.from(document.querySelectorAll('.screen')).find(s => s.classList.contains('active'))?.id,
    };
  });
  console.log('=== After Click Status ===');
  console.log(JSON.stringify(afterClick, null, 2));
  
  await expect(page.locator('#learning-mode.active')).toBeVisible({ timeout: 1000 });
});
