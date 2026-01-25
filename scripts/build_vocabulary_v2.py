"""
Build vocabulary.json from kaikki.org dictionary (V2):
1. Load existing English translations from vocabulary.json
2. Load Russian translations from StarDict (reuse functions from build_vocabulary.py)
3. Parse kaikki.org dictionary once and cache results
4. Calculate CEFR levels based on word frequency in examples, compound words, suffixes, and pronunciation
5. Build vocabulary with additional fields: pos, etymology_text, ogg_url
"""

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple
from tqdm import tqdm

# Import functions from build_vocabulary.py
import sys
sys.path.insert(0, str(Path(__file__).parent))
from build_vocabulary import (
    parse_stardict_ifo,
    parse_stardict_idx,
    parse_stardict_dict,
    load_from_csv,
    save_to_csv,
)

# Configuration
KAIKKI_FILE = Path("vocabulary_sources/kaikki.org-dictionary-Armenian-words.jsonl")
STARDICT_DIR = Path("vocabulary_sources/ArmRus_1.28")
STARDICT_CACHE = Path("scripts/tmp/armenian_russian.csv")
KAIKKI_CACHE = Path("scripts/tmp/kaikki_entries.json")
OUTPUT_FILE = Path("static/vocabulary.json")
TMP_DIR = Path("scripts/tmp")
TMP_DIR.mkdir(parents=True, exist_ok=True)


def normalize_armenian_word(word: str) -> str:
    """Normalize Armenian word for comparison (lowercase)."""
    return word.lower()


def is_direct_translation(text: str, language: str = 'en') -> bool:
    """
    Check if text is a direct translation (short, simple) vs dictionary definition/explanation.
    Filters out slang, figurative, long explanations, etc.
    """
    text_lower = text.lower().strip()
    
    # Skip if too long (more than 4 words is usually an explanation)
    word_count = len(text_lower.split())
    if word_count > 4:
        return False
    
    # Skip dictionary-style definitions (English)
    if language == 'en':
        definition_patterns = [
            r'^the\s+\d+',  # "The 7th letter"
            r'^\d+\s+in\s+the\s+system',  # "7 in the system"
            r'^\d+[a-z]{2}\s+letter',  # "7th letter"
            r'form\s+of',  # "form of X"
            r'present\s+of',  # "present of X"
            r'singular\s+of',  # "singular of X"
            r'plural\s+of',  # "plural of X"
            r'genitive\s+of',  # "genitive of X"
            r'called\s+',  # "called X"
            r'transliterated\s+as',  # "transliterated as"
            r'represents',  # "represents"
            r'^a\s+[a-z]+\s+given\s+name',  # "a female given name"
            r'^an\s+',  # "an X"
            r"'s\s+",  # Possessive relationships like "father's grandfather"
            r'\s+of\s+[a-z]+\s+[a-z]+',  # Complex relationships
        ]
        
        for pattern in definition_patterns:
            if re.search(pattern, text_lower):
                return False
        
        # Skip unclear translations with possessive/genitive relationships
        if "'s" in text_lower or re.search(r'\s+with\s+[a-z]+\s+[a-z]+', text_lower):
            return False
    
    return True


