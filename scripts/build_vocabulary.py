"""
Build vocabulary.json from multiple sources:
1. StarDict files (ArmRus_1.28) - Armenian-Russian
2. Angleren_bararan.txt - English-Armenian with pronunciation
3. Merge by Armenian word
4. Filter common words and assign CEFR levels
"""

import argparse
import json
import csv
import re
import gzip
import struct
from pathlib import Path
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple
from tqdm import tqdm

# Configuration
STARDICT_DIR = Path("vocabulary_sources/ArmRus_1.28")
PDF_DICT_FILE = Path("vocabulary_sources/dictionary-armenian-english ocr.pdf")
OUTPUT_FILE = Path("vocabulary.json")
TMP_DIR = Path("scripts/tmp")
TMP_DIR.mkdir(parents=True, exist_ok=True)
MAX_WORDS = 10000
MIN_WORDS_PER_SOURCE = 700

# Common word patterns to prioritize (shorter, simpler words are more common)
COMMON_PATTERNS = {
    'common_length': (1, 20),  # Words between 1-20 characters (allow one-letter words)
    'prefer_simple': True,  # Prefer words without complex morphology
}

# Words to exclude (rare, technical, archaic)
EXCLUDE_PATTERNS = [
    r'^[Ա-Ֆ]$',  # Single capital letters
    r'[0-9]',  # Words with numbers
]


def is_abbreviation(word: str) -> bool:
    """Check if word is an abbreviation (very short all uppercase, 2-3 chars max)."""
    if not word:
        return False
    # Only filter very short words (2-3 chars) that are all uppercase
    # Longer words might be proper nouns or dictionary entries in uppercase
    return len(word) <= 3 and word.isupper() and all(c.isalpha() for c in word)


def clean_translation(translation: str) -> List[str]:
    """
    Clean translation text to extract single words.
    Removes numbers, markup, symbols, and returns list of clean words.
    """
    if not translation:
        return []

    # Remove HTML tags
    translation = re.sub(r'<[^>]+>', '', translation)

    # Remove special symbols
    translation = re.sub(r'[◊•▪▫]', '', translation)

    # Remove numbers at the start (like "1. ", "2. ")
    translation = re.sub(r'^\d+\.?\s*', '', translation)

    # Split by common delimiters
    parts = re.split(r'[;,\n]|\.\s+(?=[А-ЯA-Z])', translation)  # Split on period only if followed by capital
    words = []
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Remove parentheses and brackets content
        part = re.sub(r'\([^)]*\)', '', part)
        part = re.sub(r'\[[^\]]*\]', '', part)
        part = re.sub(r'\{[^}]*\}', '', part)
        part = part.strip()

        if not part:
            continue

        # Extract words - only Cyrillic or Latin (no Armenian in translations)
        # Match sequences of letters (Cyrillic, Latin) possibly with hyphens
        word_matches = re.findall(r'[\u0400-\u04FFa-zA-Z]+(?:-[\u0400-\u04FFa-zA-Z]+)*', part)
        for word in word_matches:
            # Remove trailing punctuation
            word = word.rstrip('.,;:!?')
            # Filter: must be at least 2 chars, not a digit, and not Armenian
            if len(word) >= 2 and not word.isdigit() and not re.search(r'[\u0530-\u058F\u0531-\u0556]', word):
                words.append(word)

    # If no words found, try to extract at least something from the original
    if not words and translation.strip():
        # Last resort: take first word-like sequence
        first_word = re.search(r'[\u0400-\u04FF\u0530-\u058F\u0590-\u05FFa-zA-Z]{2,}', translation)
        if first_word:
            words.append(first_word.group().rstrip('.,;:!?'))

    # Remove duplicates while preserving order
    seen = set()
    unique_words = []
    for word in words:
        word_lower = word.lower()
        if word_lower not in seen:
            seen.add(word_lower)
            unique_words.append(word)

    return unique_words[:5]  # Limit to 5 translations max


