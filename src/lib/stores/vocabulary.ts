import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import type { Vocabulary, Word } from '$lib/types.js';
import { learntTranslations } from './progress.js';
import { quizLanguage } from './settings.js';

function createVocabularyStore() {
    const store = writable<Vocabulary | null>(null);
    let loading = false;

    return {
        subscribe: store.subscribe,
        load: async () => {
            if (loading || !browser) return;
            loading = true;

            try {
                const response = await fetch(`${base}/vocabulary.json`);
                if (!response.ok) {
                    throw new Error(
                        `Failed to load vocabulary: ${response.status} ${response.statusText}`
                    );
                }
                const data = (await response.json()) as Vocabulary;
                store.set(data);

                // Run migration from old learntWords format if needed
                // Uses the currently selected language setting
                const currentLanguage = get(quizLanguage);
                learntTranslations.migrateIfNeeded(data, currentLanguage);
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