def parse_kaikki_and_collect_frequency(
    jsonl_path: Path,
    cache_file: Path,
    use_cache: bool = True
) -> Tuple[List[Dict], Dict[str, int], Dict[str, List[str]]]:
    """Parse kaikki.org file once and collect word frequency from examples, extract English translations."""
    # Check if cache exists and use_cache=True: load from cache (skip parsing)
    if use_cache and cache_file.exists():
        print(f"Loading kaikki.org data from cache: {cache_file}")
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                parsed_entries = cache_data.get('entries', [])
                frequency_dict = cache_data.get('frequency', {})
                english_index = cache_data.get('english', {})
                print(f"  Loaded {len(parsed_entries)} entries, frequency data for {len(frequency_dict)} words, English for {len(english_index)} words")
                return parsed_entries, frequency_dict, english_index
        except (json.JSONDecodeError, KeyError) as e:
            print(f"⚠️  Error loading cache: {e}. Will re-parse.")
    
    # If cache not found or use_cache=False: parse all entries
    if not jsonl_path.exists():
        print(f"⚠️  Kaikki dictionary not found at {jsonl_path}")
        return [], {}, {}
    
    print(f"Parsing kaikki.org dictionary from {jsonl_path}...")
    parsed_entries: List[Dict] = []
    all_example_texts: List[str] = []
    english_index: Dict[str, List[str]] = {}
    
    # Count lines first for progress bar
    total_lines = sum(1 for _ in open(jsonl_path, 'r', encoding='utf-8'))
    
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        pbar = tqdm(total=total_lines, desc="Parsing kaikki dictionary", unit="lines")
        try:
            for line in f:
                try:
                    data = json.loads(line.strip())
                    if not data:
                        continue
                    
                    word = data.get('word', '').strip()
                    if not word:
                        continue
                    
                    # Extract English translations from senses (filter out slang/figurative/archaic/poetic)
                    english_translations = []
                    senses = data.get('senses', [])
                    for sense in senses:
                        # Skip senses with unwanted tags
                        tags = sense.get('tags', [])
                        if any(tag in tags for tag in ['slang', 'figuratively', 'archaic', 'poetic']):
                            continue
                        
                        glosses = sense.get('glosses', [])
                        for gloss in glosses:
                            # Extract main translation from gloss (may contain extra info in parentheses)
                            gloss_clean = gloss.split('(')[0].strip()
                            
                            # Further clean: remove trailing explanations after comma if too long
                            if ',' in gloss_clean and len(gloss_clean.split(',')) > 1:
                                # Check each part
                                parts = [p.strip() for p in gloss_clean.split(',')]
                                for part in parts:
                                    if part and is_direct_translation(part, language='en'):
                                        if part.lower() not in [t.lower() for t in english_translations]:
                                            english_translations.append(part)
                            elif gloss_clean:
                                # Check if it's a direct translation (not a definition)
                                if is_direct_translation(gloss_clean, language='en'):
                                    if gloss_clean.lower() not in [t.lower() for t in english_translations]:
                                        english_translations.append(gloss_clean)
                    
                    # Extract only the romanization form (spell)
                    spell = None
                    for form_entry in data.get('forms', []):
                        if 'romanization' in form_entry.get('tags', []):
                            spell = form_entry.get('form', '').strip()
                            if spell:
                                break
                    
                    # Extract ogg_url from first sounds entry that has it
                    ogg_url = None
                    for sound in data.get('sounds', []):
                        if 'ogg_url' in sound:
                            ogg_url = sound.get('ogg_url', '').strip()
                            if ogg_url:
                                break
                    
                    # Store only fields we need (simplified entry)
                    simplified_entry = {
                        'word': word,
                        'spell': spell,
                        'pos': data.get('pos', ''),
                        'etymology_text': data.get('etymology_text', ''),
                        'ogg_url': ogg_url
                    }
                    parsed_entries.append(simplified_entry)
                    
                    # Store English translations
                    if english_translations:
                        normalized = normalize_armenian_word(word)
                        english_index[normalized] = english_translations
                    
                    # Collect all example texts
                    for sense in senses:
                        for ex in sense.get('examples', []):
                            text = ex.get('text', '')
                            if text:
                                all_example_texts.append(text)
                
                except json.JSONDecodeError:
                    continue
                except Exception:
                    continue
                
                pbar.update(1)
        finally:
            pbar.close()
    
    print(f"  Parsed {len(parsed_entries)} entries")
    print(f"  Extracted English translations for {len(english_index)} words")
    print(f"  Collected {len(all_example_texts)} example texts")
    
    # Count word frequency in examples
    print("Counting word frequency in examples...")
    frequency_dict: Dict[str, int] = {}
    
    # Extract Armenian words from example texts using regex
    armenian_pattern = re.compile(r'[\u0530-\u058F\u0531-\u0556]+')
    
    for example_text in tqdm(all_example_texts, desc="Processing examples", unit="examples"):
        # Find all Armenian words in the example text
        words = armenian_pattern.findall(example_text)
        for word in words:
            normalized = normalize_armenian_word(word)
            frequency_dict[normalized] = frequency_dict.get(normalized, 0) + 1
    
    print(f"  Found {len(frequency_dict)} unique words in examples")
    
    # Save cache (only if cache didn't exist)
    if not (use_cache and cache_file.exists()):
        print(f"Saving cache to {cache_file}...")
        cache_data = {
            'entries': parsed_entries,
            'frequency': frequency_dict,
            'english': english_index
        }
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        print(f"  Cached {len(parsed_entries)} entries, frequency data, and English translations")
    
    return parsed_entries, frequency_dict, english_index


