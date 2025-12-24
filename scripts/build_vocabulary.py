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
MIN_WORDS_PER_SOURCE = 700


def is_abbreviation(word: str) -> bool:
    """Check if word is an abbreviation (very short all uppercase, 2-3 chars max)."""
    if not word:
        return False
    # Only filter very short words (2-3 chars) that are all uppercase
    # Longer words might be proper nouns or dictionary entries in uppercase
    return len(word) <= 3 and word.isupper() and all(c.isalpha() for c in word)


def fix_ocr_pronunciation(pron: str) -> str:
    """
    Fix common OCR errors in pronunciations.
    Common errors: "879" -> "azq", "8" -> "a", "7" -> "z", "9" -> "q"
    """
    if not pron:
        return pron
    
    # Common OCR error patterns for Armenian pronunciations
    # These are based on visual similarity in OCR
    ocr_fixes = {
        '879': 'azq',  # Common error for "azq"
        '8': 'a',
        '7': 'z', 
        '9': 'q',
        '0': 'o',
        '1': 'l',
        '5': 's',
    }
    
    # If the entire pronunciation is a known OCR error pattern, fix it
    if pron in ocr_fixes:
        return ocr_fixes[pron]
    
    # Otherwise, try character-by-character fixes for all-digit strings
    if pron.isdigit() and len(pron) <= 5:
        # Try to fix each digit
        fixed = ''.join(ocr_fixes.get(c, c) for c in pron)
        return fixed
    
    return pron


