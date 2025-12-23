# 🇦🇲 Armenian Language Learning App

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

- Pure HTML, CSS, and JavaScript (no build process required)
- Uses browser localStorage for persistent settings and progress
- Responsive design with modern CSS Grid and Flexbox
- Vocabulary database with 200+ Armenian words across difficulty levels
- Browser caching: `vocabulary.json` is cached by browsers using default caching behavior

## GitHub Pages Deployment

This app is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment is handled by GitHub Actions workflow.

### Live Demo

Once deployed, the app will be available at: `https://[username].github.io/[repository-name]/`

## Development

To run locally:

1. Clone the repository
2. Open `index.html` in a web browser, or
3. Serve with a local HTTP server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── main.js            # Application logic
├── vocabulary.json    # Armenian vocabulary database (JSON format for better browser caching)
├── README.md          # This file
└── .github/
    └── workflows/
        └── deploy.yml # GitHub Pages deployment workflow
```

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