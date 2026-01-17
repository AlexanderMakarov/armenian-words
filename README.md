🇦🇲 Armenian Language Learning App

A web-based static application for learning Armenian vocabulary with interactive learning and quiz modes.

## Features

- **Language Levels**: A1, A2, B1, B2 difficulty levels
- **Learning Mode**: Study 10 Armenian words with English and Russian translations
- **Quiz Mode**: Test your knowledge by selecting the correct Armenian word for given translations
- **Language Choice**: Choose between English or Russian for quiz questions
- **Multiple Translations**: Support for words with multiple translation variants
- **Progress Tracking**: Browser cache stores your language level and quiz performance
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. Select your Armenian language level (A1-B2)
2. Choose your preferred quiz language (English or Russian)
3. Study 10 vocabulary words in learning mode
4. Take the quiz to test your knowledge
5. View your score and start a new session or change difficulty level

## Technical Details

- **Frontend**: HTML, TypeScript (compiled to JavaScript), Sass (compiled to CSS)
- **Build Tool**: Bun (for TypeScript compilation, Sass compilation, and development server)
- Uses browser localStorage for persistent settings and progress
- Responsive design with modern CSS Grid and Flexbox
- Vocabulary database with 200+ Armenian words across difficulty levels
- Browser caching: `vocabulary.json` is cached by browsers using default caching behavior

## GitHub Pages Deployment

This app is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment is handled by GitHub Actions workflow.

### Live Demo

Once deployed, the app will be available at: `https://[username].github.io/[repository-name]/`

## Development

### Prerequisites

- **Bun** (runtime and build tool) - [Install Bun](https://bun.sh)
- **Python 3** (for building vocabulary):
  ```bash
  pip install -r scripts/requirements.txt
  ```

### Project Structure

```
src/              # Source files
├── index.html    # Main HTML
├── main.ts       # TypeScript source
└── styles.scss   # Sass source
static/           # Development build output (gitignored)
dist/             # Production build output (gitignored)
```         

### Build Commands

```bash
# Development server (watches for changes, auto-compiles)
bun run dev

# Production build
bun run build

# Build vocabulary database
bun run vocabulary-build

# Build vocabulary without cache
bun run vocabulary-build-no-cache

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix
```

### Running Locally

1. Clone the repository
2. Install dependencies:
  ```bash
   bun install
  ```
3. Build vocabulary (if needed):
  ```bash
   bun run vocabulary-build
  ```
4. Start the development server:
  ```bash
   bun run dev
  ```
   This will:
  - Compile TypeScript to JavaScript
  - Compile Sass to CSS
  - Copy assets from `src/assets/` to `static/assets/`
  - Start a dev server at `http://localhost:8000`
  - Watch for file changes and auto-recompile
5. Open `http://localhost:8000` in your browser

For production builds, run `bun run build` which creates optimized files in the `dist/` directory.

## Caching Configuration

The vocabulary data is stored as `vocabulary.json` instead of a JavaScript file. Browsers typically cache JSON files more aggressively than JavaScript files by default, providing better caching behavior on GitHub Pages without requiring custom HTTP headers.

This approach works well with GitHub Pages since it relies on browser default caching policies rather than server-side cache headers.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the application
5. Submit a pull request

## License

This project is open source and available under the MIT License.

# Roadmap/TODO

- [x] Add pronunciation to cards
- [x] Add "Previous Word" button to cards
- [x] Switch to TypeScript
- [x] Show words in quiz which where shown in cards
- [ ] Make quiz by translations, not by words + Ability to run quizes without cards
- [ ] Add vocabulary page
