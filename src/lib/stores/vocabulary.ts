import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { parseSearchIndex, type SearchIndex, searchIndex } from '$lib/search.js';
import type { Vocabulary, Word } from '$lib/types.js';
import { learntTranslations } from './progress.js';
import { quizLanguage } from './settings.js';

// Search index store (separate from vocabulary for cleaner separation)
const searchIndexStore = writable<SearchIndex | null>(null);

// Flattened words array for index lookups
const flatWordsStore = writable<Word[]>([]);

function createVocabularyStore() {
    const store = writable<Vocabulary | null>(null);
    let loading = false;

    return {
        subscribe: store.subscribe,
        load: async () => {
            if (loading || !browser) return;
            loading = true;

            try {
                // Load vocabulary and search index in parallel
                const [vocabResponse, indexResponse] = await Promise.all([
                    fetch(`${base}/vocabulary.json`),
                    fetch(`${base}/search-index.bin`),
                ]);

                if (!vocabResponse.ok) {
                    throw new Error(
                        `Failed to load vocabulary: ${vocabResponse.status} ${vocabResponse.statusText}`
                    );
                }

                const data = (await vocabResponse.json()) as Vocabulary;
                store.set(data);

                // Flatten vocabulary for index lookups (same order as build script)
                const flatWords: Word[] = [];
                const levels = Object.keys(data).sort();
                for (const level of levels) {
                    flatWords.push(...data[level]);
                }
                flatWordsStore.set(flatWords);

                // Load search index if available
                if (indexResponse.ok) {
                    try {
                        const buffer = await indexResponse.arrayBuffer();
                        const index = parseSearchIndex(buffer);
                        searchIndexStore.set(index);
                    } catch (indexError) {
                        console.warn('Failed to parse search index:', indexError);
                    }
                } else {
                    console.warn('Search index not available, falling back to linear search');
                }

                // Run migration from old learntWords format if needed
                // Uses the currently selected language setting
                // Run migration asynchronously after a microtask to avoid blocking
                queueMicrotask(() => {
                    try {
                        const currentLanguage = get(quizLanguage);
                        learntTranslations.migrateIfNeeded(data, currentLanguage);
                    } catch (migrationError) {
                        // Don't fail vocabulary loading if migration fails
                        console.error('Error during migration:', migrationError);
                    }
                });
            } catch (error) {
                console.error('Error loading vocabulary:', error);
                throw error;
            } finally {
                loading = false;
            }
        },
    };
}

export const vocabulary = createVocabularyStore();

export function getWordsByLevel(vocab: Vocabulary | null, level: string): Word[] {
    return vocab?.[level] ?? [];
}

export function getAvailableLevels(vocab: Vocabulary | null): string[] {
    return vocab ? Object.keys(vocab).sort() : [];
}

/**
 * Search vocabulary using the trie index
 * Falls back to linear search if index not loaded
 */
export function searchVocabulary(query: string, maxResults = 10): { word: Word; level: string }[] {
    const index = get(searchIndexStore);
    const flatWords = get(flatWordsStore);
    const vocab = get(vocabulary);

    if (!vocab || flatWords.length === 0) {
        return [];
    }

    if (index) {
        // Use trie index for fast search
        const indices = searchIndex(index, query, maxResults);
        return indices.map((idx) => {
            const word = flatWords[idx];
            // Find level for this word
            const level = findWordLevel(vocab, idx);
            return { word, level };
        });
    }

    // Fallback: linear search (same logic as before)
    return linearSearch(vocab, query, maxResults);
}

/**
 * Find the level for a word given its flat index
 */
function findWordLevel(vocab: Vocabulary, flatIndex: number): string {
    const levels = Object.keys(vocab).sort();
    let offset = 0;

    for (const level of levels) {
        const levelWords = vocab[level];
        if (flatIndex < offset + levelWords.length) {
            return level;
        }
        offset += levelWords.length;
    }

    return levels[0] || 'A1';
}

/**
 * Linear search fallback (original browse page logic)
 */
function linearSearch(
    vocab: Vocabulary,
    query: string,
    maxResults: number
): { word: Word; level: string }[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const results: { word: Word; level: string }[] = [];

    for (const [level, levelWords] of Object.entries(vocab)) {
        for (const word of levelWords) {
            const matchesArmenian = word.am.toLowerCase().includes(normalizedQuery);
            const matchesPronunciation =
                word.spell?.toLowerCase().includes(normalizedQuery) ?? false;
            const matchesEnglish =
                word.en?.some((t) => t.toLowerCase().includes(normalizedQuery)) ?? false;
            const matchesRussian =
                word.ru?.some((t) => t.toLowerCase().includes(normalizedQuery)) ?? false;

            if (matchesArmenian || matchesPronunciation || matchesEnglish || matchesRussian) {
                results.push({ word, level });
                if (results.length >= maxResults) {
                    return results;
                }
            }
        }
    }

    return results;
}
