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

- **Frontend**: Pure HTML, CSS, JavaScript (no build process)
- **Backend**: None (static files only)
- **Data Storage**: 
  - `vocabulary.json` - Vocabulary database (loaded via fetch)
  - `localStorage` - User progress and settings
- **Analytics**: PostHog (embedded in HTML)
- **Deployment**: GitHub Pages (automatic via GitHub Actions)

### File Structure

```
armenian-words/
├── index.html          # Main HTML structure
├── main.js             # Application logic (ArmenianLearningApp class)
├── styles.css          # All styling
├── vocabulary.json     # Vocabulary database (generated, ~200+ words)
├── Makefile            # Build and serve commands
├── README.md           # User-facing documentation
├── AGENTS.md           # This file
└── scripts/
    ├── build_vocabulary.py  # Python script to generate vocabulary.json
    ├── requirements.txt     # Python dependencies
    └── README.md            # Vocabulary builder documentation
```

## Key Files and Their Purposes

### `index.html`

- Contains all HTML structure
- Three main screens: level selection, learning mode, quiz mode
- PostHog analytics initialization script
- No inline JavaScript (all logic in `main.js`)

### `main.js`

- **ArmenianLearningApp class**: Main application controller
- **Vocabulary loading**: Fetches `vocabulary.json` on initialization
- **State management**: Handles current level, quiz language, progress
- **Screen management**: Shows/hides screens based on user flow
- **localStorage operations**: Saves/loads user preferences and progress
- **Analytics tracking**: PostHog event tracking for quiz completion

### `styles.css`

- All styling in one file
- Responsive design (mobile and desktop)
- Modern CSS with Grid and Flexbox
- Gradient background, card-based UI

### `vocabulary.json`

- Generated file with a number of manual fixes
- Structure: `{ "A1": [...], "A2": [...], "B1": [...], "B2": [...] }`
- Each entry: `{ "am": "բարև", "ru": ["привет"], "en": ["hello"], "spell": "barev" }`
- Translations are arrays (multiple translations per word)
- Pronunciation stored in `spell` field (optional)

## Coding Conventions

### JavaScript

- **ES6+ features**: Classes, arrow functions, async/await
- **No frameworks**: Pure vanilla JavaScript
- **Class-based architecture**: Main app logic in `ArmenianLearningApp` class
- **Error handling**: Try-catch blocks for async operations
- **DOM manipulation**: Direct DOM API (no jQuery)
- **Event handling**: `addEventListener` (no inline handlers)

### CSS

- **Modern CSS**: Grid, Flexbox, CSS variables (if needed)
- **Mobile-first**: Responsive design
- **BEM-like naming**: `.word-card`, `.option-btn`, etc.
- **No CSS frameworks**: Pure CSS only

### HTML

- **Semantic HTML**: Use appropriate tags (`<header>`, `<footer>`, etc.)
- **Accessibility**: Proper ARIA labels if needed
- **No inline styles**: All styles in `styles.css`
- **No inline scripts**: All JavaScript in `main.js`

## Important Constraints

### User Rules (MUST FOLLOW)

1. **Do not remove existing comments** - Preserve all comments in the code
2. **Do not add comments explaining your changes** - Don't add comments like "// Added by AI" or "// Fixed bug"
3. **Do not add lines containing only spaces or tabs** - No blank lines with whitespace
4. **Do not add empty lines into existing code** - Maintain existing code density

### Code Quality

- **No console.log in production**: Remove or comment out debug statements
- **Error handling**: Fail fast with details in console
- **Performance**: Vocabulary loading is async - handle loading states
- **Browser compatibility**: Support modern browsers (ES6+)

### Data Format

- **vocabulary.json structure**: Must match existing format exactly
- **localStorage keys**: Use consistent prefixes (`armenianApp_*`, `armenianLearningStats`)

## Development Workflow

### Making Changes

1. **Frontend changes** (HTML/CSS/JS):
- Edit files directly
- Test locally: `make serve` (runs on [http://localhost:8000](http://localhost:8000))
- **MANDATORY**: Test functionality in browser before declaring complete
- No build step required

## Key Implementation Details

### Vocabulary Loading

- `vocabulary.json` is loaded via `fetch()` on app initialization
- If loading fails, shows error message to user
- Vocabulary is stored in global `vocabulary` variable
- Access via `getWordsByLevel(level)` helper function

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

- **Automatic**: GitHub Actions deploys to GitHub Pages on push to `main` branch
- **Manual**: Push changes to `main` branch
- **No build step**: Files are served as-is
- **Caching**: Browsers cache `vocabulary.json` automatically

## Best Practices

1. **Keep it simple**: No unnecessary abstractions or frameworks
2. **User experience**: Always show loading/error states
3. **Performance**: Vocabulary is small (~1000 words), no optimization needed
4. **Accessibility**: Use semantic HTML, proper labels
5. **Maintainability**: Code is straightforward, easy to understand
6. **Testing**: Always test in real browser, not just in head

Remember: This is a simple, static web app. Keep changes straightforward and maintainable.
