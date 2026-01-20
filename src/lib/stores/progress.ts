import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { QuizLanguage, QuizQuestion, UserStats, Word } from '$lib/types.js';

const STORAGE_PREFIX = 'armenianApp_';

// User stats store
function createUserStatsStore() {
    const key = 'armenianLearningStats';
    const stored = browser ? localStorage.getItem(key) : null;
    let data: UserStats = {};
    if (stored) {
        try {
            data = JSON.parse(stored) as UserStats;
        } catch {
            // Invalid JSON in localStorage, use empty stats and clear the invalid data
            console.warn(`Invalid JSON in localStorage for key "${key}", resetting to default`);
            if (browser) {
                localStorage.removeItem(key);
            }
        }
    }
    const store = writable<UserStats>(data);

    if (browser) {
        store.subscribe((value) => {
            localStorage.setItem(key, JSON.stringify(value));
        });
    }

    return {
        subscribe: store.subscribe,
        update: (level: string, score: number, total: number) => {
            store.update((stats) => {
                if (!stats[level]) {
                    stats[level] = { totalQuizzes: 0, totalCorrect: 0, totalQuestions: 0 };
                }
                stats[level].totalQuizzes++;
                stats[level].totalCorrect += score;
                stats[level].totalQuestions += total;
                return stats;
            });
        },
        reset: () => {
            store.set({});
            if (browser) {
                localStorage.removeItem(key);
            }
        },
    };
}

/**
 * Creates a unique key for a translation.
 * Format: "armenianWord|translation" (e.g., "է|is")
 */
function createTranslationKey(word: Word, translation: string): string {
    return `${word.am}|${translation}`;
}

/**
 * Migrates old learntWords (word-based) to learntTranslations (translation-based).
 * For each learned word, marks only the translations for the specified language as learned.
 */
function migrateFromLearntWords(
    vocabulary: Record<string, Word[]>,
    language: QuizLanguage
): string[] {
    const oldKey = `${STORAGE_PREFIX}learntWords`;
    const stored = browser ? localStorage.getItem(oldKey) : null;

    if (!stored) {
        return [];
    }

    const learnedWordIds = stored
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);

    if (learnedWordIds.length === 0) {
        return [];
    }

    // Build a map of armenian word -> Word object
    const wordMap = new Map<string, Word>();
    for (const level of Object.values(vocabulary)) {
        for (const word of level) {
            wordMap.set(word.am, word);
        }
    }

    // Convert learned words to learned translations (only for selected language)
    const learntTranslations: string[] = [];
    for (const wordId of learnedWordIds) {
        const word = wordMap.get(wordId);
        if (word) {
            const translations = language === 'english' ? word.en : word.ru;
            for (const translation of translations) {
                learntTranslations.push(createTranslationKey(word, translation));
            }
        }
    }

    // Remove old key after migration
    if (browser) {
        localStorage.removeItem(oldKey);
    }

    return learntTranslations;
}

// Learnt translations store - tracks individual translations that have been learned
function createLearntTranslationsStore() {
    const key = `${STORAGE_PREFIX}learntTranslations`;
    const stored = browser ? localStorage.getItem(key) : null;
    const data = stored
        ? stored
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean)
        : [];
    const store = writable<string[]>(data);

    if (browser) {
        store.subscribe((value) => {
            localStorage.setItem(key, value.join(','));
        });
    }

    return {
        subscribe: store.subscribe,
        /**
         * Marks a specific translation as learned.
         */
        markAsLearnt: (question: QuizQuestion) => {
            const translationKey = createTranslationKey(question.word, question.translation);
            store.update((translations) => {
                if (!translations.includes(translationKey)) {
                    return [...translations, translationKey];
                }
                return translations;
            });
        },
        /**
         * Checks if a specific translation has been learned.
         */
        isLearnt: (word: Word, translation: string): boolean => {
            const translationKey = createTranslationKey(word, translation);
            return get(store).includes(translationKey);
        },
        /**
         * Checks if all translations for a word in the given language have been learned.
         */
        isWordFullyLearnt: (word: Word, language: QuizLanguage): boolean => {
            const translations = language === 'english' ? word.en : word.ru;
            const currentStore = get(store);
            return translations.every((translation) => {
                const key = createTranslationKey(word, translation);
                return currentStore.includes(key);
            });
        },
        /**
         * Runs migration from old learntWords format if needed.
         * Should be called once when vocabulary is loaded.
         * Only migrates translations for the specified language.
         */
        migrateIfNeeded: (vocabulary: Record<string, Word[]>, language: QuizLanguage) => {
            const oldKey = `${STORAGE_PREFIX}learntWords`;
            const hasOldData = browser && localStorage.getItem(oldKey);

            if (hasOldData) {
                const migratedTranslations = migrateFromLearntWords(vocabulary, language);
                if (migratedTranslations.length > 0) {
                    store.update((existing) => {
                        const combined = [...existing, ...migratedTranslations];
                        // Remove duplicates
                        return [...new Set(combined)];
                    });
                }
            }
        },
        reset: () => {
            store.set([]);
            if (browser) {
                localStorage.removeItem(key);
            }
        },
    };
}

/** @deprecated Use learntTranslations instead */
function createLearntWordsStore() {
    const key = `${STORAGE_PREFIX}learntWords`;
    const stored = browser ? localStorage.getItem(key) : null;
    const data = stored
        ? stored
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean)
        : [];
    const store = writable<string[]>(data);

    if (browser) {
        store.subscribe((value) => {
            localStorage.setItem(key, value.join(','));
        });
    }

    return {
        subscribe: store.subscribe,
        markAsLearnt: (word: Word) => {
            store.update((words) => {
                if (!words.includes(word.am)) {
                    return [...words, word.am];
                }
                return words;
            });
        },
        isLearnt: (word: Word): boolean => {
            return get(store).includes(word.am);
        },
        reset: () => {
            store.set([]);
            if (browser) {
                localStorage.removeItem(key);
            }
        },
    };
}

export const userStats = createUserStatsStore();
export const learntTranslations = createLearntTranslationsStore();
/** @deprecated Use learntTranslations instead */
export const learntWords = createLearntWordsStore();