def clean_translation(translation: str) -> Tuple[List[str], str]:
    """
    Clean translation text to extract meanings/phrases.
    Keeps phrases together (e.g., "ударило в голову" stays as one phrase).
    Removes numbers, markup, symbols, and returns (translations, usage_examples).
    Extracts Russian/English text even when mixed with Armenian.
    All translations are lowercased.
    
    Format: "1. wordtype. Translation. 2. wordtype. Translation. ◊ usage examples..."
    - Everything before ◊ is translations (numbered meanings)
    - Everything after ◊ is usage examples (for CEFR calculation, not translations)
    """
    if not translation:
        return [], ""

    # Remove HTML tags
    translation = re.sub(r'<[^>]+>', '', translation)

    # Split by ◊ symbol - everything before is translations, after is usage examples
    parts = translation.split('◊', 1)
    translation_part = parts[0].strip()
    usage_examples = parts[1].strip() if len(parts) > 1 else ""

    # Split by numbered meanings (patterns like "1. ", "2. ", etc.)
    # Format: "1. wordtype. Translation. 2. wordtype. Translation."
    numbered_parts = re.split(r'\s*\d+\.\s+', translation_part)
    
    # Remove empty first part if translation starts with number
    if numbered_parts and not numbered_parts[0].strip():
        numbered_parts = numbered_parts[1:]
    
    meanings = []
    
    for numbered_part in numbered_parts:
        part = numbered_part.strip()
        if not part:
            continue
        
        # Remove word type markers (Armenian abbreviations like "թվ.", "գ.", etc.)
        # These are typically 1-3 Armenian characters followed by a period
        part = re.sub(r'[ա-ֆԱ-Ֆ]{1,3}\.\s*', '', part)
        
        # Find the first Russian/English translation segment
        # Stop when we encounter Armenian characters (which indicate usage examples)
        # Pattern: extract Russian/English text until we hit Armenian characters
        # Example: "Нация. Ազգերի..." -> extract "Нация" and stop at "Ազգերի"
        
        # Find all sequences of Russian/English text, but stop at Armenian
        # We want the FIRST such sequence (the main translation)
        # Everything after Armenian characters is usage examples
        
        # Split by Armenian characters to get the part before usage examples
        parts_before_armenian = re.split(r'[\u0530-\u058F\u0531-\u0556]', part, maxsplit=1)
        main_part = parts_before_armenian[0].strip() if parts_before_armenian else ""
        
        if not main_part:
            continue
        
        # Remove parentheses and brackets content (often contain grammar notes)
        main_part = re.sub(r'\([^)]*\)', '', main_part)
        main_part = re.sub(r'\[[^\]]*\]', '', main_part)
        main_part = re.sub(r'\{[^}]*\}', '', main_part)
        main_part = main_part.strip()
        
        if not main_part:
            continue
        
        # Extract Russian/English text from the main part (before usage examples)
        # Find sequences of Cyrillic/Latin characters
        russian_english_text = re.findall(r'[\u0400-\u04FFa-zA-Z][\u0400-\u04FFa-zA-Z\s,\.;:!?\-]*[\u0400-\u04FFa-zA-Z]|[\u0400-\u04FFa-zA-Z]+', main_part)
        
        if not russian_english_text:
            continue
        
        # Join the extracted text
        extracted = ' '.join(russian_english_text).strip()
        
        # Clean up - remove leading/trailing punctuation
        extracted = re.sub(r'^\.+\s*', '', extracted)
        extracted = extracted.rstrip('.,;:!?').strip()
        
        # Skip if too short
        if len(extracted) < 2:
            continue
        
        # Check if it contains valid letters (Cyrillic, Latin)
        if not re.search(r'[\u0400-\u04FFa-zA-Z]', extracted):
            continue
        
        # Filter out usage examples - these are typically complete sentences with verbs
        # Usage examples often contain phrases like "это и есть", "это есть", etc.
        # They're usually longer and contain more complex grammar
        # Check BEFORE lowercasing to catch the patterns
        is_usage_example = False
        
        # Check for common usage example patterns (complete sentences)
        # These patterns indicate usage examples, not translations
        usage_patterns = [
            r'это\s+(и\s+)?есть',  # "это есть", "это и есть" (anywhere in text)
            r'это\s+и\s+есть',  # "это и есть" (more specific)
            r'это\s+есть\s+наш',  # "это есть наш"
            r'это\s+есть\s+его',  # "это есть его"
            r'желание',  # "желание" often appears in usage examples
            r'последний\s+бой',  # "последний бой" is a usage example
        ]
        
        extracted_lower = extracted.lower()
        for pattern in usage_patterns:
            if re.search(pattern, extracted_lower):
                is_usage_example = True
                break
        
        # Also check for very long phrases (likely sentences, not simple translations)
        # Simple translations are usually 1-4 words, usage examples are longer
        word_count = len(extracted.split())
        if word_count > 4:
            is_usage_example = True
        
        # Skip usage examples
        if is_usage_example:
            continue
        
        # Lowercase all translations
        meanings.append(extracted.lower())

    # If no meanings found, try to extract Russian/English text from mixed content
    if not meanings and translation_part.strip():
        # Extract all Russian/English text segments (sequences of Cyrillic/Latin characters)
        # This handles cases where Armenian and Russian/English are mixed
        russian_english_segments = re.findall(r'[\u0400-\u04FFa-zA-Z][\u0400-\u04FFa-zA-Z\s,\.;:!?\-]*[\u0400-\u04FFa-zA-Z]|[\u0400-\u04FFa-zA-Z]+', translation_part)
        
        for segment in russian_english_segments:
            segment = segment.strip()
            # Remove leading periods and spaces
            segment = re.sub(r'^\.+\s*', '', segment)
            # Remove trailing punctuation
            segment = segment.rstrip('.,;:!?').strip()
            
            if len(segment) >= 2 and not re.search(r'[\u0530-\u058F\u0531-\u0556]', segment):
                # Filter out usage examples here too
                is_usage = False
                usage_patterns = [
                    r'это\s+(и\s+)?есть',
                    r'это\s+и\s+есть',
                    r'это\s+есть\s+наш',
                    r'это\s+есть\s+его',
                ]
                for pattern in usage_patterns:
                    if re.search(pattern, segment, re.IGNORECASE):
                        is_usage = True
                        break
                if len(segment.split()) > 5:
                    is_usage = True
                
                if not is_usage:
                    meanings.append(segment.lower())

    # Remove duplicates while preserving order
    seen = set()
    unique_meanings = []
    for meaning in meanings:
        meaning_lower = meaning.lower()
        if meaning_lower not in seen:
            seen.add(meaning_lower)
            unique_meanings.append(meaning)

    return unique_meanings, usage_examples  # Return translations and usage examples


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
                    # Don't filter abbreviations here - StarDict has many uppercase words that are not abbreviations
                    # Abbreviations will be filtered out during merge if they don't have both translations

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
                        clean_words, usage_examples = clean_translation(translation_raw)

                        if clean_words:
                            # Store all words with valid translations
                            # Usage examples are stored separately for CEFR calculation
                            armenian_russian[word] = clean_words
                            # TODO: Store usage_examples for CEFR calculation
                            extracted_count += 1
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
    
    # Statistics
    words_with_pronunciation = 0
    words_without_pronunciation = 0

    print(f"  Extracting text from PDF...")
    pdf_doc = fitz.open(pdf_file)
    total_pages = len(pdf_doc)
    pbar = tqdm(total=total_pages, desc="Parsing PDF dictionary", unit="pages")
    
    # Matching tolerance (pixels) - words on the same row should be within this distance
    Y_TOLERANCE = 8.0
    
    try:
        for page_num in range(total_pages):
            page = pdf_doc[page_num]
            # Extract text using 'dict' mode to get actual span positions
            text_dict = page.get_text('dict')  # type: ignore
            
            # Extract all spans with their actual positions
            armenian_spans = []  # List of (text, y, x)
            pronunciation_spans = []  # List of (text, y, x)
            english_spans = []  # List of (text, y, x)
            
            for block in text_dict.get('blocks', []):  # type: ignore
                if isinstance(block, dict) and 'lines' in block:
                    for line in block.get('lines', []):
                        if isinstance(line, dict) and 'spans' in line:
                            for span in line.get('spans', []):
                                if not isinstance(span, dict):
                                    continue
                                bbox = span.get('bbox', [])
                                if len(bbox) < 4:
                                    continue
                                x0, y0 = float(bbox[0]), float(bbox[1])
                                text = span.get('text', '').strip()
                                if not text:
                                    continue
                                
                                # Categorize by column position
                                if x0 < 200 and re.search(r'[\u0530-\u058F\u0531-\u0556]', text):
                                    # Armenian column - split by newlines to get individual words
                                    words = [w.strip() for w in text.split('\n') if w.strip() and re.search(r'[\u0530-\u058F\u0531-\u0556]', w)]
                                    for word in words:
                                        armenian_spans.append((word, y0, x0))
                                elif 200 <= x0 < 340:
                                    # Pronunciation column
                                    # Split by spaces and newlines to get individual pronunciations
                                    pron_parts = text.replace('\n', ' ').split()
                                    for pron_part in pron_parts:
                                        pron_clean = pron_part.strip()
                                        if pron_clean and len(pron_clean) >= 2:
                                            pron_fixed = fix_ocr_pronunciation(pron_clean)
                                            if not (pron_fixed.isdigit() and len(pron_fixed) > 3):
                                                pronunciation_spans.append((pron_fixed, y0, x0))
                                elif x0 >= 340 and re.search(r'[a-zA-Z]', text):
                                    # English column - keep as is (may contain commas)
                                    english_spans.append((text, y0, x0))
            
            # Match Armenian words with pronunciation and English based on actual y-coordinates
            for arm_word, arm_y, arm_x in armenian_spans:
                # Find closest pronunciation and English within tolerance
                pronunciation = None
                english_text = None
                best_pron_dist = float('inf')
                best_eng_dist = float('inf')
                
                # Find pronunciation on the same row (within Y_TOLERANCE)
                for pron_text, pron_y, pron_x in pronunciation_spans:
                    dist = abs(pron_y - arm_y)
                    if dist < Y_TOLERANCE and dist < best_pron_dist:
                        best_pron_dist = dist
                        pronunciation = pron_text
                
                # Find English on the same row (within Y_TOLERANCE)
                for eng_text, eng_y, eng_x in english_spans:
                    dist = abs(eng_y - arm_y)
                    if dist < Y_TOLERANCE and dist < best_eng_dist:
                        best_eng_dist = dist
                        english_text = eng_text
                
                # Process if we have Armenian and English
                if arm_word and english_text and english_text.strip():
                    # Clean Armenian word (before filtering checks)
                    armenian_word_original = arm_word
                    armenian_word = arm_word.strip('.,;:()[]{}')
                    if not re.search(r'[\u0530-\u058F\u0531-\u0556]', armenian_word):
                        continue
                    # Skip abbreviations
                    if is_abbreviation(armenian_word):
                        continue
                    # Skip section headers (e.g., "Ի-բ", "A-a", etc.)
                    # These are typically very short and contain non-Armenian characters
                    if len(armenian_word) <= 3 and re.search(r'[-–—]', armenian_word):
                        continue
                    # Skip if contains only non-Armenian characters (section markers)
                    if not re.search(r'[ա-ֆ]', armenian_word):  # Must have lowercase Armenian
                        continue
                    # Allow one-letter words
                    if len(armenian_word) < 1:
                        continue
                    # Parse English translations (comma-separated)
                    # English entries from PDF are already clean, just split and store
                    # Also split on newlines and clean them
                    english_text_clean = english_text.replace('\n', ' ').replace('  ', ' ')
                    english_words = [w.strip() for w in english_text_clean.split(',') if w.strip()]
                    if english_words:
                        # Store all English translations (no filtering, no limits)
                        # Remove duplicates only
                        for eng_word in english_words:
                            if eng_word not in armenian_english[armenian_word]['english']:
                                armenian_english[armenian_word]['english'].append(eng_word)
                        # Pronunciation is optional (some may be images in PDF, not text)
                        # Clean and validate pronunciation if found
                        if pronunciation:
                            pronunciation_clean = pronunciation.strip('[]()')
                            if pronunciation_clean and 2 <= len(pronunciation_clean) <= 50:
                                # Store pronunciation (keep * character as it's part of the pronunciation)
                                if not armenian_english[armenian_word]['pronunciation']:
                                    armenian_english[armenian_word]['pronunciation'] = pronunciation_clean
                                    words_with_pronunciation += 1
                        else:
                            # Track words without pronunciation
                            words_without_pronunciation += 1
                
            pbar.update(1)
    finally:
        pbar.close()
        pdf_doc.close()

    # Merge duplicates (case-insensitive) - use lowercase version as key
    merged_result = {}
    duplicates_found = []

    for word, data in armenian_english.items():
        word_lower = word.lower()
        if word_lower in merged_result:
            # Merge with existing entry
            existing_data = merged_result[word_lower]
            # Merge English translations
            for eng in data['english']:
                if eng not in existing_data['english']:
                    existing_data['english'].append(eng)
            # Use pronunciation from either entry (prefer non-empty)
            if not existing_data['pronunciation'] and data['pronunciation']:
                existing_data['pronunciation'] = data['pronunciation']
            # Track duplicate
            if word != existing_data.get('_original_word', word_lower):
                duplicates_found.append((word, existing_data.get('_original_word', word_lower)))
            # Keep track of original word (prefer lowercase version)
            if any(c.islower() for c in word):
                existing_data['_original_word'] = word
        else:
            # New entry
            merged_result[word_lower] = {
                'english': list(data['english']),
                'pronunciation': data['pronunciation'],
                '_original_word': word
            }
    
    # Check for true duplicates (same word, different case is OK, but exact duplicates should fail)
    # Remove _original_word tracking before returning
    result = {}
    for word_lower, data in merged_result.items():
        original_word = data.pop('_original_word', word_lower)
        result[original_word] = {
            'english': data['english'],
            'pronunciation': data['pronunciation']
        }

    if duplicates_found:
        print(f"  ⚠️  Merged {len(duplicates_found)} case-insensitive duplicate(s):")
        for dup_word, original_word in duplicates_found[:5]:
            print(f"    '{dup_word}' merged with '{original_word}'")
        if len(duplicates_found) > 5:
            print(f"    ... and {len(duplicates_found) - 5} more")

    # Save to cache
    if result:
        save_english_dict_to_csv(result, cache_file)
        print(f"  Cached {len(result)} entries to {cache_file}")
    
    # Print statistics
    total_words = words_with_pronunciation + words_without_pronunciation
    if total_words > 0:
        pron_percentage = (words_with_pronunciation / total_words) * 100
        print(f"  Pronunciation statistics:")
        print(f"    Words with pronunciation: {words_with_pronunciation} ({pron_percentage:.1f}%)")
        print(f"    Words without pronunciation: {words_without_pronunciation} ({100 - pron_percentage:.1f}%)")

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
        has_pronunciation = 'spell' in entry and entry['spell']
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
    armenian_english: Dict[str, Dict]
) -> Tuple[List[Dict], Dict[str, Any]]:
    """
    Merge Armenian-Russian and Armenian-English dictionaries.
    Only keeps words with both Russian AND English translations.
    Matches by lowercased Armenian words only.
    Returns (vocabulary list, statistics dict).
    """
    vocabulary = []

    print("\nMerging vocabularies...")

    # Normalize Armenian words to lowercase for matching
    # Create normalized lookup maps
    russian_normalized = {k.lower(): (k, v) for k, v in armenian_russian.items()}
    english_normalized = {k.lower(): (k, v) for k, v in armenian_english.items()}

    # Find common words (case-insensitive matching by lowercase)
    common_words_normalized = set(russian_normalized.keys()) & set(english_normalized.keys())
    print(f"  Found {len(common_words_normalized)} words with both translations")

    # Statistics
    ru_translation_counts = []
    en_translation_counts = []
    words_with_pronunciation = 0
    words_without_pronunciation = 0

    pbar = tqdm(total=len(common_words_normalized), desc="Merging translations", unit="words")
    try:
        for normalized_word in common_words_normalized:
            # Get original words and translations
            armenian_word_ru, russian_translations = russian_normalized[normalized_word]
            armenian_word_en, english_data = english_normalized[normalized_word]

            # Use the original word (prefer the one from Russian dict, or English if it has lowercase)
            # Prefer word with lowercase letters if available
            if any(c.islower() for c in armenian_word_en):
                armenian_word = armenian_word_en
            else:
                armenian_word = armenian_word_ru

            # Get English translations (already clean from PDF parsing)
            english_list = english_data['english']
            if not english_list:
                continue  # Skip if no English translations

            # English translations are already clean, just use them directly
            # Remove duplicates (no limit)
            clean_english = list(dict.fromkeys(english_list))

            # Collect statistics
            ru_translation_counts.append(len(russian_translations))
            en_translation_counts.append(len(clean_english))

            # Create entry with new format (no limits on translations)
            entry = {
                'am': armenian_word,
                'ru': russian_translations,  # All translations, no limit
                'en': clean_english  # All translations, no limit
            }

            # Add pronunciation if available (use "spell" key)
            if english_data['pronunciation']:
                entry['spell'] = english_data['pronunciation']
                words_with_pronunciation += 1
            else:
                words_without_pronunciation += 1

            vocabulary.append(entry)
            pbar.update(1)
    finally:
        pbar.close()

    # Calculate statistics
    stats = {
        'ru': {
            'avg': sum(ru_translation_counts) / len(ru_translation_counts) if ru_translation_counts else 0,
            'max': max(ru_translation_counts) if ru_translation_counts else 0,
            'min': min(ru_translation_counts) if ru_translation_counts else 0,
        },
        'en': {
            'avg': sum(en_translation_counts) / len(en_translation_counts) if en_translation_counts else 0,
            'max': max(en_translation_counts) if en_translation_counts else 0,
            'min': min(en_translation_counts) if en_translation_counts else 0,
        },
        'pronunciation': {
            'with': words_with_pronunciation,
            'without': words_without_pronunciation,
            'total': len(vocabulary)
        }
    }

    return vocabulary, stats


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
    vocabulary, stats = merge_vocabularies(armenian_russian, armenian_english)
    print(f"  Merged {len(vocabulary):,} vocabulary entries")
    print(f"\n  Translation statistics:")
    print(f"    Russian: avg={stats['ru']['avg']:.2f}, min={stats['ru']['min']}, max={stats['ru']['max']}")
    print(f"    English: avg={stats['en']['avg']:.2f}, min={stats['en']['min']}, max={stats['en']['max']}")
    print(f"    Pronunciation: {stats['pronunciation']['with']} with, {stats['pronunciation']['without']} without")

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
