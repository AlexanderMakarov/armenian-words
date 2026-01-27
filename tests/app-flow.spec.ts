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

test('migrates old learntWords localStorage to learntTranslations', async ({ page }: { page: Page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error: Error) => {
    errors.push(`Page error: ${error.message}`);
  });

  // Set up old localStorage format BEFORE navigating
  await page.addInitScript(() => {
    // Simulate old learntWords format (comma-separated Armenian words)
    localStorage.setItem('armenianApp_learntWords', 'է,և');
  });

  await page.goto('/');
  await page.waitForSelector('button.level-btn', { state: 'visible', timeout: 5000 });

  // Check migration happened
  const migrationResult = await page.evaluate(() => {
    const oldKey = localStorage.getItem('armenianApp_learntWords');
    const newKey = localStorage.getItem('armenianApp_learntTranslations');
    return {
      oldKeyExists: oldKey !== null,
      oldKeyValue: oldKey,
      newKeyExists: newKey !== null,
      newKeyValue: newKey,
      newKeyContainsTranslations: newKey ? newKey.includes('|') : false,
    };
  });

  console.log('=== Migration Result ===');
  console.log(JSON.stringify(migrationResult, null, 2));

  // Old key should be removed after migration
  expect(migrationResult.oldKeyExists).toBe(false);

  // New key should exist and contain pipe-separated format
  expect(migrationResult.newKeyExists).toBe(true);
  expect(migrationResult.newKeyContainsTranslations).toBe(true);

  // Should not have any page errors
  if (errors.length > 0) {
    console.log('=== Errors ===');
    errors.forEach(err => console.error(err));
  }
  expect(errors).toHaveLength(0);
});

test('complete learning flow: configure -> learn -> quiz -> finish', async ({ page }: { page: Page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error: Error) => {
    errors.push(`Page error: ${error.message}`);
    console.error('Page error:', error.message);
  });

  // Step 1: Go to main screen and configure
  await page.goto('/');
  await page.waitForSelector('button.level-btn', { state: 'visible', timeout: 5000 });

  // Configure to learn only 1 word for quick test
  const cardsInput = page.locator('#cards-count');
  await cardsInput.fill('1');

  // Verify configuration was applied
  await expect(cardsInput).toHaveValue('1');

  // Step 2: Click A1 level to start learning
  await page.click('button.level-btn:first-child');
  await page.waitForURL(/\/learn\/A1/, { timeout: 5000 });

  // Step 3: Verify learning mode is displayed
  await expect(page.locator('#learning-mode')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.word-card')).toBeVisible({ timeout: 5000 });

  // Verify we have 1 word to learn (as configured)
  const learningCount = await page.locator('.learning-count').textContent();
  expect(learningCount).toContain('1 / 1');

  // Get the Armenian word being learned for later verification
  const armenianWord = await page.locator('.armenian-word').textContent();
  expect(armenianWord).toBeTruthy();

  // Step 4: Click "Next Word" to complete learning
  await page.click('#next-word');

  // Wait for learning complete message
  await expect(page.locator('#learning-complete')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#learning-complete-text')).toContainText("You've studied 1 words");

  // Step 5: Start the quiz
  await page.click('#start-quiz');
  await page.waitForURL(/\/quiz/, { timeout: 5000 });

  // Step 6: Verify quiz mode is displayed
  await expect(page.locator('#quiz-mode')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#quiz-options')).toBeVisible({ timeout: 5000 });

  // Get total number of questions (each word translation creates a question)
  const quizCountText = await page.locator('#quiz-correct-count').textContent();
  const totalQuestions = parseInt(quizCountText?.split('/')[1]?.trim() || '1', 10);
  expect(totalQuestions).toBeGreaterThan(0);

  // Step 7: Answer all quiz questions (click first option each time)
  for (let i = 0; i < totalQuestions; i++) {
    // Wait for quiz options to be visible
    await expect(page.locator('#quiz-options')).toBeVisible({ timeout: 5000 });

    // Verify quiz shows a translation question
    const translationQuestion = await page.locator('#translation-question').textContent();
    expect(translationQuestion).toBeTruthy();

    // Answer the quiz question (click first option)
    await page.click('#quiz-options button:first-child');

    // Wait for auto-advance (1 second delay + buffer)
    await page.waitForTimeout(1200);
  }

  // Step 8: Verify quiz complete screen appears
  await expect(page.locator('#quiz-complete')).toBeVisible({ timeout: 5000 });

  // Verify final score is displayed
  const finalScore = await page.locator('#final-score').textContent();
  expect(finalScore).toMatch(/Score: \d+\/\d+/); // Score: X/Y format

  // Step 9: Click "Change Settings" to go back to main screen
  await page.click('#change-level');
  await page.waitForURL(/\/$/, { timeout: 5000 });

  // Verify we're back on the main screen
  await expect(page.locator('button.level-btn').first()).toBeVisible({ timeout: 5000 });

  // Verify no page errors occurred during the entire flow
  expect(errors).toHaveLength(0);
});

test('handles app load with corrupted localStorage gracefully', async ({ page }: { page: Page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error: Error) => {
    errors.push(`Page error: ${error.message}`);
  });

  // Set up potentially problematic localStorage data
  await page.addInitScript(() => {
    // Old format with words that might not exist in vocabulary
    localStorage.setItem('armenianApp_learntWords', 'nonexistent,words,here');
  });

  await page.goto('/');

  // App should still load without errors
  await page.waitForSelector('button.level-btn', { state: 'visible', timeout: 5000 });

  // Verify app is functional
  const appLoaded = await page.evaluate(() => {
    return document.querySelectorAll('.level-btn').length > 0;
  });

  expect(appLoaded).toBe(true);

  // Should not have JSON parse errors or other page errors
  const jsonParseErrors = errors.filter(e => e.includes('JSON') || e.includes('parse'));
  expect(jsonParseErrors).toHaveLength(0);
});
