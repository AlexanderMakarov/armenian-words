import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Vocabulary, Word } from '$lib/types.js';

function createVocabularyStore() {
    const store = writable<Vocabulary | null>(null);
    let loading = false;

    return {
        subscribe: store.subscribe,
        load: async () => {
            if (loading || !browser) return;
            loading = true;

            try {
                const response = await fetch('/vocabulary.json');
                if (!response.ok) {
                    throw new Error(
                        `Failed to load vocabulary: ${response.status} ${response.statusText}`
                    );
                }
                const data = (await response.json()) as Vocabulary;
                store.set(data);
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