def extract_word_data(
    kaikki_entry: Dict,
    english_translations: List[str],
    stardict_ru: List[str]
) -> Dict[str, Any]:
    """Extract all fields for a vocabulary entry."""
    word = kaikki_entry.get('word', '').strip()
    if not word:
        return {}
    
    # Extract fields from simplified cache entry
    spell = kaikki_entry.get('spell')
    pos = kaikki_entry.get('pos', '')
    etymology_text = kaikki_entry.get('etymology_text', '')
    ogg_url = kaikki_entry.get('ogg_url')
    
    # Build entry
    entry = {
        'am': word,
        'en': english_translations.copy() if english_translations else [],
        'ru': stardict_ru.copy() if stardict_ru else [],
    }
    
    if spell:
        entry['spell'] = spell
    
    if pos:
        entry['pos'] = pos
    
    if etymology_text:
        entry['etymology_text'] = etymology_text
    
    if ogg_url:
        entry['ogg_url'] = ogg_url
    
    return entry


def calculate_word_complexity(
    word: str,
    etymology_text: str,
    has_pronunciation: bool,
    has_ogg_url: bool,
    frequency_in_examples: int
) -> float:
    """Calculate complexity score (lower = simpler)."""
    score = 0.0
    
    # Length factor (shorter = simpler)
    score += len(word) * 0.1
    
    # Abstract suffixes increase complexity
    abstract_suffixes = ['ություն', 'ական', 'ային', 'ավոր', 'ականություն']
    for suffix in abstract_suffixes:
        if word.endswith(suffix):
            score += 2.0
            break
    
    # Compound words are more complex (etymology_text contains "+")
    if '+' in etymology_text:
        score += 1.5
    
    # Having pronunciation available suggests it's a common word
    if has_pronunciation:
        score -= 0.5
    
    # Having audio (ogg_url) available suggests it's a common word (most common words have dictation)
    if has_ogg_url:
        score -= 0.5
    
    # Frequency in examples (more frequent = simpler = lower score)
    # Normalize frequency (log scale to handle wide range)
    if frequency_in_examples > 0:
        frequency_score = -math.log10(frequency_in_examples + 1) * 2.0
        score += frequency_score
    else:
        # No examples = less common = more complex
        score += 3.0
    
    return score


def assign_levels(vocabulary: List[Dict], max_per_level: int = 5000) -> Dict[str, List[Dict]]:
    """Assign CEFR levels based on complexity (reuse logic from build_vocabulary.py)."""
    # Sort by complexity
    vocabulary_with_scores = []
    for entry in vocabulary:
        word = entry.get('am', '')
        etymology_text = entry.get('etymology_text', '')
        has_pronunciation = 'spell' in entry and entry['spell']
        has_ogg_url = 'ogg_url' in entry and entry['ogg_url']
        frequency = entry.get('_frequency', 0)
        
        complexity = calculate_word_complexity(
            word,
            etymology_text,
            has_pronunciation,
            has_ogg_url,
            frequency
        )
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
        # Remove temporary frequency field before saving
        if '_frequency' in entry:
            del entry['_frequency']
        
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


