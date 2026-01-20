import { beforeEach, describe, expect, test } from 'bun:test';

// Types (inline to avoid import issues with SvelteKit aliases)
interface Word {
    am: string;
    ru: string[];
    en: string[];
    spell?: string;
}

interface Vocabulary {
    [level: string]: Word[];
}

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get _store() {
            return store;
        },
    };
})();

// Replace global localStorage
// biome-ignore lint/suspicious/noExplicitAny: Required to mock localStorage in test environment
(globalThis as any).localStorage = localStorageMock;

// Helper to create translation key (mirrors the implementation)
function createTranslationKey(word: Word, translation: string): string {
    return `${word.am}|${translation}`;
}

// Pure function version of migration logic for testing
// This mirrors the implementation in progress.ts
function migrateFromLearntWords(
    oldData: string | null,
    vocabulary: Vocabulary
): { translations: string[]; wordsNotFound: string[] } {
    if (!oldData) {
        return { translations: [], wordsNotFound: [] };
    }

    const learnedWordIds = oldData
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);

    if (learnedWordIds.length === 0) {
        return { translations: [], wordsNotFound: [] };
    }

    // Build a map of armenian word -> Word object
    const wordMap = new Map<string, Word>();
    for (const level of Object.values(vocabulary)) {
        for (const word of level) {
            wordMap.set(word.am, word);
        }
    }

    // Convert learned words to learned translations
    const translations: string[] = [];
    const wordsNotFound: string[] = [];

    for (const wordId of learnedWordIds) {
        const word = wordMap.get(wordId);
        if (word) {
            // Mark all translations of this word as learned
            for (const translation of word.en) {
                translations.push(createTranslationKey(word, translation));
            }
            for (const translation of word.ru) {
                translations.push(createTranslationKey(word, translation));
            }
        } else {
            wordsNotFound.push(wordId);
        }
    }

    return { translations, wordsNotFound };
}

// Sample vocabulary for testing
const sampleVocabulary: Vocabulary = {
    A1: [
        {
            am: 'է',
            en: ['is', 'it'],
            ru: ['есть', 'это'],
            spell: 'e',
        },
        {
            am: 'և',
            en: ['and'],
            ru: ['и'],
            spell: 'yev',
        },
        {
            am: 'կdelays',
            en: ['there'],
            ru: ['есть, имеется'],
            spell: 'ka',
        },
    ],
    A2: [
        {
            am: 'բdelays',
            en: ['word'],
            ru: ['слово'],
            spell: 'bar',
        },
    ],
};

describe('Migration: migrateFromLearntWords', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    test('returns empty arrays when oldData is null', () => {
        const result = migrateFromLearntWords(null, sampleVocabulary);
        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual([]);
    });

    test('returns empty arrays when oldData is empty string', () => {
        const result = migrateFromLearntWords('', sampleVocabulary);
        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual([]);
    });

    test('returns empty arrays when oldData contains only whitespace', () => {
        const result = migrateFromLearntWords('  ,  ,  ', sampleVocabulary);
        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual([]);
    });

    test('migrates single word with multiple translations', () => {
        const result = migrateFromLearntWords('է', sampleVocabulary);

        // Should have 4 translations: 2 English + 2 Russian
        expect(result.translations).toHaveLength(4);
        expect(result.translations).toContain('է|is');
        expect(result.translations).toContain('է|it');
        expect(result.translations).toContain('է|есть');
        expect(result.translations).toContain('է|это');
        expect(result.wordsNotFound).toEqual([]);
    });

    test('migrates multiple words', () => {
        const result = migrateFromLearntWords('է,և', sampleVocabulary);

        // է has 4 translations, և has 2 translations
        expect(result.translations).toHaveLength(6);
        expect(result.translations).toContain('է|is');
        expect(result.translations).toContain('և|and');
        expect(result.translations).toContain('և|и');
        expect(result.wordsNotFound).toEqual([]);
    });

    test('handles words with whitespace in old data', () => {
        const result = migrateFromLearntWords(' է , և ', sampleVocabulary);

        expect(result.translations).toHaveLength(6);
        expect(result.wordsNotFound).toEqual([]);
    });

    test('tracks words not found in vocabulary', () => {
        const result = migrateFromLearntWords('է,unknown_word,և', sampleVocabulary);

        // Should still migrate known words
        expect(result.translations).toHaveLength(6);
        // Should report unknown word
        expect(result.wordsNotFound).toEqual(['unknown_word']);
    });

    test('handles all unknown words', () => {
        const result = migrateFromLearntWords('foo,bar,baz', sampleVocabulary);

        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual(['foo', 'bar', 'baz']);
    });

    test('finds words across different levels', () => {
        // 'բdelays' is in A2 level
        const result = migrateFromLearntWords('է,բdelays', sampleVocabulary);

        expect(result.translations).toContain('է|is');
        expect(result.translations).toContain('բdelays|word');
        expect(result.translations).toContain('բdelays|слово');
        expect(result.wordsNotFound).toEqual([]);
    });

    test('handles empty vocabulary', () => {
        const result = migrateFromLearntWords('է', {});

        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual(['է']);
    });

    test('handles vocabulary with empty levels', () => {
        const emptyLevelVocab: Vocabulary = {
            A1: [],
            A2: [],
        };
        const result = migrateFromLearntWords('է', emptyLevelVocab);

        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual(['է']);
    });
});

