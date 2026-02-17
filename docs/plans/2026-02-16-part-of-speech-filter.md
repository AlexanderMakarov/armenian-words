# Part of Speech Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dropdown setting on the main screen to filter learning and quiz sessions by part of speech (nouns, verbs, adjectives, adverbs, other, or all).

**Architecture:** Add a persistent `partOfSpeech` store with dropdown UI on the main screen. Filter vocabulary words in the learn page's `onMount` before the shuffle/slice logic. The quiz inherits the filtered set automatically via the existing `learningWords` store.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Svelte stores with localStorage persistence

---

### Task 1: Add PartOfSpeech type and MAJOR_POS constant

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

**Step 1: Add the type to types.ts**

Add after the `UILanguage` type at the bottom of `src/lib/types.ts`:

```typescript
/** Part of speech filter options for learning/quiz sessions */
export type PartOfSpeech = 'all' | 'noun' | 'verb' | 'adj' | 'adv' | 'other';
```

**Step 2: Add the constant to constants.ts**

Add at the bottom of `src/lib/constants.ts`:

```typescript
/**
 * Major parts of speech shown as individual filter options.
 * Everything else falls under "other".
 */
export const MAJOR_POS = ['noun', 'verb', 'adj', 'adv'] as const;
```

**Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add PartOfSpeech type and MAJOR_POS constant"
```

---

### Task 2: Add partOfSpeech persistent store

**Files:**
- Modify: `src/lib/stores/settings.ts`
- Modify: `src/lib/stores/index.ts`

**Step 1: Add the store to settings.ts**

Add this import at the top of `src/lib/stores/settings.ts`:

```typescript
import type { QuizLanguage, UILanguage, PartOfSpeech } from '$lib/types.js';
```

Add this line after the `autoPlaySound` store:

```typescript
export const partOfSpeech = createPersistentStore<PartOfSpeech>('partOfSpeech', 'all');
```

**Step 2: Re-export from index.ts**

In `src/lib/stores/index.ts`, change the settings export line to:

```typescript
export { autoPlaySound, cardsCount, partOfSpeech, quizLanguage } from './settings.js';
```

**Step 3: Commit**

```bash
git add src/lib/stores/settings.ts src/lib/stores/index.ts
git commit -m "feat: add partOfSpeech persistent store"
```

---

### Task 3: Add i18n translations

**Files:**
- Modify: `src/lib/i18n/translations/en.ts`
- Modify: `src/lib/i18n/translations/ru.ts`

**Step 1: Add English translations**

Add these entries to the main page section of `src/lib/i18n/translations/en.ts`:

```typescript
'Part of speech:': 'Part of speech:',
'All': 'All',
'Nouns': 'Nouns',
'Verbs': 'Verbs',
'Adjectives': 'Adjectives',
'Adverbs': 'Adverbs',
'Other': 'Other',
```

**Step 2: Add Russian translations**

Add these entries to the main page section of `src/lib/i18n/translations/ru.ts`:

```typescript
'Part of speech:': 'Часть речи:',
'All': 'Все',
'Nouns': 'Существительные',
'Verbs': 'Глаголы',
'Adjectives': 'Прилагательные',
'Adverbs': 'Наречия',
'Other': 'Другое',
```

**Step 3: Commit**

```bash
git add src/lib/i18n/translations/en.ts src/lib/i18n/translations/ru.ts
git commit -m "feat: add i18n translations for part of speech filter"
```

---

### Task 4: Add dropdown UI to main screen

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add imports and state**

In the `<script>` tag of `src/routes/+page.svelte`:

1. Add `partOfSpeech` to the stores import:

```typescript
import {
    autoPlaySound,
    cardsCount,
    getAvailableLevels,
    learntTranslations,
    partOfSpeech,
    quizLanguage,
    userStats,
    vocabulary,
} from '$lib/stores/index.js';
```

2. Add `PartOfSpeech` to the types import:

```typescript
import type { PartOfSpeech, QuizLanguage, Vocabulary } from '$lib/types.js';
```

3. Add state variable:

```typescript
let currentPartOfSpeech = $state<PartOfSpeech>('all');
```

4. Add subscription inside the existing `$effect`:

```typescript
const unsubPos = partOfSpeech.subscribe((v) => (currentPartOfSpeech = v));
```

And add `unsubPos()` to the cleanup return.

5. Add handler function after `handleCardsCountChange`:

```typescript
function handlePartOfSpeechChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    partOfSpeech.set(target.value as PartOfSpeech);
}
```

**Step 2: Add the dropdown HTML**

Insert this block in the template, **after** the `<label class="setting-item horizontal">` block (the cards count input) and **before** the `<div class="setting-item">` block that contains the Language buttons:

```svelte
<div class="setting-item">
    <label for="part-of-speech">{t('Part of speech:')}</label>
    <select
        id="part-of-speech"
        class="pos-select"
        value={currentPartOfSpeech}
        onchange={handlePartOfSpeechChange}
    >
        <option value="all">{t('All')}</option>
        <option value="noun">{t('Nouns')}</option>
        <option value="verb">{t('Verbs')}</option>
        <option value="adj">{t('Adjectives')}</option>
        <option value="adv">{t('Adverbs')}</option>
        <option value="other">{t('Other')}</option>
    </select>
