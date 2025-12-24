# Vocabulary Builder Script

This script builds `vocabulary.json` from multiple dictionary sources.

## Features

- **Parses StarDict files** (Armenian-Russian dictionary with 64,279 words)
- **Parses PDF dictionary** (Armenian-English dictionary with pronunciation from OCR PDF)
- **Merges translations** by Armenian word
- **Filters common words** - excludes rare, technical, and archaic words
- **Smart level assignment** - distributes words across A1-B2 levels based on complexity
- **Progress indicators** - shows real-time progress during parsing
- **Caching** - saves intermediate results to CSV files for faster subsequent runs
- **Limits vocabulary** - keeps under 10,000 words for practical learning

## Installation

```bash
pip install -r scripts/requirements.txt
```

## Usage

Run the script using Python:

```bash
python scripts/build_vocabulary.py
```

### Command-line Options

- `--no-cache-russian`: Skip loading Russian translations from cache
- `--no-cache-english`: Skip loading English translations from cache
- `--no-cache`: Skip loading all caches

Example:
```bash
python scripts/build_vocabulary.py --no-cache-english
```

## How It Works

1. **Parses StarDict files** (`ArmRus_1.28` folder)
   - Reads `.ifo` metadata file
   - Parses `.idx` index file
   - Extracts translations from `.dict.dz` (gzipped dictionary)
   - Caches results to `scripts/tmp/armenian_russian.csv`

2. **Parses PDF dictionary** (`dictionary-armenian-english ocr.pdf`)
   - Uses PyMuPDF to extract text blocks with coordinate information
   - Groups blocks by row (y-coordinate) to match columns
   - Extracts 3 columns: Armenian word, pronunciation, English translations
   - Handles multiple words per Armenian block by calculating individual y-positions
   - Matches pronunciation and English blocks by y-coordinate (within 10 pixel tolerance)
   - Caches results to `scripts/tmp/armenian_english.csv`
   
   **Note**: The PDF was generated using OCR from the original PDF:
   ```bash
   # tesseract was installed already.
   sudo apt install ocrmypdf
   ocrmypdf --force-ocr -l hye+eng --sidecar dictionary_layout.txt dictionary-armenian-english.pdf dictionary-armenian-english ocr.pdf
   ```

3. **Merges vocabularies**
   - Matches Armenian words from both sources (case-insensitive)
   - Only includes words that have **both** Russian and English translations
   - Combines multiple translations per word (up to 5 per language)

4. **Filters words**
   - Excludes abbreviations (very short all-uppercase words, 2-3 chars max)
   - Excludes single letters, numbers, non-Armenian text
   - Filters out Armenian words from Russian translations
   - Removes very short words (less than 3 characters) from translations
   - Keeps words between 2-20 characters (relaxed for initial extraction)

5. **Assigns CEFR levels**
   - A1: Simplest, most common words (e.g., "բարև", "ջուր")
   - A2: Simple words (e.g., "ընկեր", "աշխատանք")
   - B1: Moderate complexity (e.g., "կրթություն", "մշակույթ")
   - B2: More complex words (e.g., "գիտակցություն", "պատասխանատվություն")
   - Level assignment based on word length, suffixes, and complexity

6. **Outputs JSON**
   - Creates `vocabulary.json` in the project root
   - Format matches existing vocabulary structure
   - Includes Armenian, English, Russian, and optional pronunciation

## Configuration

Edit the script to adjust:

- `MAX_WORDS`: Maximum total words (default: 10,000)
- `COMMON_PATTERNS`: Word filtering criteria
- `EXCLUDE_PATTERNS`: Patterns to exclude
- Level distribution limits

## Output Format

```json
{
 "A1": [
  {
   "am": "բարև",
   "ru": ["привет", "здравствуй"],
   "en": ["hello", "hi"],
   "pronunciation": "barev"
  }
 ],
 "A2": [...],
 "B1": [...],
 "B2": [...]
}
```

Note: The output uses short keys (`am`, `ru`, `en`) and stores translations as lists to support multiple translations per word.

## Notes

- The script prioritizes words with **both** Russian and English translations
- Words are filtered to exclude rare/technical/archaic terms
- Progress bars show real-time parsing status (requires `tqdm`)
- Intermediate results are cached in `scripts/tmp/` for faster subsequent runs
- The script validates that at least 1,000 words are extracted from each source
- PDF parsing uses coordinate-based matching to align Armenian words with their pronunciations and English translations