def is_common_word(word: str, translation: str = "", strict: bool = False) -> bool:
    """
    Determine if a word is likely common/used in daily life.
    Filters out rare, technical, or archaic words.
    If strict=False, only applies basic filters.
    """
    # Basic checks - always apply
    if len(word) < 1:
        return False

    # Filter out abbreviations (all uppercase, 2-3 chars max)
    if is_abbreviation(word):
        return False

    # Exclude patterns
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, word):
            return False

    if strict:
        # Strict filtering
        if not (COMMON_PATTERNS['common_length'][0] <= len(word) <= COMMON_PATTERNS['common_length'][1]):
            return False

        # Prefer words with Armenian lowercase letters
        if not re.search(r'[ա-ֆ]', word):
            return False

    return True


def save_to_csv(data: Dict[str, List[str]], filepath: Path):
    """Save dictionary to CSV file (translations as lists)."""
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['armenian', 'translations'])
        for key, value in data.items():
            # Join list with semicolon
            translations_str = ';'.join(value) if isinstance(value, list) else value
            writer.writerow([key, translations_str])


def load_from_csv(filepath: Path) -> Dict[str, List[str]]:
    """Load dictionary from CSV file (translations as lists)."""
    if not filepath.exists():
        return {}
    result = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Split by semicolon to get list
            translations = [t.strip() for t in row['translations'].split(';') if t.strip()]
            if translations:
                result[row['armenian']] = translations
    return result


def save_english_dict_to_csv(data: Dict[str, Dict[str, Any]], filepath: Path):
    """Save English dictionary to CSV file."""
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['armenian', 'english', 'pronunciation'])
        for key, value in data.items():
            english = ','.join(value['english']) if value['english'] else ''
            pronunciation = value['pronunciation'] or ''
            writer.writerow([key, english, pronunciation])


def load_english_dict_from_csv(filepath: Path) -> Dict[str, Dict[str, Any]]:
    """Load English dictionary from CSV file."""
    if not filepath.exists():
        return {}
    result = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            english_list = [e.strip() for e in row['english'].split(',') if e.strip()] if row['english'] else []
            result[row['armenian']] = {
                'english': english_list,
                'pronunciation': row['pronunciation'] if row['pronunciation'] else None
            }
    return result