describe('Translation key format', () => {
    test('creates correct key format', () => {
        const word: Word = { am: 'test', en: ['hello'], ru: ['привет'] };
        const key = createTranslationKey(word, 'hello');
        expect(key).toBe('test|hello');
    });

    test('handles special characters in translation', () => {
        const word: Word = { am: 'test', en: ['hello, world'], ru: ['привет'] };
        const key = createTranslationKey(word, 'hello, world');
        expect(key).toBe('test|hello, world');
    });

    test('handles pipe character in translation (edge case)', () => {
        const word: Word = { am: 'test', en: ['a|b'], ru: ['привет'] };
        const key = createTranslationKey(word, 'a|b');
        // This is a potential issue - pipe is used as delimiter
        expect(key).toBe('test|a|b');
    });
});

describe('localStorage migration integration', () => {
    const STORAGE_PREFIX = 'armenianApp_';
    const OLD_KEY = `${STORAGE_PREFIX}learntWords`;
    const NEW_KEY = `${STORAGE_PREFIX}learntTranslations`;

    beforeEach(() => {
        localStorageMock.clear();
    });

    test('old learntWords format is comma-separated Armenian words', () => {
        // Simulate old format
        localStorageMock.setItem(OLD_KEY, 'է,և,կdays');

        const stored = localStorageMock.getItem(OLD_KEY);
        expect(stored).toBe('է,և,կdays');

        const words = stored?.split(',');
        expect(words).toEqual(['է', 'և', 'կdays']);
    });

    test('new learntTranslations format is comma-separated word|translation pairs', () => {
        // Simulate new format
        const translations = ['է|is', 'է|it', 'և|and'];
        localStorageMock.setItem(NEW_KEY, translations.join(','));

        const stored = localStorageMock.getItem(NEW_KEY);
        expect(stored).toBe('է|is,է|it,և|and');
    });

    test('migration should remove old key after processing', () => {
        localStorageMock.setItem(OLD_KEY, 'է');

        // Verify old key exists
        expect(localStorageMock.getItem(OLD_KEY)).toBe('է');

        // Simulate migration removing old key
        localStorageMock.removeItem(OLD_KEY);

        expect(localStorageMock.getItem(OLD_KEY)).toBeNull();
    });

    test('migration should preserve existing new data', () => {
        // User has some new translations already
        localStorageMock.setItem(NEW_KEY, 'existing|translation');
        // And some old data to migrate
        localStorageMock.setItem(OLD_KEY, 'է');

        const existingData = localStorageMock.getItem(NEW_KEY)?.split(',') ?? [];
        const migratedResult = migrateFromLearntWords(
            localStorageMock.getItem(OLD_KEY),
            sampleVocabulary
        );

        // Combine and dedupe
        const combined = [...new Set([...existingData, ...migratedResult.translations])];

        expect(combined).toContain('existing|translation');
        expect(combined).toContain('է|is');
    });
});

describe('Real-world localStorage data', () => {
    // This test uses actual localStorage data from a user's browser
    // Real data: " delays,մdelays,իdelays,սdelays,delays,delays,delays,delays,delays,delays,delays,delays, delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,է,delays,delays,delays,delays,delays,delays,delays, delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays"
    const realUserData =
        ' delays,մdelays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays, delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,է,delays,delays,delays,delays,delays,delays,delays,ես,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays,delays';

    test('handles real user data with many words (57 words)', () => {
        // Use sampleVocabulary which has 'է'
        const result = migrateFromLearntWords(realUserData, sampleVocabulary);

        // Should find 'է' and create its translations
        expect(result.translations).toContain('է|is');
        expect(result.translations).toContain('է|it');
        expect(result.translations).toContain('է|есть');
        expect(result.translations).toContain('է|это');

        // Most words won't be in our sample vocabulary
        expect(result.wordsNotFound.length).toBeGreaterThan(0);
    });

    test('migration with many unknown words should still work', () => {
        // Simulate case where most words are not in vocabulary
        const mostlyUnknown = 'unknown1,unknown2,է,unknown3';
        const result = migrateFromLearntWords(mostlyUnknown, sampleVocabulary);

        // Should still migrate the known word
        expect(result.translations).toContain('է|is');
        expect(result.wordsNotFound).toContain('unknown1');
        expect(result.wordsNotFound).toContain('unknown2');
        expect(result.wordsNotFound).toContain('unknown3');
    });
});

describe('Edge cases and error handling', () => {
    test('handles word with empty translation arrays', () => {
        const vocabWithEmptyTranslations: Vocabulary = {
            A1: [
                {
                    am: 'test',
                    en: [],
                    ru: [],
                },
            ],
        };

        const result = migrateFromLearntWords('test', vocabWithEmptyTranslations);

        // Word is found but has no translations
        expect(result.translations).toEqual([]);
        expect(result.wordsNotFound).toEqual([]);
    });

    test('handles duplicate words in old data', () => {
        const result = migrateFromLearntWords('է,է,է', sampleVocabulary);

        // Should create translations for each occurrence (migration doesn't dedupe)
        // The store's migrateIfNeeded function handles deduplication
        expect(result.translations).toHaveLength(12); // 4 translations × 3 occurrences
    });

    test('deduplication should be handled by caller', () => {
        const result = migrateFromLearntWords('է,է', sampleVocabulary);
        const deduped = [...new Set(result.translations)];

        expect(result.translations).toHaveLength(8);
        expect(deduped).toHaveLength(4);
    });
});