</div>
```

**Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add part of speech dropdown to main screen settings"
```

---

### Task 5: Add filtering logic to learn page

**Files:**
- Modify: `src/routes/learn/[level]/+page.svelte`

**Step 1: Add imports**

1. Add `partOfSpeech` to the stores import:

```typescript
import {
    autoPlaySound,
    cardsCount,
    currentLevel,
    currentWordIndex,
    getWordsByLevel,
    learningWords,
    learntTranslations,
    partOfSpeech,
    quizLanguage,
    resetLearningSession,
    vocabulary,
} from '$lib/stores/index.js';
```

2. Add `MAJOR_POS` to the imports:

```typescript
import { MAJOR_POS } from '$lib/constants.js';
```

3. Add `PartOfSpeech` to the types import:

```typescript
import type { PartOfSpeech, QuizLanguage, Word } from '$lib/types.js';
```

**Step 2: Add filtering logic inside onMount's vocabulary subscription**

Inside the `vocabulary.subscribe` callback, after the line:

```typescript
const levelWords = getWordsByLevel(vocab, level);
```

Add the POS filter:

```typescript
// Filter by part of speech
const currentPos = get(partOfSpeech);
const filteredByPos = filterByPartOfSpeech(levelWords, currentPos);
if (filteredByPos.length === 0) {
    goto(base || '/');
    return;
}
```

Then replace all subsequent references to `levelWords` with `filteredByPos` in the unlearnt/combined/unique/shuffle logic.

**Step 3: Add the filter function**

Add this function in the `<script>` tag (outside `onMount`):

```typescript
function filterByPartOfSpeech(words: Word[], pos: PartOfSpeech): Word[] {
    if (pos === 'all') return words;
    if (pos === 'other') {
        return words.filter((w) => w.pos && !MAJOR_POS.includes(w.pos as (typeof MAJOR_POS)[number]));
    }
    return words.filter((w) => w.pos === pos);
}
```

**Step 4: Commit**

```bash
git add src/routes/learn/[level]/+page.svelte
git commit -m "feat: filter learning words by selected part of speech"
```

---

### Task 6: Add E2E test for POS filter

**Files:**
- Modify: `tests/app-flow.spec.ts`

**Step 1: Add a test for the POS filter dropdown**

Add this test at the end of `tests/app-flow.spec.ts`:

```typescript
test('part of speech filter is visible and defaults to all', async ({ page }: { page: Page }) => {
    await page.goto('/');
    await page.waitForSelector('button.level-btn', { state: 'visible', timeout: 5000 });

    // Verify the POS dropdown exists and defaults to "all"
    const posSelect = page.locator('#part-of-speech');
    await expect(posSelect).toBeVisible();
    await expect(posSelect).toHaveValue('all');

    // Change to "noun" and verify it persists
    await posSelect.selectOption('noun');
    await expect(posSelect).toHaveValue('noun');
});
```

**Step 2: Run E2E tests**

```bash
bunx playwright test
```

Expected: All tests pass, including the new one.

**Step 3: Commit**

```bash
git add tests/app-flow.spec.ts
git commit -m "test: add E2E test for part of speech filter dropdown"
```

---

### Task 7: Build and verify

**Step 1: Run type checking**

```bash
bun run check
```

Expected: No type errors.

**Step 2: Run linter**

```bash
bun run lint
```

Expected: No lint errors.

**Step 3: Run full build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 4: Run E2E tests**

```bash
bunx playwright test
```

Expected: All tests pass.