def parse_stardict_ifo(ifo_path: Path) -> Dict[str, str]:
    """Parse StarDict .ifo file to get metadata."""
    metadata = {}
    with open(ifo_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                key, value = line.split('=', 1)
                metadata[key.strip()] = value.strip()
    return metadata


def parse_stardict_idx(idx_path: Path) -> List[Tuple[str, int, int]]:
    """
    Parse StarDict .idx file.
    Returns list of (word, offset, size) tuples.
    """
    entries = []
    file_size = idx_path.stat().st_size

    with open(idx_path, 'rb') as f:
        pbar = tqdm(total=file_size, desc="Parsing StarDict index", unit="B", unit_scale=True)
        try:
            while True:
                start_pos = f.tell()

                # Read word (null-terminated string)
                word_bytes = b''
                while True:
                    byte = f.read(1)
                    if not byte:
                        pbar.update(file_size - start_pos)
                        return entries
                    if byte == b'\x00':
                        break
                    word_bytes += byte

                try:
                    word = word_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    continue

                # Read offset (4 bytes, big-endian)
                offset_bytes = f.read(4)
                if len(offset_bytes) < 4:
                    pbar.update(file_size - start_pos)
                    break
                offset = struct.unpack('>I', offset_bytes)[0]

                # Read size (4 bytes, big-endian)
                size_bytes = f.read(4)
                if len(size_bytes) < 4:
                    pbar.update(file_size - start_pos)
                    break
                size = struct.unpack('>I', size_bytes)[0]

                entries.append((word, offset, size))
                pbar.update(f.tell() - start_pos)
        finally:
            pbar.close()

    return entries


def parse_stardict_dict(dict_path: Path, entries: List[Tuple[str, int, int]], cache_file: Path, use_cache: bool = True) -> Dict[str, List[str]]:
    """
    Parse StarDict .dict.dz file (gzipped).
    Returns dict mapping Armenian word -> list of Russian translations.
    """
    # Try to load from cache
    if use_cache and cache_file.exists():
        print(f"  Loading from cache: {cache_file}")
        return load_from_csv(cache_file)

    armenian_russian: Dict[str, List[str]] = {}

    # Check if it's gzipped
    if dict_path.suffix == '.dz':
        open_func = gzip.open
        mode = 'rb'
    else:
        open_func = open
        mode = 'rb'

    with open_func(dict_path, mode) as f:
        pbar = tqdm(total=len(entries), desc="Extracting Russian translations", unit="words")
        extracted_count = 0
        skipped_count = 0
        try:
            for word, offset, size in entries:
                try:
                    # Skip abbreviations
                    if is_abbreviation(word):
                        skipped_count += 1
                        pbar.update(1)
                        continue

                    f.seek(offset)
                    data = f.read(size)

                    if data and len(data) > 1:
                        # StarDict format: first byte is type, rest is data
                        translation_raw = data[1:].decode('utf-8', errors='ignore').strip()
                        if not translation_raw:
                            skipped_count += 1
                            pbar.update(1)
                            continue

                        # Clean and extract words from translation
                        clean_words = clean_translation(translation_raw)

                        if clean_words:
                            # Use lenient filtering during extraction
                            if is_common_word(word, strict=False):
                                armenian_russian[word] = clean_words
                                extracted_count += 1
                            else:
                                skipped_count += 1
                        else:
                            skipped_count += 1
                    else:
                        skipped_count += 1
                except (UnicodeDecodeError, IndexError, OSError, struct.error) as e:
                    skipped_count += 1

                pbar.update(1)
        finally:
            pbar.close()

    # Save to cache
    if armenian_russian:
        save_to_csv(armenian_russian, cache_file)
        print(f"  Cached {len(armenian_russian)} translations to {cache_file}")

    return armenian_russian


def parse_pdf_dictionary(pdf_file: Path, cache_file: Path, use_cache: bool = True) -> Dict[str, Dict[str, Any]]:
    """
    Parse PDF dictionary with 3 columns: armenian, pronunciation, english (comma-separated).
    Returns dict mapping Armenian word -> {english: [...], pronunciation: "..."}
    """
    # Try to load from cache
    if use_cache and cache_file.exists():
        print(f"  Loading from cache: {cache_file}")
        return load_english_dict_from_csv(cache_file)

    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise ImportError("PyMuPDF (pymupdf) is required for PDF parsing. Install it with: pip install pymupdf")

    armenian_english: Dict[str, Dict[str, Any]] = defaultdict(lambda: {'english': [], 'pronunciation': None})

    print(f"  Extracting text from PDF...")
    pdf_doc = fitz.open(pdf_file)
    total_pages = len(pdf_doc)
    pbar = tqdm(total=total_pages, desc="Parsing PDF dictionary", unit="pages")
    
    try:
        for page_num in range(total_pages):
            page = pdf_doc[page_num]
            # Extract text blocks (preserves column layout)
            blocks = page.get_text("blocks")
            
            # Separate blocks by type and store with y-coordinates
            armenian_blocks = []  # (y0, y1, words_list) - may contain multiple words
            pronunciation_blocks = {}  # y -> text
            english_blocks = {}  # y -> text
            
            for block in blocks:
                if len(block) < 5:
                    continue
                x0, y0, x1, y1 = float(block[0]), float(block[1]), float(block[2]), float(block[3])
                text = block[4] if len(block) > 4 else ""
                if not text or not text.strip():
                    continue
                
                text = text.strip()
                
                # Column 1 (left, x < 200): Armenian words (may be multiple per block)
                if x0 < 200 and re.search(r'[\u0530-\u058F\u0531-\u0556]', text):
                    # Split into individual words
                    words = [w.strip() for w in text.split('\n') if w.strip()]
                    armenian_words = [w for w in words if re.search(r'[\u0530-\u058F\u0531-\u0556]', w)]
                    if armenian_words:
                        armenian_blocks.append((y0, y1, armenian_words))
                
                # Column 2 (middle, 200 <= x < 350): Pronunciation
                elif 200 <= x0 < 350:
                    # Use y0 as key (rounded for matching)
                    y_key = round(y0, 1)
                    pronunciation_blocks[y_key] = text
                
                # Column 3 (right, x >= 350): English translations
                elif x0 >= 350 and re.search(r'[a-zA-Z]', text):
                    y_key = round(y0, 1)
                    if y_key in english_blocks:
                        english_blocks[y_key] += ', ' + text
                    else:
                        english_blocks[y_key] = text
            
            # Process each Armenian block - split into individual words and match
            for arm_y0, arm_y1, armenian_words in armenian_blocks:
                block_height = arm_y1 - arm_y0
                # Use actual line count (including empty lines) for more accurate positioning
                total_lines = max(len(armenian_words), int(block_height / 20))  # Estimate ~20px per line
                line_height = block_height / total_lines if total_lines > 0 else 20
                
                for i, armenian_word in enumerate(armenian_words):
                    # Calculate y position for this word (middle of its line)
                    # Assume words are evenly distributed in the block
                    word_y = arm_y0 + (i + 0.5) * (block_height / len(armenian_words)) if len(armenian_words) > 1 else (arm_y0 + arm_y1) / 2
                    word_y_key = round(word_y, 1)
                    
                    # Find matching pronunciation and English (within 10 pixels tolerance)
                    pronunciation = None
                    english_text = None
                    best_pron_dist = 10.0
                    best_eng_dist = 10.0
                    
                    # Find closest pronunciation
                    for pron_y, pron_text in pronunciation_blocks.items():
                        dist = abs(float(pron_y) - word_y)
                        if dist < best_pron_dist:
                            best_pron_dist = dist
                            pronunciation = pron_text
                    
                    # Find closest English
                    for eng_y, eng_text in english_blocks.items():
                        dist = abs(float(eng_y) - word_y)
                        if dist < best_eng_dist:
                            best_eng_dist = dist
                            english_text = eng_text
                    
                    # Process if we have Armenian and English
                    if armenian_word and english_text:
                        # Clean Armenian word
                        armenian_word = armenian_word.strip('.,;:()[]{}')
                        
                        # Skip if not Armenian Unicode
                        if not re.search(r'[\u0530-\u058F\u0531-\u0556]', armenian_word):
                            continue
                        
                        # Skip abbreviations
                        if is_abbreviation(armenian_word):
                            continue
                        
                        # Allow one-letter words
                        if len(armenian_word) < 1:
                            continue
                        
                        # Parse English translations (comma-separated)
                        english_words = [w.strip().lower() for w in english_text.split(',') if w.strip()]
                        
                        if english_words:
                            # Clean English words - take first few main translations
                            clean_english = []
                            for eng in english_words[:3]:  # Limit to first 3 comma-separated groups
                                # Clean each translation
                                cleaned = eng.strip().lower()
                                # Remove common prefixes like "to ", "a ", "an "
                                cleaned = re.sub(r'^(to|a|an|the)\s+', '', cleaned)
                                if cleaned and len(cleaned) >= 2:
                                    clean_english.append(cleaned)
                            
                            # Remove duplicates
                            clean_english = list(dict.fromkeys(clean_english))
                            
                            if clean_english:
                                # Store entry
                                for eng_word in clean_english:
                                    if eng_word not in armenian_english[armenian_word]['english']:
                                        armenian_english[armenian_word]['english'].append(eng_word)
                                
                                # Store pronunciation if available and not already set
                                # Only store if it's a valid pronunciation (not empty, reasonable length)
                                if pronunciation:
                                    pronunciation_clean = pronunciation.strip('[]()')
                                    if pronunciation_clean and 2 <= len(pronunciation_clean) <= 50:
                                        if not armenian_english[armenian_word]['pronunciation']:
                                            armenian_english[armenian_word]['pronunciation'] = pronunciation_clean
                
            pbar.update(1)
    finally:
        pbar.close()
        pdf_doc.close()

    result = dict(armenian_english)

    # Save to cache
    if result:
        save_english_dict_to_csv(result, cache_file)
        print(f"  Cached {len(result)} entries to {cache_file}")

    return result


def calculate_word_complexity(word: str, has_pronunciation: bool = False) -> float:
    """
    Calculate word complexity score (lower = simpler, more common).
    Used for level assignment.
    """
    score = 0.0

    # Length factor (shorter = simpler)
    score += len(word) * 0.1

    # Abstract suffixes increase complexity
    abstract_suffixes = ['ություն', 'ական', 'ային', 'ավոր', 'ականություն']
    for suffix in abstract_suffixes:
        if word.endswith(suffix):
            score += 2.0

    # Compound words are more complex
    if '-' in word or len(word) > 15:
        score += 1.5

    # Having pronunciation available suggests it's a common word
    if has_pronunciation:
        score -= 0.5

    return score


def assign_levels(vocabulary: List[Dict], max_per_level: int = 2500) -> Dict[str, List[Dict]]:
    """
    Assign CEFR levels to vocabulary based on word complexity.
    A1: simplest, most common words
    A2: simple words
    B1: moderate complexity
    B2: more complex words
    """
    # Sort by complexity
    vocabulary_with_scores = []
    for entry in vocabulary:
        has_pronunciation = 'pronunciation' in entry and entry['pronunciation']
        armenian_word = entry.get('am', '')
        complexity = calculate_word_complexity(armenian_word, has_pronunciation)
        vocabulary_with_scores.append((complexity, entry))

    # Sort by complexity (ascending - simpler first)
    vocabulary_with_scores.sort(key=lambda x: x[0])

    # Assign levels
    leveled = {
        'A1': [],
        'A2': [],
        'B1': [],
        'B2': []
    }

    total = len(vocabulary_with_scores)
    per_level = min(total // 4, max_per_level)

    for i, (complexity, entry) in enumerate(vocabulary_with_scores):
        if len(leveled['A1']) < per_level:
            leveled['A1'].append(entry)
        elif len(leveled['A2']) < per_level:
            leveled['A2'].append(entry)
        elif len(leveled['B1']) < per_level:
            leveled['B1'].append(entry)
        elif len(leveled['B2']) < per_level:
            leveled['B2'].append(entry)
        else:
            # Distribute remaining words evenly
            if i % 4 == 0:
                leveled['A1'].append(entry)
            elif i % 4 == 1:
                leveled['A2'].append(entry)
            elif i % 4 == 2:
                leveled['B1'].append(entry)
            else:
                leveled['B2'].append(entry)

    return leveled


def normalize_armenian_word(word: str) -> str:
    """Normalize Armenian word for comparison (lowercase)."""
    return word.lower()


def merge_vocabularies(
    armenian_russian: Dict[str, List[str]],
    armenian_english: Dict[str, Dict],
    max_words: int = MAX_WORDS
) -> List[Dict]:
    """
    Merge Armenian-Russian and Armenian-English dictionaries.
    Only keeps words with both Russian AND English translations.
    Returns list of vocabulary entries with "am", "ru", "en" keys.
    """
    vocabulary = []

    print("\nMerging vocabularies...")

    # Normalize Armenian words for case-insensitive matching
    # Create normalized lookup maps
    russian_normalized = {normalize_armenian_word(k): (k, v) for k, v in armenian_russian.items()}
    english_normalized = {normalize_armenian_word(k): (k, v) for k, v in armenian_english.items()}

    # Find common words (case-insensitive)
    common_words_normalized = set(russian_normalized.keys()) & set(english_normalized.keys())
    print(f"  Found {len(common_words_normalized)} words with both translations")

    pbar = tqdm(total=min(len(common_words_normalized), max_words), desc="Merging translations", unit="words")
    try:
        for normalized_word in common_words_normalized:
            if len(vocabulary) >= max_words:
                break

            # Get original words and translations
            armenian_word_ru, russian_translations = russian_normalized[normalized_word]
            armenian_word_en, english_data = english_normalized[normalized_word]

            # Use the original word (prefer the one from Russian dict, or English if it has lowercase)
            # Prefer word with lowercase letters if available
            if any(c.islower() for c in armenian_word_en):
                armenian_word = armenian_word_en
            else:
                armenian_word = armenian_word_ru

            # Get English translations
            english_list = english_data['english']
            if not english_list:
                continue  # Skip if no English translations

            # Clean English translations
            clean_english = []
            for eng in english_list:
                clean_words = clean_translation(eng)
                clean_english.extend(clean_words)

            if not clean_english:
                continue  # Skip if no clean English translations

            # Remove duplicates
            clean_english = list(dict.fromkeys(clean_english))[:5]  # Max 5 translations

            # Create entry with new format
            entry = {
                'am': armenian_word,
                'ru': russian_translations[:5],  # Max 5 translations
                'en': clean_english
            }

            # Add pronunciation if available
            if english_data['pronunciation']:
                entry['pronunciation'] = english_data['pronunciation']

            vocabulary.append(entry)
            pbar.update(1)
    finally:
        pbar.close()

    return vocabulary


def main():
    parser = argparse.ArgumentParser(description='Build vocabulary.json from dictionary sources')
    parser.add_argument('--no-cache-russian', action='store_true',
                        help='Skip loading Russian translations from cache')
    parser.add_argument('--no-cache-english', action='store_true',
                        help='Skip loading English translations from cache')
    parser.add_argument('--no-cache', action='store_true',
                        help='Skip loading all caches')
    args = parser.parse_args()

    use_cache_russian = not (args.no_cache or args.no_cache_russian)
    use_cache_english = not (args.no_cache or args.no_cache_english)

    print("=" * 60)
    print("Building vocabulary from sources")
    print("=" * 60)
    if not use_cache_russian or not use_cache_english:
        print("Cache options:")
        if not use_cache_russian:
            print("  - Skipping Russian cache")
        if not use_cache_english:
            print("  - Skipping English cache")

    # Parse StarDict (Armenian-Russian)
    print("\n[1/4] Parsing StarDict files...")
    ifo_path = STARDICT_DIR / "ArmRus_1.28.ifo"
    idx_path = STARDICT_DIR / "ArmRus_1.28.idx"
    dict_path = STARDICT_DIR / "ArmRus_1.28.dict.dz"
    cache_file_russian = TMP_DIR / "armenian_russian.csv"

    armenian_russian = {}
    if all(p.exists() for p in [ifo_path, idx_path, dict_path]):
        metadata = parse_stardict_ifo(ifo_path)
        wordcount = int(metadata.get('wordcount', 0))
        print(f"  Found {wordcount:,} words in StarDict")

        entries = parse_stardict_idx(idx_path)
        print(f"  Parsed {len(entries):,} index entries")

        armenian_russian = parse_stardict_dict(dict_path, entries, cache_file_russian, use_cache=use_cache_russian)
        print(f"  Extracted {len(armenian_russian):,} common Armenian-Russian translations")

        # Validation
        if len(armenian_russian) < MIN_WORDS_PER_SOURCE:
            raise ValueError(
                f"❌ Error: Only extracted {len(armenian_russian)} Russian translations, "
                f"expected at least {MIN_WORDS_PER_SOURCE}. Check parsing logic."
            )
    else:
        print("  ⚠️  StarDict files not found, skipping...")
        missing = [p.name for p in [ifo_path, idx_path, dict_path] if not p.exists()]
        print(f"  Missing: {', '.join(missing)}")

    # Parse PDF dictionary (English-Armenian)
    print("\n[2/4] Parsing PDF dictionary...")
    cache_file_english = TMP_DIR / "armenian_english.csv"
    armenian_english = {}
    if PDF_DICT_FILE.exists():
        armenian_english = parse_pdf_dictionary(PDF_DICT_FILE, cache_file_english, use_cache=use_cache_english)
        print(f"  Extracted {len(armenian_english):,} common Armenian-English entries")

        # Validation
        if len(armenian_english) < MIN_WORDS_PER_SOURCE:
            raise ValueError(
                f"❌ Error: Only extracted {len(armenian_english)} English translations, "
                f"expected at least {MIN_WORDS_PER_SOURCE}. Check parsing logic."
            )
    else:
        print(f"  ⚠️  PDF dictionary not found at {PDF_DICT_FILE}, skipping...")

    if not armenian_russian and not armenian_english:
        raise ValueError("❌ Error: No source files found. Please check file paths.")

    # Merge vocabularies
    print("\n[3/4] Merging vocabularies...")
    vocabulary = merge_vocabularies(armenian_russian, armenian_english, max_words=MAX_WORDS)
    print(f"  Merged {len(vocabulary):,} vocabulary entries (max: {MAX_WORDS:,})")

    if len(vocabulary) == 0:
        raise ValueError("❌ Error: No vocabulary entries after merging. Check source files.")

    # Assign levels
    print("\n[4/4] Assigning CEFR levels...")
    leveled_vocabulary = assign_levels(vocabulary, max_per_level=2500)
    for level, words in leveled_vocabulary.items():
        print(f"  {level}: {len(words):,} words")

    # Save to JSON with 1 space indentation
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(leveled_vocabulary, f, ensure_ascii=False, indent=1)

    total_words = sum(len(words) for words in leveled_vocabulary.values())
    print(f"\n✅ Done! Created vocabulary with {total_words:,} words across 4 levels.")
    print(f"   Output file: {OUTPUT_FILE.absolute()}")


if __name__ == "__main__":
    main()
