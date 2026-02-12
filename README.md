# 🇦🇲 Armenian Language Learning App

A modern web application for learning Armenian vocabulary with interactive learning, quizzes, and a searchable vocabulary browser. Built with SvelteKit and deployed as a static site on GitHub Pages.

**https://alexandermakarov.github.io/armenian-words/**

## Features

- **CEFR Language Levels** — A1, A2, B1, B2 difficulty levels
- **Learning Mode** — Study Armenian words with English and Russian translations, pronunciation audio, etymology, and part of speech
- **Quiz Mode** — Multiple-choice quizzes generated from your learned words
- **Vocabulary Browser** — Search and browse the full word database by Armenian, English, Russian, or romanized text
- **Bilingual Quiz Language** — Choose English or Russian for quiz translations
- **Bilingual UI** — Interface available in English and Russian (🇺🇸/🇷🇺 switcher)
- **Configurable Sessions** — Choose 1–100 words per learning session
- **Audio Pronunciation** — Optional auto-play for word audio
- **Progress Tracking** — Per-level quiz statistics stored in browser localStorage
- **Responsive Design** — Works on desktop and mobile

## How to Use

1. Select your language level (A1–B2)
2. Optionally adjust session size and quiz language in settings
3. Study vocabulary words in learning mode
4. Take the quiz to test your knowledge
5. Browse the full vocabulary using the search feature

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 2 / Svelte 5 |
| Language | TypeScript 5 |
| Styling | Sass |
| Build | Vite 7, Bun |
| Linting | Biome |
| Testing | Playwright (E2E), Bun test (unit) |
| Analytics | PostHog |
| Deployment | GitHub Pages (static adapter) |

## Project Structure

```
src/
├── routes/                    # SvelteKit pages
│   ├── +page.svelte           #   Home / level selection
│   ├── +layout.svelte         #   Root layout
│   ├── learn/[level]/         #   Learning mode
│   ├── quiz/                  #   Quiz mode
│   └── browse/                #   Vocabulary browser & word detail
├── lib/
│   ├── components/            # Reusable components
│   │   ├── LanguageSwitcher.svelte
│   │   ├── ProgressBar.svelte
│   │   ├── QuizOption.svelte
│   │   ├── StatsDisplay.svelte
│   │   └── WordCard.svelte
│   ├── stores/                # Svelte stores (state management)
│   │   ├── progress.ts        #   Learning progress & statistics
│   │   ├── settings.ts        #   User preferences
│   │   ├── quiz.ts            #   Quiz state
│   │   └── vocabulary.ts      #   Vocabulary data & search
│   ├── i18n/                  # Internationalization
│   │   └── translations/      #   en.ts, ru.ts
│   ├── types.ts               # TypeScript interfaces
│   ├── constants.ts           # App constants
│   ├── utils.ts               # Utility functions
│   ├── analytics.ts           # PostHog integration
│   └── search.ts              # Binary search index
scripts/
├── build_vocabulary_v2.py     # Vocabulary builder (Python)
└── build-search-index.ts      # Search index builder
static/
├── vocabulary.json            # Vocabulary database (~200+ words)
└── search-index.bin           # Pre-built binary search index
tests/
└── app-flow.spec.ts           # E2E tests
```

## Development

### Prerequisites

- [Bun](https://bun.sh) — runtime and package manager
- Python 3 — only needed for rebuilding the vocabulary database:
  ```bash
  pip install -r scripts/requirements.txt
  ```

### Getting Started

```bash
bun install
bun run dev          # Start dev server with hot reload
```

### Available Commands

```bash
# Development
bun run dev                   # Dev server
bun run build                 # Production build
bun run preview               # Preview production build

# Code quality
bun run lint                  # Lint with Biome
bun run lint:fix              # Auto-fix lint issues
bun run check                 # Type-check with svelte-check

# Testing
bun run test                  # E2E tests (Playwright)
bun run test:unit             # Unit tests (Bun test)

# Data
bun run vocabulary-build      # Rebuild vocabulary.json
bun run search-index-build    # Rebuild search index
```

## Deployment

The app is automatically deployed to GitHub Pages when changes are pushed to the `main` branch via GitHub Actions. The static adapter outputs to `dist/`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run lint && bun run check` to verify code quality
5. Run `bun run test` to verify E2E tests pass
6. Submit a pull request

## License

MIT