def main():
    parser = argparse.ArgumentParser(description='Build vocabulary from kaikki.org dictionary (V2)')
    parser.add_argument('--no-cache-russian', action='store_true',
                        help='Skip loading Russian translations from cache')
    parser.add_argument('--no-cache-kaikki', action='store_true',
                        help='Skip loading kaikki.org data from cache')
    parser.add_argument('--output', type=str, default=str(OUTPUT_FILE),
                        help=f'Output file for vocabulary (default: {OUTPUT_FILE})')
    args = parser.parse_args()
    
    print("=" * 60)
    print("Build Vocabulary V2 - From kaikki.org Dictionary")
    print("=" * 60)
    
    # Load StarDict Russian translations
    print("\n[1/4] Loading StarDict Russian translations...")
    ifo_path = STARDICT_DIR / "ArmRus_1.28.ifo"
    idx_path = STARDICT_DIR / "ArmRus_1.28.idx"
    dict_path = STARDICT_DIR / "ArmRus_1.28.dict.dz"
    
    stardict_index: Dict[str, List[str]] = {}
    
    if all(p.exists() for p in [ifo_path, idx_path, dict_path]):
        # Try to load from cache first
        if not args.no_cache_russian and STARDICT_CACHE.exists():
            print(f"Loading StarDict from cache: {STARDICT_CACHE}")
            armenian_russian = load_from_csv(STARDICT_CACHE)
            # Normalize keys for indexing
            for word, translations in armenian_russian.items():
                normalized_word = normalize_armenian_word(word)
                stardict_index[normalized_word] = translations
            print(f"  Loaded {len(stardict_index)} words from cache")
        else:
            print(f"Loading StarDict from {STARDICT_DIR}...")
            metadata = parse_stardict_ifo(ifo_path)
            wordcount = int(metadata.get('wordcount', 0))
            print(f"  Found {wordcount:,} words in StarDict")
            
            entries = parse_stardict_idx(idx_path)
            print(f"  Parsed {len(entries):,} index entries")
            
            armenian_russian = parse_stardict_dict(dict_path, entries, STARDICT_CACHE, use_cache=not args.no_cache_russian)
            print(f"  Extracted {len(armenian_russian):,} Russian translations")
            
            # Normalize keys for indexing
            for word, translations in armenian_russian.items():
                normalized_word = normalize_armenian_word(word)
                stardict_index[normalized_word] = translations
    else:
        print(f"⚠️  StarDict files not found at {STARDICT_DIR}")
    
    # Parse kaikki.org and collect frequency, extract English translations
    print("\n[2/4] Parsing kaikki.org dictionary...")
    parsed_entries, frequency_dict, english_index = parse_kaikki_and_collect_frequency(
        KAIKKI_FILE,
        KAIKKI_CACHE,
        use_cache=not args.no_cache_kaikki
    )
    
    if not parsed_entries:
        print("❌ Error: No entries parsed from kaikki.org. Cannot build vocabulary.")
        return
    
    # Build vocabulary entries
    print("\n[3/4] Building vocabulary entries...")
    vocabulary: List[Dict] = []
    skipped_no_translations = 0
    
    pbar = tqdm(total=len(parsed_entries), desc="Building entries", unit="entries")
    try:
        for entry in parsed_entries:
            word = entry.get('word', '').strip()
            if not word:
                pbar.update(1)
                continue
            
            normalized = normalize_armenian_word(word)
            
            # Get English translations from kaikki.org
            english_translations = english_index.get(normalized, [])
            
            # Get Russian translations from StarDict
            stardict_ru = stardict_index.get(normalized, [])
            
            # Skip if missing either English or Russian translations
            if not english_translations or not stardict_ru:
                skipped_no_translations += 1
                pbar.update(1)
                continue
            
            # Extract all fields
            vocab_entry = extract_word_data(entry, english_translations, stardict_ru)
            
            if not vocab_entry:
                skipped_no_translations += 1
                pbar.update(1)
                continue
            
            # Add frequency for complexity calculation
            vocab_entry['_frequency'] = frequency_dict.get(normalized, 0)
            
            vocabulary.append(vocab_entry)
            pbar.update(1)
    finally:
        pbar.close()
    
    print(f"  Built {len(vocabulary)} vocabulary entries")
    if skipped_no_translations > 0:
        print(f"  Skipped {skipped_no_translations} entries without both English and Russian translations")
    
    # Deduplicate entries by Armenian word (keep first occurrence)
    print("\nDeduplicating entries...")
    seen_words: Dict[str, bool] = {}
    deduplicated_vocabulary: List[Dict] = []
    duplicates_removed = 0
    
    for entry in vocabulary:
        word = entry.get('am', '').strip()
        if not word:
            continue
        
        normalized = normalize_armenian_word(word)
        if normalized in seen_words:
            duplicates_removed += 1
            continue
        
        seen_words[normalized] = True
        deduplicated_vocabulary.append(entry)
    
    print(f"  Removed {duplicates_removed} duplicate entries")
    print(f"  Final vocabulary: {len(deduplicated_vocabulary)} unique words")
    vocabulary = deduplicated_vocabulary
    
    # Assign CEFR levels
    print("\n[4/4] Assigning CEFR levels...")
    leveled_vocabulary = assign_levels(vocabulary, max_per_level=5000)
    
    for level, words in leveled_vocabulary.items():
        print(f"  {level}: {len(words):,} words")
    
    # Save to JSON
    output_path = Path(args.output)
    print(f"\n💾 Saving to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(leveled_vocabulary, f, ensure_ascii=False, indent=1)
    
    total_words = sum(len(words) for words in leveled_vocabulary.values())
    print(f"\n✅ Done! Created vocabulary with {total_words:,} words across 4 levels.")
    print(f"   Output file: {output_path.absolute()}")


if __name__ == "__main__":
    main()
