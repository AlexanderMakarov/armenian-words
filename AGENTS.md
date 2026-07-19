# [AGENTS.md](http://AGENTS.md)

## Project Overview

This is a static web application for learning Armenian vocabulary. It features:

- **Learning Mode**: Study Armenian words with English/Russian translations
- **Quiz Mode**: Test knowledge with multiple-choice questions
- **Progress Tracking**: Browser localStorage stores user progress and statistics
- **CEFR Levels**: A1, A2, B1, B2 difficulty levels
- **Multi-language Support**: English and Russian quiz languages

## Architecture

### Technology Stack

- **Frontend**: HTML, CSS (Sass), TypeScript (compiled to JavaScript)
- **Build Process**: TypeScript compilation, Sass compilation
- **Runtime**: Bun (for development and build)
- **Linting**: Biome (TypeScript, HTML, CSS)
- **Backend**: None (static files only)
- **Data Storage**: 
  - `vocabulary.json` - Vocabulary database (loaded via fetch)
  - `localStorage` - User progress and settings
- **Analytics**: PostHog (embedded in HTML)
- **Deployment**: GitHub Pages (automatic via GitHub Actions)

### File Structure

```
armenian-words/
├── src/                    # Source files
│   ├── index.html          # Main HTML structure
│   ├── main.ts             # Application logic (TypeScript source)
│   └── styles.scss         # Styling (Sass source)
├── static/                 # Development build output (gitignored, generated)
│   ├── styles.css          # Compiled from src/styles.scss
│   ├── main.js             # Compiled from src/main.ts
│   └── vocabulary.json     # Static data file
├── dist/                   # Production build output (generated, not in git)
│   ├── index.html          # Compiled HTML
│   └── static/             # Compiled assets
│       ├── styles.css      # Compiled CSS
│       ├── main.js         # Compiled JavaScript
│       └── vocabulary.json # Static data file
├── package.json            # Build scripts and dependencies
├── tsconfig.json           # TypeScript configuration
├── biome.json              # Biome linter configuration
├── dev.ts                  # Development server script
├── build.ts                 # Production build script
├── README.md               # User-facing documentation
├── AGENTS.md               # This file
└── scripts/
    ├── build_vocabulary.py  # Python script to generate vocabulary.json
    ├── requirements.txt     # Python dependencies
    └── README.md            # Vocabulary builder documentation
```

## Coding Conventions

### TypeScript

- **ES6+ features**: Classes, arrow functions, async/await
- **Type safety**: Full type annotations, interfaces for data structures
- **No frameworks**: Pure vanilla TypeScript
- **Class-based architecture**: Main app logic in `ArmenianLearningApp` class
- **Error handling**: Try-catch blocks for async operations
- **DOM manipulation**: Direct DOM API with proper type assertions
- **Event handling**: `addEventListener` (no inline handlers)
- **Type definitions**: Interfaces for Word, Vocabulary, UserStats, LevelStats, QuizWord

### CSS/Sass

- **Sass/SCSS**: Source files use Sass format
- **Modern CSS**: Grid, Flexbox, CSS variables (if needed)
- **Mobile-first**: Responsive design
- **BEM-like naming**: `.word-card`, `.option-btn`, etc.
- **No CSS frameworks**: Pure Sass/CSS only

### HTML

- **Semantic HTML**: Use appropriate tags (`<header>`, `<footer>`, etc.)
- **Accessibility**: Proper ARIA labels if needed
- **No inline styles**: All styles in `styles.scss`
- **No inline scripts**: All JavaScript in `main.ts`

## Important Constraints

### Package Manager

- **ALWAYS use `bun` instead of `npm`**: This project uses Bun as the package manager and runtime
- **NEVER use `npm` commands**: Use `bun install`, `bun run`, `bun add`, `bunx` instead of `npm install`, `npm run`, `npm install --save`, `npx`

### Code Quality

- **No console.log in production**: Remove or comment out debug statements
- **Error handling**: Fail fast with details in console
- **Performance**: Vocabulary loading is async - handle loading states
- **Browser compatibility**: Support modern browsers (ES6+)
- **Type safety**: All TypeScript code must compile without errors
- **Linting**: Biome linter must pass before committing

### Data Format

- **vocabulary.json structure**: Must match existing format exactly
- **localStorage keys**: Use consistent prefixes (`armenianApp_*`, `armenianLearningStats`)

## Development Workflow

### Making Changes

