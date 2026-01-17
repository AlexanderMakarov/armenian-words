# SvelteKit Migration Design

## Overview

Migrate the Armenian Learning App from vanilla TypeScript to SvelteKit with:
- File-based routing (`/`, `/learn/[level]`, `/quiz`)
- Svelte stores for state management
- Component architecture
- Maintained localStorage persistence and analytics

## Architecture

### Route Structure

```
src/
├── lib/
│   ├── stores/
│   │   ├── vocabulary.ts      # Vocabulary data store
│   │   ├── progress.ts        # Learnt words + user stats
│   │   ├── settings.ts        # Language preference, cards count
│   │   └── quiz.ts            # Quiz session state
│   ├── components/
│   │   ├── ProgressBar.svelte
│   │   ├── WordCard.svelte
│   │   ├── QuizOption.svelte
│   │   └── StatsDisplay.svelte
│   ├── types.ts               # TypeScript interfaces
│   └── analytics.ts           # PostHog NPM package wrapper
├── routes/
│   ├── +layout.svelte         # Shared header/footer
│   ├── +page.svelte           # Level selection (/)
│   ├── learn/
│   │   └── [level]/
│   │       └── +page.svelte   # Learning mode (/learn/A1)
│   └── quiz/
│       └── +page.svelte       # Quiz mode (/quiz)
└── app.html                   # HTML template
```

### State Management

**Stores with localStorage sync:**

```typescript
// settings.ts - User preferences
export const quizLanguage = writable<'english' | 'russian'>('english');
export const cardsCount = writable<number>(10);

// progress.ts - Learning progress
export const learntWords = writable<string[]>([]);
export const userStats = writable<UserStats>({});

// quiz.ts - Session state (not persisted)
export const learningWords = writable<Word[]>([]);
export const quizWords = writable<QuizWord[]>([]);
export const currentLevel = writable<string | null>(null);
```

### Data Flow

1. **App Load**: `+layout.svelte` loads vocabulary, initializes stores from localStorage
2. **Level Selection** (`/`): User picks level, navigates to `/learn/[level]`
3. **Learning Mode** (`/learn/[level]`): Loads words into `learningWords` store, user navigates cards
4. **Quiz Mode** (`/quiz`): Uses `learningWords` to generate quiz, tracks score
5. **Completion**: Updates `learntWords` and `userStats`, persists to localStorage

### Component Breakdown

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `ProgressBar` | `current`, `total` | Visual progress indicator |
| `WordCard` | `word`, `language` | Display Armenian word + translation |
| `QuizOption` | `word`, `isCorrect`, `isSelected`, `disabled` | Quiz answer button |
| `StatsDisplay` | `stats` | Show user learning history |

### Migration Mapping

| Current (vanilla) | SvelteKit |
|-------------------|-----------|
| `ArmenianLearningApp` class | Distributed across stores + pages |
| `showScreen()` | SvelteKit routing (`goto()`) |
| DOM queries (`getElementById`) | Svelte bindings + reactivity |
| Event listeners | Svelte `on:click`, `on:keydown` |
| Class properties | Svelte stores |

## Implementation Steps

### Phase 1: Project Setup
1. Initialize SvelteKit project in place
2. Configure TypeScript, SCSS, Biome
3. Install `posthog-js` NPM package
4. Create `app.html` template
5. Set up static asset copying for `vocabulary.json`

### Phase 2: Core Infrastructure
1. Create TypeScript types (`$lib/types.ts`)
2. Implement stores with localStorage sync
3. Create analytics wrapper
4. Build `+layout.svelte` with header/footer

### Phase 3: Pages
1. Build level selection page (`/+page.svelte`)
2. Build learning mode (`/learn/[level]/+page.svelte`)
3. Build quiz mode (`/quiz/+page.svelte`)

### Phase 4: Components
1. Extract `ProgressBar.svelte`
2. Extract `WordCard.svelte`
3. Extract `QuizOption.svelte`
4. Extract `StatsDisplay.svelte`

### Phase 5: Polish
1. Port all SCSS styles
2. Add keyboard navigation
3. Update Playwright tests
4. Update build/deploy scripts

## Key Decisions

### Client-Side Only
- App is purely client-side (localStorage, no server data)
- Use `ssr: false` in SvelteKit config
- All data fetching happens in `onMount`

### Store Persistence Pattern
```typescript
// Keep armenianApp_ prefix for backwards compatibility
const STORAGE_PREFIX = 'armenianApp_';

// Auto-sync store to localStorage
function persistentStore<T>(key: string, initial: T) {
  const fullKey = `${STORAGE_PREFIX}${key}`;
  const stored = browser ? localStorage.getItem(fullKey) : null;
  const data = stored ? JSON.parse(stored) : initial;
  const store = writable<T>(data);

  if (browser) {
    store.subscribe(value => localStorage.setItem(fullKey, JSON.stringify(value)));
  }
  return store;
}
```

### Navigation Guards
- `/learn/[level]` validates level param exists in vocabulary
- `/quiz` redirects to `/` if no `learningWords` in store

## Files to Delete After Migration

- `src/main.ts` (replaced by SvelteKit pages)
- `src/index.html` (replaced by `app.html` + layout)
- `build.ts` (replaced by `vite build`)
- `dev.ts` (replaced by `vite dev`)

## Testing Strategy

- Maintain existing Playwright tests
- Update selectors if needed (should mostly work as-is)
- Add route-based test organization