1. **Frontend changes** (HTML/CSS/TS):
- Edit source files in `src/` folder
- Run `bun run build` to compile TypeScript and Sass
- Test locally: `bun run serve` (builds and serves on [http://localhost:8000](http://localhost:8000))

### Completion Checklist

**Before declaring any task complete, you MUST:**

1. **Run `bun run lint`** and fix all errors and warnings
2. **Run `bun run build`** and verify it succeeds without errors
3. **If functionality was changed or broken**, start dev server (`bun run dev`) and test the specific feature that was modified
4. **Stop dev server** after testing (use `pkill -f 'vite dev'` or similar)
5. **Verify cleanup**: Ensure no background processes or temporary resources remain

### Build Commands

- `bun run build` - Production build: Compile TypeScript, compile Sass, copy assets, copy files to `dist/`, run linter
- `bun run dev` - Development server: Watches `src/`, compiles to `static/`, serves on port 8000
- `bun run lint` - Run Biome linter on source files
- `bun run lint:fix` - Run Biome linter with auto-fix
- `bun run vocabulary-build` - Build vocabulary.json using Python
- `bun run vocabulary-build-no-cache` - Build vocabulary.json without cache

## Key Implementation Details

### Vocabulary Loading

- `vocabulary.json` is loaded via `fetch(\`${base}/vocabulary.json\`)` on app initialization
- If loading fails, shows error message to user
- Vocabulary is stored in global `vocabulary` variable (typed as `Vocabulary | null`)
- Access via `getWordsByLevel(level)` helper function
- File location: `static/vocabulary.json` (served from `/vocabulary.json` in dev, `/armenian-words/vocabulary.json` in production)
- Note: In SvelteKit, files in `static/` folder are served from root, not from `/static/` path

### Screen Management

- Three screens: `level-selection`, `learning-mode`, `quiz-mode`
- Only one screen active at a time (`.active` class)
- Use `showScreen(screenId)` method to switch screens
- Reset screen visibility when returning to level selection

### Progress Tracking

- **User stats**: Stored in `localStorage` key `armenianLearningStats`
- **Learnt words**: Stored in `localStorage` key `armenianApp_learntWords` (comma-separated)
- **Settings**: `armenianApp_quizLanguage`, `armenianApp_cardsCount`
- Stats format: `{ "A1": { totalQuizzes: 5, totalCorrect: 40, totalQuestions: 50 }, ... }`

### Quiz Logic

- Quiz questions are created from words shown in learning mode
- Options include correct answer + random incorrect answers (up to 10 total)
- Options shuffled randomly
- Auto-advance after 1 second when answer selected
- Score tracked and saved to stats on completion

### Learning Mode Logic

- Shows unlearnt words first, then learnt words
- Removes duplicates by Armenian word
- Shuffles words randomly
- User can navigate forward/backward
- Progress bar shows current position

### Analytics

- PostHog initialized in HTML `<head>`
- Tracks: `app_opened` (first visit), `quiz_completed` (with metadata)
- User ID stored in localStorage (`armenianApp_userID`)
- Events include: level, score, progress by level, learnt words count

## Testing Checklist

Before submitting changes, verify:

- TypeScript compiles without errors (`bun run build`)
- Sass compiles to CSS without errors
- Biome linter passes without errors (`bun run lint`)
- App loads vocabulary.json successfully
- Level selection works (A1, A2, B1, B2)
- Could start learning mode with 2 words
- Learning mode displays words correctly
- Quiz mode works with both English and Russian
- Progress is saved to localStorage
- Stats display correctly
- Reset progress button works
- Responsive design works on mobile
- No console errors

## Deployment

- **Automatic**: GitHub Actions deploys to GitHub Pages on push to `main` branch (`deploy.yml`)
- **Manual deploy**: `gh workflow run deploy.yml --ref main` (or Actions → Deploy → Run workflow)
- **Build step required**: TypeScript and Sass compilation
- **Build process**: GitHub Actions installs Bun, runs `bun install`, runs `bun run build`
- **Deployment source**: Files from `dist/` folder are deployed
- **Caching**: Browsers cache `vocabulary.json` automatically (HTML/JS assets are hashed)
- **Idle-repo gotcha**: If `main` has no commits for ~60+ days, GitHub can suspend Actions event triggers. A merge to `main` may then **not** start `deploy.yml` (or only start it much later). `keepalive.yml` re-enables workflows twice a month via API to prevent this. If deploy still did not run after a merge, run the manual deploy command above.

## Best Practices

1. **Keep it simple**: No unnecessary abstractions or frameworks
2. **User experience**: Always show loading/error states
3. **Performance**: Vocabulary is small (~1000 words), no optimization needed
4. **Accessibility**: Use semantic HTML, proper labels
5. **Maintainability**: Code is straightforward, easy to understand
6. **Testing**: Always test in real browser, not just in head
7. **Type safety**: Use TypeScript types and interfaces consistently
8. **Build process**: Always build before testing (`bun run build`)

## Cursor Cloud specific instructions

### Runtime

- **Bun** is pre-installed at `~/.bun/bin/bun`. Ensure `PATH` includes `~/.bun/bin` (the update script handles this).
- The project is a **SvelteKit** app (Svelte 5 + Vite 7), not vanilla HTML/TS as some AGENTS.md sections suggest. The actual dev server runs on **port 5173** (Vite default), not 8000.

### Key commands

All commands use `bun` (never `npm`). See `package.json` `scripts` for the full list.

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server at `http://localhost:5173` |
| `bun run build` | Production build to `dist/` |
| `bun run lint` | Biome linter (`biome check --write src/`) |
| `bun run check` | Svelte/TS type check (has pre-existing errors in test files and some Svelte 5 type issues) |
| `bun run test:unit` | Bun unit tests (`bun test src/`) |
| `bun run test` | Playwright e2e tests (auto-starts dev server) |

### Gotchas

- `bun run check` (svelte-check) reports pre-existing type errors in `*.test.ts` files (due to `bun:test` module) and some Svelte 5 `$derived` type issues. These do not affect build or runtime.
- Playwright e2e tests require Chromium installed: `bunx playwright install --with-deps chromium`. The update script handles this.
- The Playwright config (`playwright.config.ts`) auto-starts the dev server on port 5173, so `bun run test` works standalone.
- No backend, database, or Docker required. The app is fully static (SvelteKit adapter-static).
